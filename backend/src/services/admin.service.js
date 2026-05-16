import { pool, withTransaction } from '../db/pool.js';
import { listOnline } from '../db/redis.js';

export async function getRanking() {
  // Classement : tri par bonnes réponses DESC, puis durée ASC (le plus rapide gagne)
  const [rows] = await pool.query(
    `SELECT a.id AS attempt_id, u.id AS user_id, u.nom, u.prenom, u.username,
            a.correct_count, a.total_count, a.score_sur_20, a.duration_ms,
            a.status, a.finished_at
     FROM quiz_attempts a
     JOIN users u ON u.id = a.user_id
     WHERE a.status IN ('submitted','timeout')
       AND u.role = 'user'
     ORDER BY a.correct_count DESC, a.duration_ms ASC, a.finished_at ASC`
  );
  return rows.map((r, i) => ({
    rang: i + 1,
    userId: r.user_id,
    attemptId: r.attempt_id,
    nom: r.nom,
    prenom: r.prenom,
    username: r.username,
    correct: r.correct_count,
    total: r.total_count,
    score: parseFloat(r.score_sur_20),
    durationMs: r.duration_ms,
    status: r.status,
    finishedAt: r.finished_at,
  }));
}

export async function getParticipants() {
  // Tous les utilisateurs inscrits + état de leur tentative
  const [rows] = await pool.query(
    `SELECT u.id, u.nom, u.prenom, u.username, u.created_at,
            a.id AS attempt_id, a.status AS attempt_status,
            a.started_at, a.finished_at, a.score_sur_20, a.correct_count, a.duration_ms
     FROM users u
     LEFT JOIN quiz_attempts a ON a.user_id = u.id
     WHERE u.role = 'user'
     ORDER BY u.created_at DESC`
  );
  const onlineIds = new Set(await listOnline());
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    prenom: r.prenom,
    username: r.username,
    inscritLe: r.created_at,
    online: onlineIds.has(r.id),
    attempt: r.attempt_id
      ? {
          id: r.attempt_id,
          status: r.attempt_status,
          startedAt: r.started_at,
          finishedAt: r.finished_at,
          score: r.score_sur_20 !== null ? parseFloat(r.score_sur_20) : null,
          correct: r.correct_count,
          durationMs: r.duration_ms,
        }
      : null,
  }));
}

export async function getDashboardStats() {
  const [[users]] = await pool.query(
    `SELECT COUNT(*) AS c FROM users WHERE role = 'user'`
  );
  const [[done]] = await pool.query(
    `SELECT COUNT(*) AS c FROM quiz_attempts WHERE status IN ('submitted','timeout')`
  );
  const [[inProgress]] = await pool.query(
    `SELECT COUNT(*) AS c FROM quiz_attempts WHERE status = 'in_progress'`
  );
  const onlineIds = await listOnline();
  return {
    totalUsers: users.c,
    completed: done.c,
    inProgress: inProgress.c,
    online: onlineIds.length,
  };
}

// -----------------------------
// Gestion des questions (admin)
// -----------------------------

export async function listQuestionsAdmin() {
  const [questions] = await pool.query(
    `SELECT id, enonce, ordre, active FROM questions ORDER BY ordre ASC, id ASC`
  );
  if (questions.length === 0) return [];
  const ids = questions.map((q) => q.id);
  const [answers] = await pool.query(
    `SELECT id, question_id, texte, is_correct, ordre FROM answers
     WHERE question_id IN (${ids.map(() => '?').join(',')})
     ORDER BY ordre ASC, id ASC`,
    ids
  );
  const byQ = new Map();
  for (const a of answers) {
    if (!byQ.has(a.question_id)) byQ.set(a.question_id, []);
    byQ.get(a.question_id).push({
      id: a.id,
      texte: a.texte,
      isCorrect: !!a.is_correct,
      ordre: a.ordre,
    });
  }
  return questions.map((q) => ({
    id: q.id,
    enonce: q.enonce,
    ordre: q.ordre,
    active: !!q.active,
    answers: byQ.get(q.id) || [],
  }));
}

export async function createQuestion({ enonce, active = true, answers }) {
  validateQuestionPayload({ enonce, answers });
  return withTransaction(async (conn) => {
    const [[ord]] = await conn.query(
      `SELECT COALESCE(MAX(ordre), 0) + 1 AS next FROM questions`
    );
    const [ins] = await conn.query(
      `INSERT INTO questions (enonce, ordre, active) VALUES (?, ?, ?)`,
      [enonce.trim(), ord.next, active ? 1 : 0]
    );
    const qid = ins.insertId;
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      await conn.query(
        `INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES (?, ?, ?, ?)`,
        [qid, a.texte.trim(), a.isCorrect ? 1 : 0, i + 1]
      );
    }
    return { id: qid };
  });
}

