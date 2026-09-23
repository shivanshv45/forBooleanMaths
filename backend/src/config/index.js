import dotenv from 'dotenv';

dotenv.config();

// throw at boot instead of getting `undefined` deep inside a query later
function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function num(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${key} must be a number, got "${raw}"`);
  }
  return parsed;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: num('PORT', 4000),

  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),

  queueName: process.env.QUEUE_NAME || 'slack:reports',

  // one message per second is Slack's webhook limit
  rateLimitMs: num('RATE_LIMIT_MS', 1000),
  maxAttempts: num('MAX_ATTEMPTS', 5),
  // used when a 429 comes back without a usable Retry-After
  defaultRetryAfterMs: num('DEFAULT_RETRY_AFTER_MS', 5000),

  cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * *',
  cronTimezone: process.env.CRON_TIMEZONE || 'Asia/Kolkata',

  // crank this up when demoing the retry path
  mockFailureRate: num('MOCK_FAILURE_RATE', 0.2),
  mockRetryAfterSeconds: num('MOCK_RETRY_AFTER_SECONDS', 3),

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export default config;
