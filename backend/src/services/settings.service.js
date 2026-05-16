import { pool, withTransaction } from '../db/pool.js';
import { redis } from '../db/redis.js';
import { config } from '../config.js';

const VALID_STATUS = new Set(['disabled', 'enabled', 'closed']);

/**
 * Récupère l'état actuel du quiz (singleton id=1).
 * Si la ligne n'existe pas pour une raison ou une autre, retourne 'disabled' par sécurité.
 */
export async function getQuizStatus() {
  const [rows] = await pool.query(
    `SELECT status, activated_at, activated_by, updated_at
     FROM quiz_settings WHERE id = 1 LIMIT 1`
  );
  if (rows.length === 0) {
    return { status: 'disabled', activatedAt: null, activatedBy: null, updatedAt: null };
  }
  return {
    status: rows[0].status,
    activatedAt: rows[0].activated_at,
    activatedBy: rows[0].activated_by,
    updatedAt: rows[0].updated_at,
  };
}

/**
 * Change l'état du quiz. Réservé à l'admin.
 */
export async function setQuizStatus(newStatus, adminUserId) {
  if (!VALID_STATUS.has(newStatus)) {
    const e = new Error("Statut invalide (disabled | enabled | closed)");
    e.statusCode = 400; throw e;
  }
  // On stocke activated_at uniquement quand on passe à enabled,
  // on garde la valeur précédente sinon (pour audit).
  if (newStatus === 'enabled') {
    await pool.query(
      `UPDATE quiz_settings
       SET status = ?, activated_at = NOW(), activated_by = ?
       WHERE id = 1`,
      [newStatus, adminUserId]
    );
  } else {
    await pool.query(
      `UPDATE quiz_settings SET status = ? WHERE id = 1`,
      [newStatus]
    );
  }
  return getQuizStatus();
}

/**
 * Reset complet du quiz :
 *   - supprime toutes les réponses des participants (attempt_answers)
 *   - supprime toutes les tentatives (quiz_attempts)
 *   - supprime tous les utilisateurs role='user' (les admins sont conservés)
 *   - remet le statut du quiz à 'disabled'
 *   - vide le tracking de présence Redis
 *
 * Les questions et les bonnes réponses sont conservées.
 * Action IRRÉVERSIBLE — l'admin doit confirmer côté UI.
 */
export async function resetQuiz() {
  const stats = await withTransaction(async (conn) => {
    // Compter avant pour le retour
    const [[before]] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role='user') AS participants,
         (SELECT COUNT(*) FROM quiz_attempts) AS attempts,
         (SELECT COUNT(*) FROM attempt_answers) AS answers`
    );

    // Suppression en cascade : la FK ON DELETE CASCADE
    // sur attempt_answers et quiz_attempts (via user_id) fait le travail
    await conn.query(`DELETE FROM users WHERE role = 'user'`);

    // Au cas où il resterait des données orphelines (sécurité)
    await conn.query(`DELETE FROM attempt_answers`);
    await conn.query(`DELETE FROM quiz_attempts`);

    // Remettre le quiz en attente
    await conn.query(
      `UPDATE quiz_settings
       SET status = 'disabled', activated_at = NULL, activated_by = NULL
       WHERE id = 1`
    );

    return {
      deletedParticipants: before.participants,
      deletedAttempts: before.attempts,
      deletedAnswers: before.answers,
    };
  });

  // Vider la présence Redis (les clés online:* du préfixe configuré)
  try {
    const prefix = config.redis.keyPrefix;
    const stream = redis.scanStream({ match: `${prefix}online:*`, count: 200 });
    const keys = [];
    for await (const batch of stream) {
      for (const k of batch) keys.push(k.replace(prefix, ''));
    }
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non bloquant : la présence se rafraîchit toute seule en 90s
  }

  return stats;
}
