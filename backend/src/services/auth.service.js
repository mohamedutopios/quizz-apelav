import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { config } from '../config.js';

/**
 * Normalise un nom/prénom : trim + minuscules + suppression des accents
 * pour comparer "Dupont" et "dupont" comme identiques.
 */
export function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Construit le username "nom&prenom" comme exigé par le brief.
 * On utilise la version normalisée (sans accents, minuscules) pour stabilité.
 */
export function buildUsername(nom, prenom) {
  const n = normalize(nom);
  const p = normalize(prenom);
  return `${n}&${p}`;
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,80}$/;

export function validateRegisterInput({ nom, prenom, password }) {
  const errors = [];
  if (!nom || !NAME_REGEX.test(nom)) errors.push('Nom invalide');
  if (!prenom || !NAME_REGEX.test(prenom)) errors.push('Prénom invalide');
  if (!password || password.length < 6 || password.length > 200) {
    errors.push('Mot de passe : 6 à 200 caractères');
  }
  return errors;
}

export async function registerUser({ nom, prenom, password }) {
  const nom_norm = normalize(nom);
  const prenom_norm = normalize(prenom);
  const username = buildUsername(nom, prenom);
  const password_hash = await bcrypt.hash(password, config.bcryptCost);

  try {
    const [result] = await pool.query(
      `INSERT INTO users (nom, prenom, nom_norm, prenom_norm, username, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'user')`,
      [nom.trim(), prenom.trim(), nom_norm, prenom_norm, username, password_hash]
    );
    return { id: result.insertId, username };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const e = new Error('Cette personne (nom + prénom) est déjà inscrite.');
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}

export async function findUserByUsername(username) {
  const [rows] = await pool.query(
    `SELECT id, nom, prenom, username, password_hash, role FROM users WHERE username = ? LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
