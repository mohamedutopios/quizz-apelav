import { pool, withTransaction } from '../db/pool.js';
import { config } from '../config.js';
import { getQuizStatus } from './settings.service.js';

/**
 * Récupère toutes les questions actives avec leurs réponses.
 * On NE renvoie PAS is_correct côté participant pour ne pas exposer la solution.
 */
export async function getQuizForParticipant() {
  const [questions] = await pool.query(
    `SELECT id, enonce, ordre, points FROM questions WHERE active = 1 ORDER BY ordre ASC, id ASC`
  );
  if (questions.length === 0) return [];
  const ids = questions.map((q) => q.id);
  const [answers] = await pool.query(
    `SELECT id, question_id, texte, ordre FROM answers
     WHERE question_id IN (${ids.map(() => '?').join(',')})
     ORDER BY ordre ASC, id ASC`,
    ids
  );
  const byQ = new Map();
  for (const a of answers) {
    if (!byQ.has(a.question_id)) byQ.set(a.question_id, []);
    byQ.get(a.question_id).push({ id: a.id, texte: a.texte });
  }
  return questions.map((q) => ({
    id: q.id,
    enonce: q.enonce,
    ordre: q.ordre,
    answers: byQ.get(q.id) || [],
  }));
}

/**
 * Démarre ou retourne la tentative existante pour un utilisateur.
 * Garantit qu'une seule tentative existe (UNIQUE en BDD).
 * Si la tentative existante est déjà terminée → 403.
 * Si la tentative est en cours mais que le temps est écoulé → on la marque timeout
 * et on refuse.
 */
export async function startOrResumeAttempt(userId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, started_at, finished_at, status FROM quiz_attempts WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    if (rows.length > 0) {
      const att = rows[0];
      if (att.status !== 'in_progress') {
        const e = new Error('Vous avez déjà passé le quiz.');
        e.statusCode = 403;
        throw e;
      }
      // Check expiration
      const elapsed = Date.now() - new Date(att.started_at).getTime();
      if (elapsed >= config.quizDurationMs) {
        await finalizeTimeoutInTx(conn, att.id);
        const e = new Error('Temps écoulé. Vos réponses ont été enregistrées.');
        e.statusCode = 410; // Gone
        e.payload = { timeout: true };
        throw e;
      }
      // Tentative en cours : on autorise la reprise même si l'admin a fermé entre-temps
      return {
        attemptId: att.id,
        startedAt: att.started_at,
        remainingMs: config.quizDurationMs - elapsed,
        resumed: true,
      };
    }

    // Aucune tentative existante : on vérifie que l'admin a activé le quiz
    const { status } = await getQuizStatus();
    if (status === 'disabled') {
      const e = new Error("Le quiz n'a pas encore été ouvert par l'organisatrice.");
      e.statusCode = 423; // Locked
      e.payload = { quizStatus: status };
      throw e;
    }
    if (status === 'closed') {
      const e = new Error("Les inscriptions au quiz sont clôturées.");
      e.statusCode = 423;
      e.payload = { quizStatus: status };
      throw e;
    }

    const [ins] = await conn.query(
      `INSERT INTO quiz_attempts (user_id, started_at, status) VALUES (?, NOW(), 'in_progress')`,
      [userId]
    );
    const [back] = await conn.query(
      `SELECT started_at FROM quiz_attempts WHERE id = ?`,
      [ins.insertId]
    );
    return {
      attemptId: ins.insertId,
      startedAt: back[0].started_at,
      remainingMs: config.quizDurationMs,
      resumed: false,
    };
  });
}

/**
 * Sauvegarde / met à jour une réponse (autosave pendant le quiz).
 * Vérifie que le délai n'est pas écoulé.
 */
