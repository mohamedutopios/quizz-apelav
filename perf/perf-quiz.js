/**
 * Test de charge k6 — Quiz APELAV
 * Simule N participants effectuant le quiz simultanément.
 *
 * VARIABLES D'ENVIRONNEMENT :
 *   BASE_URL       URL de l'application (défaut: https://localhost)
 *   PARTICIPANTS   Nombre de participants à simuler (défaut: 500)
 *   RAMP_UP        Durée de la montée en charge (défaut: 60s)
 *   THINK_TIME_MIN Temps min entre 2 questions en secondes (défaut: 3)
 *   THINK_TIME_MAX Temps max entre 2 questions en secondes (défaut: 15)
 *
 * EXEMPLES :
 *   # 500 participants en local
 *   k6 run -e PARTICIPANTS=500 -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
 *
 *   # 1000 participants contre l'EC2
 *   k6 run -e PARTICIPANTS=1000 -e BASE_URL=https://quiz.exemple.fr perf-quiz.js
 *
 *   # Test rapide (50 VUs, lecture sans pause)
 *   k6 run -e PARTICIPANTS=50 -e THINK_TIME_MAX=1 -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
 *
 * PRÉREQUIS : le quiz doit être en mode "enabled" côté admin AVANT le test.
 * (le script run-load-test.sh fait ça automatiquement pour vous)
 *
 * IMPORTANT : chaque VU ne fait qu'UN SEUL quiz, comme un vrai participant.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE         = __ENV.BASE_URL       || 'https://localhost';
const PARTICIPANTS = parseInt(__ENV.PARTICIPANTS || '500', 10);
const RAMP_UP      = __ENV.RAMP_UP        || '60s';
const THINK_MIN    = parseFloat(__ENV.THINK_TIME_MIN || '3');
const THINK_MAX    = parseFloat(__ENV.THINK_TIME_MAX || '15');

const errors        = new Counter('apelav_errors');
const registerRate  = new Rate('apelav_register_success');
const loginRate     = new Rate('apelav_login_success');
const startRate     = new Rate('apelav_start_success');
const submitRate    = new Rate('apelav_submit_success');
const quizDuration  = new Trend('apelav_quiz_duration_ms');

export const options = {
  scenarios: {
    quiz_concurrent: {
      // executor "per-vu-iterations" : chaque VU fait exactement 1 itération
      executor: 'per-vu-iterations',
      vus: PARTICIPANTS,
      iterations: 1,
      maxDuration: '20m',
      gracefulStop: '60s',
    },
  },
  thresholds: {
    'http_req_failed':         ['rate<0.05'],
    'http_req_duration':       ['p(95)<1500', 'p(99)<3000'],
    'apelav_register_success': ['rate>0.95'],
    'apelav_login_success':    ['rate>0.95'],
    'apelav_start_success':    ['rate>0.95'],
    'apelav_submit_success':   ['rate>0.90'],
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function parseDuration(s) {
  const m = String(s).match(/^(\d+)([sm])$/);
  if (!m) return 60;
  return parseInt(m[1], 10) * (m[2] === 'm' ? 60 : 1);
}
const RAMP_UP_S = parseDuration(RAMP_UP);

function makeUser(vu) {
  const tag = `${vu}-${randomString(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
  return {
    nom:    `Load${tag}`,
    prenom: `Test${tag}`,
    password: 'LoadTest!2026',
  };
}

export default function () {
  // Étale l'inscription des VUs sur la durée de ramp-up
  // (sinon les 500 VUs partent en même temps à t=0)
  const stagger = Math.random() * RAMP_UP_S * 1000;
  sleep(stagger / 1000);

  const startedAt = Date.now();
  const user = makeUser(__VU);
  let resp;

  // --- 1. Inscription ---
  resp = http.post(`${BASE}/api/auth/register`, JSON.stringify({
    nom: user.nom, prenom: user.prenom, password: user.password,
  }), { headers: { 'Content-Type': 'application/json' }, tags: { step: 'register' } });
  const okReg = check(resp, { 'register 201': (r) => r.status === 201 });
  registerRate.add(okReg);
  if (!okReg) {
    errors.add(1);
    console.log(`[VU ${__VU}] register fail: ${resp.status} ${(resp.body || '').slice(0, 200)}`);
    return;
  }
  const suggestedUsername = resp.json('suggestedUsername');

  // --- 2. Login ---
  resp = http.post(`${BASE}/api/auth/login`, JSON.stringify({
    username: suggestedUsername, password: user.password,
  }), { headers: { 'Content-Type': 'application/json' }, tags: { step: 'login' } });
  const okLogin = check(resp, { 'login 200': (r) => r.status === 200 });
  loginRate.add(okLogin);
  if (!okLogin) {
    errors.add(1);
    console.log(`[VU ${__VU}] login fail: ${resp.status}`);
    return;
  }

  // --- 3. Récupération questions ---
  resp = http.get(`${BASE}/api/quiz/questions`, { tags: { step: 'questions' } });
  if (!check(resp, { 'questions 200': (r) => r.status === 200 })) {
    errors.add(1);
    console.log(`[VU ${__VU}] questions fail: ${resp.status}`);
    return;
  }
  const questions = resp.json('questions');

  // --- 4. Démarrage du quiz ---
  resp = http.post(`${BASE}/api/quiz/start`, '{}', {
    headers: { 'Content-Type': 'application/json' }, tags: { step: 'start' },
  });
  const okStart = check(resp, { 'start 200': (r) => r.status === 200 });
  startRate.add(okStart);
  if (!okStart) {
    if (resp.status === 423) {
      console.log(`[VU ${__VU}] start refusé (423) — le quiz n'est pas en mode 'enabled' côté admin`);
    } else {
      console.log(`[VU ${__VU}] start fail: ${resp.status} ${(resp.body || '').slice(0, 200)}`);
    }
    errors.add(1);
    return;
  }
  const attemptId = resp.json('attemptId');

  // --- 5. Réponses (avec pauses réalistes) ---
  for (const q of questions) {
    const answer = q.answers[Math.floor(Math.random() * q.answers.length)];
    resp = http.post(`${BASE}/api/quiz/answer`, JSON.stringify({
      attemptId, questionId: q.id, answerId: answer.id,
    }), { headers: { 'Content-Type': 'application/json' }, tags: { step: 'answer' } });
    if (!check(resp, { 'answer ok': (r) => r.status === 200 })) {
      errors.add(1);
    }
    sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
  }

  // --- 6. Soumission ---
  resp = http.post(`${BASE}/api/quiz/submit`, JSON.stringify({ attemptId }), {
    headers: { 'Content-Type': 'application/json' }, tags: { step: 'submit' },
  });
  const okSubmit = check(resp, { 'submit 200': (r) => r.status === 200 });
  submitRate.add(okSubmit);
  if (!okSubmit) {
    errors.add(1);
    console.log(`[VU ${__VU}] submit fail: ${resp.status}`);
  }

  quizDuration.add(Date.now() - startedAt);
}

// Résumé final personnalisé pour faciliter la lecture
export function handleSummary(data) {
  const m = data.metrics;
  const get = (name, stat) => {
    const v = m[name];
    if (!v) return '—';
    const val = v.values?.[stat];
    return typeof val === 'number' ? val.toFixed(2) : (val ?? '—');
  };
  const pct = (name) => {
    const r = m[name]?.values?.rate;
    if (typeof r !== 'number') return '—';
    return (r * 100).toFixed(1) + '%';
  };
  const count = (name) => m[name]?.values?.count ?? '—';

  const report = `
================================================================
 TEST DE CHARGE QUIZ APELAV — RÉSUMÉ
================================================================
 Participants simulés       : ${PARTICIPANTS}
 URL cible                  : ${BASE}
 Durée totale du test       : ${(data.state.testRunDurationMs / 1000).toFixed(1)}s
----------------------------------------------------------------
 Taux de succès par étape :
   - Inscription            : ${pct('apelav_register_success')}
   - Connexion              : ${pct('apelav_login_success')}
   - Démarrage quiz         : ${pct('apelav_start_success')}
   - Soumission finale      : ${pct('apelav_submit_success')}
----------------------------------------------------------------
 Latence HTTP (ms) :
   - médiane (p50)          : ${get('http_req_duration', 'med')}
   - 95e percentile         : ${get('http_req_duration', 'p(95)')}
   - 99e percentile         : ${get('http_req_duration', 'p(99)')}
   - max                    : ${get('http_req_duration', 'max')}
----------------------------------------------------------------
 Requêtes :
   - Total                  : ${count('http_reqs')}
   - Erreurs HTTP           : ${pct('http_req_failed')}
   - Erreurs applicatives   : ${count('apelav_errors')}
----------------------------------------------------------------
 Durée parcours complet (inscription → submit) :
   - médiane (p50)          : ${get('apelav_quiz_duration_ms', 'med')} ms
   - 95e percentile         : ${get('apelav_quiz_duration_ms', 'p(95)')} ms
================================================================
`;
  return {
    stdout: report,
    'perf-results.json': JSON.stringify(data, null, 2),
  };
}
