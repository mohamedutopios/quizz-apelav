import {
  registerUser,
  findUserByUsername,
  verifyPassword,
  validateRegisterInput,
  buildUsername,
} from '../services/auth.service.js';
import { config } from '../config.js';

export default async function authRoutes(fastify) {
  // -------- Inscription --------
  fastify.post(
    '/api/auth/register',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['nom', 'prenom', 'password'],
          properties: {
            nom: { type: 'string', minLength: 1, maxLength: 80 },
            prenom: { type: 'string', minLength: 1, maxLength: 80 },
            password: { type: 'string', minLength: 6, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const errors = validateRegisterInput(req.body);
      if (errors.length > 0) {
        return reply.code(400).send({ error: errors.join(', ') });
      }
      const user = await registerUser(req.body);
      // Brief : "Une fois inscrit, on est redirigé vers la page de login
      // avec le username (nom&prenom) pré-rempli"
      return reply.code(201).send({
        ok: true,
        username: user.username,
        suggestedUsername: buildUsername(req.body.nom, req.body.prenom),
      });
    }
  );

  // -------- Login --------
  fastify.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 200 },
            password: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const { username, password } = req.body;
      const user = await findUserByUsername(username.trim().toLowerCase());
      if (!user) {
        return reply.code(401).send({ error: 'Identifiants invalides' });
      }
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        return reply.code(401).send({ error: 'Identifiants invalides' });
      }
      const token = fastify.jwt.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
      });
      reply.setCookie('token', token, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60, // 12h
      });
      return {
        ok: true,
        user: {
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          username: user.username,
          role: user.role,
        },
      };
    }
  );

  // -------- Me --------
  fastify.get(
    '/api/auth/me',
    { preHandler: [fastify.authenticate] },
    async (req) => {
      return {
        user: {
          id: req.user.sub,
          username: req.user.username,
          role: req.user.role,
        },
      };
    }
  );

  // -------- Logout --------
  fastify.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });
}
