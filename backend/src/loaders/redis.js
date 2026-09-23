import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let client = null;

export function getRedis() {
  if (client) return client;

  client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  client.on('connect', () => logger.info('redis', 'connected'));
  client.on('error', (err) => logger.error('redis', 'connection error', err.message));

  return client;
}

export async function disconnectRedis() {
  if (!client) return;

  await client.quit();
  client = null;
  logger.info('redis', 'disconnected');
}

// maxRetriesPerRequest: null means a ping queues forever when redis is down,
// so race it against a timeout or /health hangs instead of reporting down
export async function isRedisHealthy(timeoutMs = 1000) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(false), timeoutMs).unref();
  });

  const ping = getRedis()
    .ping()
    .then((reply) => reply === 'PONG')
    .catch(() => false);

  return Promise.race([ping, timeout]);
}
