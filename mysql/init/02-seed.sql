-- ============================================================================
-- Seed des 18 questions du quiz APELAV 2026
-- Pondération : 16 questions × 1 pt + 2 questions × 2 pts = 20 points
-- + compte admin par défaut
-- ============================================================================
USE apelav_quizz;

-- Compte admin par défaut (le script seed-admin.js le crée/met à jour au boot du backend)
-- On utilise INSERT IGNORE au cas où.
INSERT IGNORE INTO users (nom, prenom, nom_norm, prenom_norm, username, password_hash, role)
VALUES (
  'Admin', 'Apelav', 'admin', 'apelav', 'admin&admin',
  '$2b$12$YwI5pH9w6w8z2QqVQH7BS.Vh8mFvW6Yf3wQqB4dPHC8fO2qY8L3xK',
  'admin'
);

-- ----------------------------------------------------------------------------
-- Questions (réponses correctes marquées is_correct=1)
-- ----------------------------------------------------------------------------

-- Q1
INSERT INTO questions (enonce, ordre, points) VALUES ('Qui est le président de l''association Averroès ?', 1, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'M. Dufour', 0, 1),
  (@q, 'M. Mamèche', 0, 2),
  (@q, 'M. Macron', 0, 3),
  (@q, 'M. Damak', 1, 4);

-- Q2
INSERT INTO questions (enonce, ordre, points) VALUES ('En quelle année, le Conseil supérieur de l''Éducation nationale délivre l''autorisation d''ouverture d''un premier lycée privé musulman en France métropolitaine ?', 2, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, '2001', 0, 1),
  (@q, '2008', 0, 2),
  (@q, '2013', 0, 3),
  (@q, '2003', 1, 4);

-- Q3
INSERT INTO questions (enonce, ordre, points) VALUES ('En quelle année, l''établissement avait été classé en tête du classement des meilleurs lycées généraux de France ?', 3, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, '2010', 0, 1),
  (@q, '2013', 1, 2),
  (@q, '2012', 0, 3),
  (@q, '2020', 0, 4);

