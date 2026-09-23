import config from '../config/index.js';
import logger from '../utils/logger.js';
import { connectMongo, disconnectMongo } from '../loaders/mongo.js';
import Client from '../models/Client.js';
import DailyStat from '../models/DailyStat.js';
import NotificationLog from '../models/NotificationLog.js';
import { yesterday, utcDay } from '../utils/dates.js';

// real webhooks come from .env, fall back to the local mock so the seed works out of the box
function webhookFor(index) {
  const fromEnv = process.env[`SLACK_WEBHOOK_${index}`];
  return fromEnv || `http://localhost:${config.port}/api/mock-slack-webhook`;
}

// five clients to match the five slack channels, shaped to cover the edge cases too
const clients = [
  { _id: 'client_1', name: 'Brand A', slack_notifications_enabled: true, slack_webhook_url: webhookFor(1) },
  { _id: 'client_2', name: 'Brand B', slack_notifications_enabled: true, slack_webhook_url: webhookFor(2) },
  { _id: 'client_3', name: 'Brand C', slack_notifications_enabled: true, slack_webhook_url: webhookFor(3) },
  // zero spend yesterday, checks the ROAS divide guard
  { _id: 'client_4', name: 'Brand D', slack_notifications_enabled: true, slack_webhook_url: webhookFor(4) },
  // opted out, must never appear in the pipeline output
  { _id: 'client_5', name: 'Brand E', slack_notifications_enabled: false, slack_webhook_url: webhookFor(5) },
];

// round numbers so ROAS is verifiable by hand
const statsPerDay = {
  client_1: [
    { channel: 'meta_ads', spend_cents: 50_000, revenue_cents: 150_000 },
    { channel: 'google_ads', spend_cents: 30_000, revenue_cents: 90_000 },
  ],
  client_2: [
    { channel: 'meta_ads', spend_cents: 120_000, revenue_cents: 180_000 },
    { channel: 'google_ads', spend_cents: 80_000, revenue_cents: 220_000 },
  ],
  client_3: [{ channel: 'meta_ads', spend_cents: 25_000, revenue_cents: 12_500 }],
  client_4: [{ channel: 'meta_ads', spend_cents: 0, revenue_cents: 40_000 }],
  client_5: [{ channel: 'meta_ads', spend_cents: 60_000, revenue_cents: 90_000 }],
};

function buildStats() {
  const rows = [];
  const base = yesterday();

  // three days back from yesterday
  for (let offset = 0; offset < 3; offset += 1) {
    const date = utcDay(base);
    date.setUTCDate(date.getUTCDate() - offset);

    for (const [clientId, channels] of Object.entries(statsPerDay)) {
      for (const channel of channels) {
        rows.push({ client_id: clientId, date, ...channel });
      }
    }
  }

  return rows;
}

async function seed() {
  await connectMongo();

  await Promise.all([
    Client.deleteMany({}),
    DailyStat.deleteMany({}),
    NotificationLog.deleteMany({}),
  ]);
  logger.info('seed', 'cleared existing collections');

  await Client.insertMany(clients);
  const stats = await DailyStat.insertMany(buildStats());

  logger.info('seed', `inserted ${clients.length} clients and ${stats.length} daily stats`);

  const usingMock = clients.filter((c) => c.slack_webhook_url.includes('mock-slack-webhook')).length;
  if (usingMock) {
    logger.warn('seed', `${usingMock} clients point at the mock webhook, set SLACK_WEBHOOK_1..5 in .env for real ones`);
  }

  await disconnectMongo();
}

seed().catch(async (err) => {
  logger.error('seed', 'failed', err.message);
  await disconnectMongo().catch(() => {});
  process.exit(1);
});
