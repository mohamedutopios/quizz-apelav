import {
  getRanking,
  getParticipants,
  getDashboardStats,
  listQuestionsAdmin,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAttemptDetails,
} from '../services/admin.service.js';
import { getQuizStatus, setQuizStatus } from '../services/settings.service.js';

export default async function adminRoutes(fastify) {
  // Tous les endpoints admin protégés
  const adminGuard = {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')],
  };

  fastify.get('/api/admin/dashboard', adminGuard, async () => {
    const stats = await getDashboardStats();
    const settings = await getQuizStatus();
    return { ...stats, quizStatus: settings.status, activatedAt: settings.activatedAt };
  });

  // Récupérer / changer l'état du quiz
  fastify.get('/api/admin/status', adminGuard, async () => {
    return getQuizStatus();
  });

  fastify.post(
    '/api/admin/status',
    {
      ...adminGuard,
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['disabled', 'enabled', 'closed'] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await setQuizStatus(req.body.status, req.user.sub);
      } catch (err) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    }
  );

  fastify.get('/api/admin/ranking', adminGuard, async () => {
    return { ranking: await getRanking() };
  });

  fastify.get('/api/admin/participants', adminGuard, async () => {
    return { participants: await getParticipants() };
  });

  fastify.get('/api/admin/questions', adminGuard, async () => {
    return { questions: await listQuestionsAdmin() };
  });

  fastify.post(
    '/api/admin/questions',
    {
      ...adminGuard,
      schema: {
        body: {
          type: 'object',
          required: ['enonce', 'answers'],
          properties: {
            enonce: { type: 'string', minLength: 3, maxLength: 1000 },
            active: { type: 'boolean' },
            answers: {
              type: 'array',
              minItems: 2,
              maxItems: 6,
              items: {
                type: 'object',
                required: ['texte', 'isCorrect'],
                properties: {
                  texte: { type: 'string', minLength: 1, maxLength: 500 },
                  isCorrect: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await createQuestion(req.body);
      } catch (err) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    }
  );

  fastify.put(
    '/api/admin/questions/:id',
    {
      ...adminGuard,
      schema: {
        params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } } },
        body: {
          type: 'object',
          required: ['enonce', 'answers'],
          properties: {
            enonce: { type: 'string', minLength: 3, maxLength: 1000 },
            active: { type: 'boolean' },
            answers: {
              type: 'array',
              minItems: 2,
              maxItems: 6,
              items: {
                type: 'object',
                required: ['texte', 'isCorrect'],
                properties: {
                  texte: { type: 'string', minLength: 1, maxLength: 500 },
                  isCorrect: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await updateQuestion(req.params.id, req.body);
      } catch (err) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    }
  );

  fastify.delete(
    '/api/admin/questions/:id',
    {
      ...adminGuard,
      schema: { params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } } } },
    },
    async (req, reply) => {
      try {
        return await deleteQuestion(req.params.id);
      } catch (err) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    }
  );

  // Détail des réponses d'une tentative (pour contestations)
  fastify.get(
    '/api/admin/attempts/:attemptId',
    {
      ...adminGuard,
      schema: { params: { type: 'object', properties: { attemptId: { type: 'integer', minimum: 1 } } } },
    },
    async (req, reply) => {
      try {
        return await getAttemptDetails(req.params.attemptId);
      } catch (err) {
        if (err.statusCode) return reply.code(err.statusCode).send({ error: err.message });
        throw err;
      }
    }
  );
}
