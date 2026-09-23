import cron from 'node-cron';
import config from './config/index.js';
import logger from './utils/logger.js';
import { connectMongo, disconnectMongo } from './loaders/mongo.js';
import { disconnectRedis } from './loaders/redis.js';
import ReportWorker from './workers/reportWorker.js';
import { enqueueReports } from './services/dispatch.service.js';

async function start() {
  await connectMongo();

  const worker = new ReportWorker();

  // cron lives here and not in the api, so two api instances cannot double-fire it
  const schedule = cron.schedule(
    config.cronSchedule,
    async () => {
      logger.info('cron', 'daily run firing');
      try {
        await enqueueReports();
      } catch (err) {
        logger.error('cron', 'enqueue failed', err.message);
      }
    },
    { timezone: config.cronTimezone }
  );

  logger.info('cron', `scheduled "${config.cronSchedule}" (${config.cronTimezone})`);

  async function shutdown(signal) {
    logger.info('worker', `${signal} received, finishing up`);

    schedule.stop();
    await worker.stop();
    await disconnectMongo();
    await disconnectRedis();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await worker.start();
}

start().catch((err) => {
  logger.error('worker', 'failed to start', err.message);
  process.exit(1);
});
