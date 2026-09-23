import config from './config/index.js';
import createApp from './app.js';
import logger from './utils/logger.js';
import { connectMongo, disconnectMongo } from './loaders/mongo.js';
import { getRedis, disconnectRedis } from './loaders/redis.js';

async function start() {
  await connectMongo();
  getRedis();

  const server = createApp().listen(config.port, () => {
    logger.info('api', `listening on http://localhost:${config.port}`);
  });

  async function shutdown(signal) {
    logger.info('api', `${signal} received, shutting down`);

    server.close();
    await disconnectMongo();
    await disconnectRedis();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('api', 'failed to start', err.message);
  process.exit(1);
});
