import Redis from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  keyPrefix: config.redis.keyPrefix,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('[Redis] error:', err.message);
});

// Helpers présence
const PRESENCE_TTL_S = 90; // marqué online si vu dans les 90s

export async function markOnline(userId) {
  const key = `online:${userId}`;
  await redis.setex(key, PRESENCE_TTL_S, Date.now().toString());
}

export async function listOnline() {
  // Scan toutes les clés online:* (préfixées par keyPrefix par ioredis)
  // pattern doit inclure le keyPrefix car SCAN ne le préfixe pas auto
  const prefix = config.redis.keyPrefix;
  const pattern = `${prefix}online:*`;
  const stream = redis.scanStream({ match: pattern, count: 200 });
  const ids = [];
  for await (const keys of stream) {
    for (const k of keys) {
      const id = k.replace(`${prefix}online:`, '');
      ids.push(parseInt(id, 10));
    }
  }
  return ids.filter((n) => Number.isFinite(n));
}
