/**
 * Test de charge k6 — Simule 500 utilisateurs effectuant le quiz APELAV
 * en concurrence sur une fenêtre courte (le pire cas selon le brief).
 *
 * Scénarios :
 *   1. ramp-up    : montée à 500 VUs en 1 min
 *   2. soutenu    : 500 VUs pendant 5 min
 *   3. descente   : retour à 0 en 30s
 *
 * Chaque VU :
 *   - s'inscrit (nom/prenom unique)
 *   - se connecte
 *   - démarre le quiz
 *   - répond aux 17 questions (pause aléatoire ~5-15s entre chaque)
 *   - soumet
 *
 * Lancement local (depuis ./perf) :
 *   k6 run -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
 *
 * Lancement contre l'EC2 :
 *   k6 run -e BASE_URL=https://quiz.exemple.fr perf-quiz.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'https://localhost';

const errors        = new Counter('apelav_errors');
const submitRate    = new Rate('apelav_submit_success');
const quizDuration  = new Trend('apelav_quiz_duration_ms');

export const options = {
  scenarios: {
    quiz_concurrent: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },   // montée à 500 VUs
        { duration: '5m', target: 500 },   // plateau
        { duration: '30s', target: 0 },    // descente
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    // SLO cibles
    'http_req_failed':    ['rate<0.01'],                  // <1% d'erreurs HTTP
    'http_req_duration':  ['p(95)<800', 'p(99)<2000'],    // 95% sous 800ms
    'apelav_submit_success': ['rate>0.95'],               // >95% des quiz aboutissent
  },
  // Pas de vérif TLS pour le test local self-signed
  insecureSkipTLSVerify: true,
  // Pour les cookies de session
  noConnectionReuse: false,
};

function makeUser(vu, iter) {
  // garantit l'unicité du couple (nom, prenom) entre VUs et itérations
  const tag = `${vu}${iter}${randomString(5, 'abcdefghijklmnopqrstuvwxyz')}`;
  return {
    nom:    `Test${tag}`,
    prenom: `User${tag}`,
    password: 'Test123!Pass',
  };
}

export default function () {
  const startedAt = Date.now();
  const user = makeUser(__VU, __ITER);
  const jar = http.cookieJar();

  // --- 1. Inscription ---
  let resp;
  group('register', () => {
    resp = http.post(`${BASE}/api/auth/register`, JSON.stringify({
      nom: user.nom, prenom: user.prenom, password: user.password,
    }), { headers: { 'Content-Type': 'application/json' } });
    if (!check(resp, { 'register 201': (r) => r.status === 201 })) {
      errors.add(1); submitRate.add(false);
      return;
    }
  });

  // Brief : "Une fois inscrit, on est redirigé vers la page de login
  // avec le username (nom&prenom) pré-rempli" → on récupère ce username
  const suggestedUsername = resp.json('suggestedUsername');

  // --- 2. Login ---
  group('login', () => {
    resp = http.post(`${BASE}/api/auth/login`, JSON.stringify({
      username: suggestedUsername, password: user.password,
    }), { headers: { 'Content-Type': 'application/json' } });
    if (!check(resp, { 'login 200': (r) => r.status === 200 })) {
      errors.add(1); submitRate.add(false);
      return;
    }
  });

  // --- 3. Récupération questions ---
  let questions;
  group('questions', () => {
    resp = http.get(`${BASE}/api/quiz/questions`);
    if (!check(resp, { 'questions 200': (r) => r.status === 200 })) {
      errors.add(1); submitRate.add(false);
      return;
    }
    questions = resp.json('questions');
  });

  // --- 4. Démarrage du quiz ---
  let attemptId;
  group('start', () => {
    resp = http.post(`${BASE}/api/quiz/start`);
    if (!check(resp, { 'start 200': (r) => r.status === 200 })) {
      errors.add(1); submitRate.add(false);
      return;
    }
    attemptId = resp.json('attemptId');
  });

  // --- 5. Réponses (avec pauses réalistes) ---
  group('answer', () => {
    for (const q of questions) {
      const answer = q.answers[Math.floor(Math.random() * q.answers.length)];
      resp = http.post(`${BASE}/api/quiz/answer`, JSON.stringify({
        attemptId, questionId: q.id, answerId: answer.id,
      }), { headers: { 'Content-Type': 'application/json' } });
      check(resp, { 'answer ok': (r) => r.status === 200 }) || errors.add(1);
      // pause utilisateur : entre 3 et 15 secondes par question
      sleep(3 + Math.random() * 12);
    }
  });

  // --- 6. Soumission ---
  group('submit', () => {
    resp = http.post(`${BASE}/api/quiz/submit`, JSON.stringify({ attemptId }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = check(resp, { 'submit 200': (r) => r.status === 200 });
    submitRate.add(ok);
    if (!ok) errors.add(1);
  });

  quizDuration.add(Date.now() - startedAt);
}
