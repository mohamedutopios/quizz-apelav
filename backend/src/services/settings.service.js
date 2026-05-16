import { pool } from '../db/pool.js';

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
