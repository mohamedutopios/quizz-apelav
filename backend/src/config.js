import 'dotenv/config';

const requiredInProd = ['JWT_SECRET', 'DB_PASSWORD'];

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Quiz
  quizDurationMs: parseInt(process.env.QUIZ_DURATION_MS || '600000', 10), // 10 min
  scoreMax: parseInt(process.env.SCORE_MAX || '20', 10),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_64_chars_minimum_please_____________________',
  jwtExpiresIn: '12h',

  // MySQL
  db: {
    host: process.env.DB_HOST || 'mysql',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'apelav',
    password: process.env.DB_PASSWORD || 'apelav_pwd',
    database: process.env.DB_NAME || 'apelav_quizz',
    connectionLimit: parseInt(process.env.DB_POOL || '40', 10),
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    keyPrefix: 'apelav:',
  },

  // Sécurité / bcrypt
  bcryptCost: parseInt(process.env.BCRYPT_COST || '12', 10),

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost').split(','),
};

if (config.env === 'production') {
  for (const k of requiredInProd) {
    if (!process.env[k]) {
      console.error(`[FATAL] Variable d'environnement manquante: ${k}`);
      process.exit(1);
    }
  }
}
