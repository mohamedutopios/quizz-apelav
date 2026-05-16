import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

import { config } from './config.js';
import { ping as dbPing } from './db/pool.js';
import authRoutes from './routes/auth.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = Fastify({
  logger: {
    level: config.env === 'production' ? 'info' : 'debug',
    transport:
      config.env === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
  },
  trustProxy: true, // car derrière nginx
  bodyLimit: 1024 * 256, // 256KB suffit largement
});

// Tolère application/json vide (POST sans body) → body = undefined
// Sinon Fastify renvoie 400 "Unexpected end of JSON input"
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body, done) => {
    if (body === '' || body == null) return done(null, undefined);
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
);

// ----------- Plugins -----------
await app.register(helmet, {
  contentSecurityPolicy: false, // CSP gérée côté nginx
});
await app.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});
await app.register(cookie);
await app.register(jwt, {
  secret: config.jwtSecret,
  cookie: { cookieName: 'token', signed: false },
});

// Rate-limit global, partagé via Redis pour fonctionner avec plusieurs workers
const rlRedis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
});
await app.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
  redis: rlRedis,
  nameSpace: 'rl:',
  allowList: (req) => req.url === '/api/health',
});

// ----------- Décorateurs auth -----------
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Non authentifié' });
  }
});

app.decorate('requireRole', (role) => async (req, reply) => {
  if (req.user?.role !== role) {
    reply.code(403).send({ error: 'Accès refusé' });
  }
});

// ----------- Health -----------
app.get('/api/health', async () => {
  let db = false;
  try { db = await dbPing(); } catch {}
  return { ok: true, db, env: config.env, ts: Date.now() };
});

// ----------- Routes -----------
await app.register(authRoutes);
await app.register(quizRoutes);
await app.register(adminRoutes);

// ----------- Error handler -----------
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err }, 'Unhandled error');
  if (err.validation) {
    return reply.code(400).send({ error: 'Requête invalide', details: err.validation });
  }
  const code = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  reply.code(code).send({
    error: code === 500 ? 'Erreur serveur' : err.message,
  });
});

// ----------- Start -----------
const start = async () => {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Backend prêt sur ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    app.log.info(`${sig} reçu, arrêt propre...`);
    try {
      await app.close();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  });
}

start();
