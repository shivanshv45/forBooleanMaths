import config from '../config/index.js';
import { getRedis } from '../loaders/redis.js';

const QUEUE_KEY = config.queueName;
// jobs live here between being picked up and being confirmed done
const PROCESSING_KEY = `${config.queueName}:processing`;

// jobs go in at the head and come off the tail, so the queue stays FIFO
export function pushJob(job, client = getRedis()) {
  return client.lpush(QUEUE_KEY, JSON.stringify(job));
}

// retries go back on the pop end so the same report is tried again straight away,
// rather than waiting behind everyone else and arriving badly out of order
export function requeueJob(job, client = getRedis()) {
  return client.rpush(QUEUE_KEY, JSON.stringify(job));
}

// blmove instead of brpop - the job is moved to the processing list rather than
// deleted, so a crash mid-send leaves it recoverable instead of losing it.
// returns the raw string too, because acking needs the exact bytes redis holds
export async function popJob(client, timeoutSeconds = 5) {
  const raw = await client.blmove(QUEUE_KEY, PROCESSING_KEY, 'RIGHT', 'LEFT', timeoutSeconds);
  if (!raw) return null;

  return { job: JSON.parse(raw), raw };
}

// only called once slack has confirmed, or the job has been requeued/failed for good.
// lrem by value, so a concurrent worker's in-flight job is never removed by mistake
export function ackJob(raw, client = getRedis()) {
  return client.lrem(PROCESSING_KEY, 1, raw);
}

// anything still in the processing list at startup was owned by a worker that died
// mid-send, so put it back on the queue rather than leaving it stranded
export async function recoverOrphans(client = getRedis()) {
  let recovered = 0;

  // rpoplpush one at a time, so a crash during recovery cannot drop the batch either
  while (await client.rpoplpush(PROCESSING_KEY, QUEUE_KEY)) {
    recovered += 1;
  }

  return recovered;
}

export function processingLength(client = getRedis()) {
  return client.llen(PROCESSING_KEY);
}

export function queueLength(client = getRedis()) {
  return client.llen(QUEUE_KEY);
}

export function clearQueue(client = getRedis()) {
  return client.del(QUEUE_KEY, PROCESSING_KEY);
}

// NX so a double-fired cron or an impatient click cannot queue the same report twice
export async function claimReport(clientId, dateKey, client = getRedis()) {
  const key = `sent:${dateKey}:${clientId}`;
  const result = await client.set(key, '1', 'EX', 86_400, 'NX');
  return result === 'OK';
}

export function releaseClaim(clientId, dateKey, client = getRedis()) {
  return client.del(`sent:${dateKey}:${clientId}`);
}