export async function updateQuestion(id, { enonce, active, answers }) {
  validateQuestionPayload({ enonce, answers });
  return withTransaction(async (conn) => {
    const [chk] = await conn.query(`SELECT id FROM questions WHERE id = ?`, [id]);
    if (chk.length === 0) {
      const e = new Error('Question introuvable'); e.statusCode = 404; throw e;
    }
    await conn.query(
      `UPDATE questions SET enonce = ?, active = ? WHERE id = ?`,
      [enonce.trim(), active ? 1 : 0, id]
    );
    // Approche simple : on supprime et on recrée les réponses
    // (sûr car attempt_answers a un ON DELETE SET NULL sur answer_id)
    await conn.query(`DELETE FROM answers WHERE question_id = ?`, [id]);
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      await conn.query(
        `INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES (?, ?, ?, ?)`,
        [id, a.texte.trim(), a.isCorrect ? 1 : 0, i + 1]
      );
    }
    return { id };
  });
}

export async function deleteQuestion(id) {
  const [r] = await pool.query(`DELETE FROM questions WHERE id = ?`, [id]);
  if (r.affectedRows === 0) {
    const e = new Error('Question introuvable'); e.statusCode = 404; throw e;
  }
  return { ok: true };
}

function validateQuestionPayload({ enonce, answers }) {
  if (!enonce || typeof enonce !== 'string' || enonce.trim().length < 3) {
    const e = new Error('Énoncé requis (3 caractères minimum)');
    e.statusCode = 400; throw e;
  }
  if (!Array.isArray(answers) || answers.length < 2 || answers.length > 6) {
    const e = new Error('Entre 2 et 6 réponses requises');
    e.statusCode = 400; throw e;
  }
  const correct = answers.filter((a) => a.isCorrect).length;
  if (correct !== 1) {
    const e = new Error('Exactement une réponse correcte est requise');
    e.statusCode = 400; throw e;
  }
  for (const a of answers) {
    if (!a.texte || typeof a.texte !== 'string' || a.texte.trim().length === 0) {
      const e = new Error('Chaque réponse doit avoir un texte');
      e.statusCode = 400; throw e;
    }
  }
}

// -------------------------------------------------------------------
// Consultation détaillée des réponses d'un participant (pour contestations)
// -------------------------------------------------------------------
export async function getAttemptDetails(attemptId) {
  const [[att]] = await pool.query(
    `SELECT a.id, a.user_id, a.started_at, a.finished_at, a.duration_ms,
            a.correct_count, a.total_count, a.score_sur_20, a.status,
            u.nom, u.prenom, u.username
     FROM quiz_attempts a
     JOIN users u ON u.id = a.user_id
     WHERE a.id = ? LIMIT 1`,
    [attemptId]
  );
  if (!att) {
    const e = new Error('Tentative introuvable'); e.statusCode = 404; throw e;
  }

  // Toutes les questions actives avec les réponses possibles + la réponse de l'utilisateur
  const [questions] = await pool.query(
    `SELECT id, enonce, ordre FROM questions WHERE active = 1 ORDER BY ordre ASC, id ASC`
  );
  const qIds = questions.map((q) => q.id);
  const [answers] = qIds.length
    ? await pool.query(
        `SELECT id, question_id, texte, is_correct, ordre FROM answers
         WHERE question_id IN (${qIds.map(() => '?').join(',')})
         ORDER BY ordre ASC, id ASC`,
        qIds
      )
    : [[]];
  const [given] = await pool.query(
    `SELECT question_id, answer_id, is_correct, answered_at
     FROM attempt_answers WHERE attempt_id = ?`,
    [attemptId]
  );
  const givenByQ = new Map(given.map((g) => [g.question_id, g]));
  const answersByQ = new Map();
  for (const a of answers) {
    if (!answersByQ.has(a.question_id)) answersByQ.set(a.question_id, []);
    answersByQ.get(a.question_id).push({
      id: a.id, texte: a.texte, isCorrect: !!a.is_correct, ordre: a.ordre,
    });
  }

  return {
    attempt: {
      id: att.id,
      userId: att.user_id,
      nom: att.nom, prenom: att.prenom, username: att.username,
      startedAt: att.started_at,
      finishedAt: att.finished_at,
      durationMs: att.duration_ms,
      correctCount: att.correct_count,
      totalCount: att.total_count,
      score: att.score_sur_20 !== null ? parseFloat(att.score_sur_20) : null,
      status: att.status,
    },
    questions: questions.map((q) => {
      const given = givenByQ.get(q.id);
      return {
        id: q.id,
        ordre: q.ordre,
        enonce: q.enonce,
        answers: answersByQ.get(q.id) || [],
        userAnswerId: given?.answer_id ?? null,
        userIsCorrect: given ? !!given.is_correct : null,
        answeredAt: given?.answered_at ?? null,
      };
    }),
  };
}
