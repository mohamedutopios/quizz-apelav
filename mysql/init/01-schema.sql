-- ============================================================================
-- Schéma BDD - Quizz APELAV 2026
-- ============================================================================
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS apelav_quizz
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE apelav_quizz;

-- ----------------------------------------------------------------------------
-- Utilisateurs (participants + admins)
-- L'unicité du triplet (nom, prenom, password_hash) n'est pas réalisable
-- car le hash bcrypt diffère pour un même mot de passe. On garantit donc
-- l'unicité sur (nom_normalise, prenom_normalise) côté logique applicative,
-- avec un index unique pour bloquer les doublons d'inscription.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom VARCHAR(80) NOT NULL,
  prenom VARCHAR(80) NOT NULL,
  nom_norm VARCHAR(80) NOT NULL,    -- lowercase + trim (pour unicité)
  prenom_norm VARCHAR(80) NOT NULL,
  username VARCHAR(165) NOT NULL,   -- "nom&prenom" (login fourni par le brief)
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_nom_prenom (nom_norm, prenom_norm),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Questions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enonce TEXT NOT NULL,
  ordre INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 1,         -- Pondération (1 par défaut, 2 pour les questions difficiles)
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_questions_active_ordre (active, ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Réponses (choix)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  texte TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  ordre INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_answers_question (question_id),
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Tentatives de quiz (1 seule par utilisateur garantie par UNIQUE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  duration_ms INT UNSIGNED NULL DEFAULT NULL,    -- temps réel passé sur le quiz
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_count INT UNSIGNED NOT NULL DEFAULT 0,
  score_sur_20 DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status ENUM('in_progress','submitted','timeout') NOT NULL DEFAULT 'in_progress',
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempt_user (user_id),          -- 1 seul essai par user
  KEY idx_attempts_status (status),
  KEY idx_attempts_ranking (correct_count DESC, duration_ms ASC),
  CONSTRAINT fk_attempts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Réponses données par les utilisateurs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempt_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_id BIGINT UNSIGNED NULL,                -- NULL si pas répondu (timeout)
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  KEY idx_aa_attempt (attempt_id),
  CONSTRAINT fk_aa_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_aa_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_aa_answer FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Paramètres globaux du quiz (singleton, id=1)
-- L'admin contrôle ici l'état d'activation depuis le tableau de bord.
--   disabled : participants bloqués, page "en attente"
--   enabled  : participants peuvent démarrer leur tentative
--   closed   : nouvelles tentatives bloquées, en-cours laissées finir
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('disabled','enabled','closed') NOT NULL DEFAULT 'disabled',
  activated_at TIMESTAMP NULL DEFAULT NULL,
  activated_by BIGINT UNSIGNED NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertion de la ligne singleton (état initial : disabled)
INSERT IGNORE INTO quiz_settings (id, status) VALUES (1, 'disabled');

-- ----------------------------------------------------------------------------
-- Migration : ajout de la colonne 'points' si elle n'existe pas
-- Cette section permet aux BDD existantes (créées avant cette version) de
-- recevoir la nouvelle colonne sans avoir à reset le volume.
-- ----------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'points'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE questions ADD COLUMN points INT NOT NULL DEFAULT 1 AFTER ordre',
  'SELECT "Colonne points déjà présente"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