export async function saveAnswer({ userId, attemptId, questionId, answerId }) {
  return withTransaction(async (conn) => {
    const [attRows] = await conn.query(
      `SELECT id, started_at, status FROM quiz_attempts
       WHERE id = ? AND user_id = ? FOR UPDATE`,
      [attemptId, userId]
    );
    if (attRows.length === 0) {
      const e = new Error('Tentative inconnue'); e.statusCode = 404; throw e;
    }
    const att = attRows[0];
    if (att.status !== 'in_progress') {
      const e = new Error('Quiz déjà terminé'); e.statusCode = 403; throw e;
    }
    const elapsed = Date.now() - new Date(att.started_at).getTime();
    if (elapsed >= config.quizDurationMs) {
      await finalizeTimeoutInTx(conn, att.id);
      const e = new Error('Temps écoulé'); e.statusCode = 410; throw e;
    }

    // Vérif que la réponse appartient bien à la question (anti-tampering)
    const [okAns] = await conn.query(
      `SELECT is_correct FROM answers WHERE id = ? AND question_id = ?`,
      [answerId, questionId]
    );
    if (okAns.length === 0) {
      const e = new Error('Réponse invalide pour cette question'); e.statusCode = 400; throw e;
    }
    const isCorrect = okAns[0].is_correct ? 1 : 0;

    await conn.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, answer_id, is_correct)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE answer_id = VALUES(answer_id), is_correct = VALUES(is_correct), answered_at = CURRENT_TIMESTAMP`,
      [attemptId, questionId, answerId, isCorrect]
    );

    return { ok: true };
  });
}

/**
 * Termine le quiz et calcule le score définitif.
 */
export async function submitAttempt({ userId, attemptId }) {
  return withTransaction(async (conn) => {
    const [attRows] = await conn.query(
      `SELECT id, started_at, status FROM quiz_attempts
       WHERE id = ? AND user_id = ? FOR UPDATE`,
      [attemptId, userId]
    );
    if (attRows.length === 0) {
      const e = new Error('Tentative inconnue'); e.statusCode = 404; throw e;
    }
    const att = attRows[0];
    if (att.status !== 'in_progress') {
      const e = new Error('Quiz déjà terminé'); e.statusCode = 403; throw e;
    }
    const elapsedMs = Date.now() - new Date(att.started_at).getTime();
    const capped = Math.min(elapsedMs, config.quizDurationMs);
    const status = elapsedMs >= config.quizDurationMs ? 'timeout' : 'submitted';
    return finalizeInTx(conn, att.id, capped, status);
  });
}

/**
 * Finalise une tentative (calcule score + écrit l'état final).
 * Score basé sur la somme des points pondérés (chaque question peut valoir 1 ou 2 pts).
 */
async function finalizeInTx(conn, attemptId, durationMs, status) {
  // Total maximum possible : somme des points de toutes les questions actives
  const [[totalRow]] = await conn.query(
    `SELECT COALESCE(SUM(points), 0) AS total_points, COUNT(*) AS total_questions
     FROM questions WHERE active = 1`
  );
  const totalPoints = parseInt(totalRow.total_points, 10) || 0;
  const totalQuestions = parseInt(totalRow.total_questions, 10) || 0;

  // Points gagnés par cet utilisateur : somme des points des questions où il a bien répondu
  const [[gainRow]] = await conn.query(
    `SELECT COALESCE(SUM(q.points), 0) AS earned_points, COUNT(*) AS correct_count
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ? AND aa.is_correct = 1`,
    [attemptId]
  );
  const earnedPoints = parseInt(gainRow.earned_points, 10) || 0;
  const correctCount = parseInt(gainRow.correct_count, 10) || 0;

  // Score sur 20 = (points obtenus / points totaux) × 20
  // Avec le seed actuel (total = 20 pts), le score = earnedPoints directement
  const score = totalPoints > 0 ? (earnedPoints / totalPoints) * config.scoreMax : 0;

  await conn.query(
    `UPDATE quiz_attempts
     SET finished_at = NOW(), duration_ms = ?, correct_count = ?, total_count = ?,
         score_sur_20 = ?, status = ?
     WHERE id = ?`,
    [durationMs, correctCount, totalQuestions, score.toFixed(2), status, attemptId]
  );

  return {
    attemptId,
    correct: correctCount,
    total: totalQuestions,
    earnedPoints,
    totalPoints,
    score: parseFloat(score.toFixed(2)),
    durationMs,
    status,
  };
}

async function finalizeTimeoutInTx(conn, attemptId) {
  return finalizeInTx(conn, attemptId, config.quizDurationMs, 'timeout');
}

/**
 * Récupère l'état actuel d'une tentative (pour reprise après refresh).
 */
export async function getAttemptState(userId) {
  const [rows] = await pool.query(
    `SELECT id, started_at, finished_at, duration_ms, correct_count, total_count,
            score_sur_20, status
     FROM quiz_attempts WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const att = rows[0];
  const result = {
    attemptId: att.id,
    status: att.status,
    score: att.score_sur_20 !== null ? parseFloat(att.score_sur_20) : null,
    correct: att.correct_count,
    total: att.total_count,
    durationMs: att.duration_ms,
  };
  if (att.status === 'in_progress') {
    const elapsed = Date.now() - new Date(att.started_at).getTime();
    result.remainingMs = Math.max(0, config.quizDurationMs - elapsed);

    // Reload des réponses déjà cochées
    const [saved] = await pool.query(
      `SELECT question_id, answer_id FROM attempt_answers WHERE attempt_id = ?`,
      [att.id]
    );
    result.savedAnswers = saved.reduce((acc, r) => {
      acc[r.question_id] = r.answer_id;
      return acc;
    }, {});
  }
  return result;
}
