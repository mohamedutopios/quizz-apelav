import {
  getQuizForParticipant,
  startOrResumeAttempt,
  saveAnswer,
  submitAttempt,
  getAttemptState,
} from '../services/quiz.service.js';
import { config } from '../config.js';
import { markOnline } from '../db/redis.js';
import { getQuizStatus } from '../services/settings.service.js';

export default async function quizRoutes(fastify) {
  // Présence : pingée à chaque requête authentifiée du quiz
  fastify.addHook('preHandler', async (req) => {
    if (req.user?.sub && req.user.role === 'user') {
      // fire-and-forget
      markOnline(req.user.sub).catch(() => {});
    }
  });

  // Statut public du quiz (utilisé par le front pour afficher la page d'attente)
  fastify.get(
    '/api/quiz/status',
    { preHandler: [fastify.authenticate] },
    async () => {
      const s = await getQuizStatus();
      return { status: s.status, activatedAt: s.activatedAt };
    }
  );

  // Renvoie les questions (sans is_correct)
  fastify.get(
    '/api/quiz/questions',
    { preHandler: [fastify.authenticate, fastify.requireRole('user')] },
    async () => {
      const questions = await getQuizForParticipant();
      return { questions, durationMs: config.quizDurationMs, scoreMax: config.scoreMax };
    }
  );

  // Démarre ou reprend la tentative
  fastify.post(
    '/api/quiz/start',
    { preHandler: [fastify.authenticate, fastify.requireRole('user')] },
    async (req, reply) => {
      try {
        const att = await startOrResumeAttempt(req.user.sub);
        return att;
      } catch (err) {
        if (err.statusCode === 410) {
          return reply.code(410).send({ error: err.message, ...(err.payload || {}) });
        }
        if (err.statusCode === 423) {
          return reply.code(423).send({ error: err.message, ...(err.payload || {}) });
        }
        if (err.statusCode === 403) {
          return reply.code(403).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // État courant (pour reprise après refresh)
  fastify.get(
    '/api/quiz/state',
    { preHandler: [fastify.authenticate, fastify.requireRole('user')] },
    async (req) => {
      const state = await getAttemptState(req.user.sub);
      return { state };
    }
  );

  // Sauvegarde d'une réponse
  fastify.post(
    '/api/quiz/answer',
    {
      preHandler: [fastify.authenticate, fastify.requireRole('user')],
      schema: {
        body: {
          type: 'object',
          required: ['attemptId', 'questionId', 'answerId'],
          properties: {
            attemptId: { type: 'integer', minimum: 1 },
            questionId: { type: 'integer', minimum: 1 },
            answerId: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const r = await saveAnswer({
          userId: req.user.sub,
          attemptId: req.body.attemptId,
          questionId: req.body.questionId,
          answerId: req.body.answerId,
        });
        return r;
      } catch (err) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    }
  );

  // Soumission finale
  fastify.post(
    '/api/quiz/submit',
    {
      preHandler: [fastify.authenticate, fastify.requireRole('user')],
      schema: {
        body: {
          type: 'object',
          required: ['attemptId'],
          properties: { attemptId: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (req, reply) => {
      try {
        const r = await submitAttempt({
          userId: req.user.sub,
          attemptId: req.body.attemptId,
        });
        return r;
      } catch (err) {
        if (err.statusCode) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
