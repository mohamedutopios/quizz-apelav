/**
 * Script idempotent qui s'assure qu'un compte admin existe avec un password
 * bcrypt valide. Exécuté au démarrage du conteneur backend.
 * Variables :
 *   ADMIN_USERNAME (défaut: admin&admin)
 *   ADMIN_PASSWORD (défaut: Apelav2026!)
 *   ADMIN_NOM, ADMIN_PRENOM
 */
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { config } from '../config.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin&admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Apelav2026!';
const ADMIN_NOM = process.env.ADMIN_NOM || 'Admin';
const ADMIN_PRENOM = process.env.ADMIN_PRENOM || 'Admin';

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, config.bcryptCost);

  // Tente d'insérer, sinon update du hash + role
  const [existing] = await pool.query(
    `SELECT id FROM users WHERE username = ? LIMIT 1`,
    [ADMIN_USERNAME]
  );

  if (existing.length === 0) {
    await pool.query(
      `INSERT INTO users (nom, prenom, nom_norm, prenom_norm, username, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'admin')`,
      [
        ADMIN_NOM,
        ADMIN_PRENOM,
        ADMIN_NOM.toLowerCase(),
        ADMIN_PRENOM.toLowerCase(),
        ADMIN_USERNAME,
        hash,
      ]
    );
    console.log(`[seed-admin] Admin créé : ${ADMIN_USERNAME}`);
  } else {
    await pool.query(
      `UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?`,
      [hash, existing[0].id]
    );
    console.log(`[seed-admin] Admin mis à jour : ${ADMIN_USERNAME}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[seed-admin] Erreur:', err);
  process.exit(1);
});