-- Q4
INSERT INTO questions (enonce, ordre, points) VALUES ('Comment se nomme le président de la région qui refuse de verser les subventions obligatoires au lycée Averroès ?', 4, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Pierrick Berteloot', 0, 1),
  (@q, 'Xavier Bertrand', 1, 2),
  (@q, 'Julien Odoul', 0, 3),
  (@q, 'Marine Le Pen', 0, 4);

-- Q5
INSERT INTO questions (enonce, ordre, points) VALUES ('Comment se nomme le préfet qui a acté le retrait du contrat de l''association Averroès avec l''État ?', 5, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Xavier Bertrand', 0, 1),
  (@q, 'Georges-François Leclerc', 1, 2),
  (@q, 'Gérald Darmanin', 0, 3),
  (@q, 'Gabriel Attal', 0, 4);

-- Q6
INSERT INTO questions (enonce, ordre, points) VALUES ('À quelle date le tribunal administratif de Lille a rétabli le contrat d''association entre l''État et le lycée Averroès ?', 6, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Le 01/09/2025', 0, 1),
  (@q, 'Le 23 avril 2025', 1, 2),
  (@q, 'Le 30/06/2025', 0, 3),
  (@q, 'Le 10/05/2025', 0, 4);

-- Q7
INSERT INTO questions (enonce, ordre, points) VALUES ('Qu''est-ce que l''Ihram ?', 7, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'L''accomplissement du Hajj ou de la Omra', 0, 1),
  (@q, 'L''intention d''accomplir le Hajj ou la Omra, ou état de sacralité', 1, 2),
  (@q, 'Le départ pour le Hajj ou la Omra', 0, 3),
  (@q, 'La fin du Hajj ou de la Omra', 0, 4);

-- Q8
INSERT INTO questions (enonce, ordre, points) VALUES ('Qu''est-il obligatoire de faire pour l''homme qui va se mettre en état de Ihram ?', 8, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Faire la Chahada', 0, 1),
  (@q, 'Mettre des habits neufs', 0, 2),
  (@q, 'Se débarrasser de ses habits cousus', 1, 3),
  (@q, 'Faire Istighfar', 0, 4);

-- Q9
INSERT INTO questions (enonce, ordre, points) VALUES ('Lors de l''Ihram, la Talbiya (formule) a un caractère...', 9, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Interdit', 0, 1),
  (@q, 'Déconseillé', 0, 2),
  (@q, 'Permis', 0, 3),
  (@q, 'Obligatoire', 1, 4);

-- Q10
INSERT INTO questions (enonce, ordre, points) VALUES ('Quel Prophète est à l''origine de Zamzam ?', 10, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Ismail ﷺ', 1, 1),
  (@q, 'Ishaq ﷺ', 0, 2),
  (@q, 'Yacob ﷺ', 0, 3),
  (@q, 'Ibrahim ﷺ', 0, 4);

-- Q11
INSERT INTO questions (enonce, ordre, points) VALUES ('Combien de tours autour de la Kaaba les pèlerins doivent-ils effectuer ?', 11, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, '1', 0, 1),
  (@q, '3', 0, 2),
  (@q, '5', 0, 3),
  (@q, '7', 1, 4);

-- Q12 (NOUVEAU)
INSERT INTO questions (enonce, ordre, points) VALUES ('Quel rite marque la fin des obligations du pèlerinage de la Omra ?', 12, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'La prière de deux unités (Rak''at)', 0, 1),
  (@q, 'La consommation d''eau de Zamzam', 0, 2),
  (@q, 'Le rasage ou la coupe des cheveux', 1, 3),
  (@q, 'Le Sa''y (la marche entre Safâ et Marwa)', 0, 4);

-- Q13 (NOUVEAU)
INSERT INTO questions (enonce, ordre, points) VALUES ('L''idtibâ'' est recommandé pour l''homme. Il consiste à faire passer son Rida sous l''aisselle droite (et donc découvrir l''épaule droite) et poser les deux extrémités du Rida sur son épaule gauche. Cela se fait :', 13, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Lors des circumambulations (tawaf)', 1, 1),
  (@q, 'Lors des allers et retours entre les monts As-Safa et Al-Marwa (sa''y)', 0, 2),
  (@q, 'Tout le long de la omra', 0, 3),
  (@q, 'Au moment du rasage de tête ou de la coupe des cheveux', 0, 4);

-- Q14 (ancienne Q12)
INSERT INTO questions (enonce, ordre, points) VALUES ('Qu''est-ce que la Kiswa ?', 14, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Une chamelle', 0, 1),
  (@q, 'La couverture de la Kaaba', 1, 2),
  (@q, 'Un vêtement', 0, 3),
  (@q, 'Une prière', 0, 4);

-- Q15 (ancienne Q13)
INSERT INTO questions (enonce, ordre, points) VALUES ('Qui a reconstruit la Mecque ?', 15, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Ibrahim et Ismaël', 1, 1),
  (@q, 'Yunus et Bilal', 0, 2),
  (@q, 'Mohammed et Ayyoub', 0, 3),
  (@q, 'Noé et Mousâ', 0, 4);

-- Q16 (ancienne Q14)
INSERT INTO questions (enonce, ordre, points) VALUES ('De quel côté de l''Arabie Saoudite se trouve la ville sainte de La Mecque ?', 16, 1);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'L''est', 0, 1),
  (@q, 'L''ouest', 1, 2),
  (@q, 'Le Nord', 0, 3),
  (@q, 'Le Sud', 0, 4);

-- Q17 (ancienne Q15) — 2 POINTS
INSERT INTO questions (enonce, ordre, points) VALUES ('Comment s''appelle la toute première mosquée de l''Islam ?', 17, 2);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Masjid Quba', 1, 1),
  (@q, 'Masjid Al Haram', 0, 2),
  (@q, 'Masjid Nabawi', 0, 3),
  (@q, 'Masjid Al Aqsa', 0, 4);

-- Q18 (ancienne Q16) — 2 POINTS
INSERT INTO questions (enonce, ordre, points) VALUES ('Quel Compagnon a été nommément cité dans le Coran ?', 18, 2);
SET @q := LAST_INSERT_ID();
INSERT INTO answers (question_id, texte, is_correct, ordre) VALUES
  (@q, 'Abou Bakr Al-Siddiq', 0, 1),
  (@q, 'Zayd Ibn Thabit', 0, 2),
  (@q, 'Zayd Ibn Haritha', 1, 3),
  (@q, 'Othman Ibn Affan', 0, 4);

-- L'état du quiz est créé par 01-schema.sql (status='disabled' par défaut)
