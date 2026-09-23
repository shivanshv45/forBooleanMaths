import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import NotificationLog, { LOG_STATUS } from '../models/NotificationLog.js';
import { popJob, requeueJob, ackJob, recoverOrphans } from '../services/queue.js';
import { sendReport, SEND_RESULT } from '../services/slack.client.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default class ReportWorker {
  constructor() {
    // blmove blocks its connection, so the worker needs one of its own
    this.redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    this.running = false;
  }

  async start() {
    this.running = true;

    // a previous run may have died holding a job, claim those back before doing anything new
    const recovered = await recoverOrphans(this.redis);
    if (recovered) {
      logger.warn('worker', `recovered ${recovered} job(s) left behind by a previous run`);
    }

    logger.info('worker', `started, ${config.rateLimitMs}ms between sends`);

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        // one bad job should not take the worker down
        logger.error('worker', 'loop error', err.message);
        await sleep(config.rateLimitMs);
      }
    }

    logger.info('worker', 'loop stopped');
  }

  async tick() {
    // clock starts before the pop, so the redis round-trips for popping and acking
    // count toward the gap too - otherwise the real spacing drifts under 1s
    const startedAt = Date.now();
    const popped = await popJob(this.redis);
    if (!popped) return;

    const { job, raw } = popped;
    const { result, waitMs, error } = await sendReport(job);

    if (result === SEND_RESULT.RATE_LIMITED) {
      await this.handleRateLimited(job, raw, waitMs);
      return;
    }

    if (result === SEND_RESULT.OK) {
      await this.handleSuccess(job);
    } else {
      await this.handleFailure(job, raw, error);
    }

    // the job is only dropped from the processing list once its outcome is written down
    await ackJob(raw, this.redis);

    // subtract the time the request took, otherwise the real gap is 1s plus latency
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(0, config.rateLimitMs - elapsed));
  }

  async handleRateLimited(job, raw, waitMs) {
    logger.warn('worker', `429 for ${job.client_id}, pausing ${waitMs}ms and requeueing`);

    // attempts is not incremented, a rate limit is our problem and not the job's fault
    await requeueJob(job, this.redis);
    await ackJob(raw, this.redis);
    await NotificationLog.findByIdAndUpdate(job.log_id, { last_error: 'rate limited, retrying' });

    // the whole loop waits, the limit applies to us and not to one client
    await sleep(waitMs);
  }

  async handleSuccess(job) {
    await NotificationLog.findByIdAndUpdate(job.log_id, {
      status: LOG_STATUS.SENT,
      attempts: job.attempts + 1,
      sent_at: new Date(),
      last_error: null,
    });

    logger.info('worker', `sent to ${job.client_id} (${job.client_name})`);
  }

  async handleFailure(job, raw, error) {
    const attempts = job.attempts + 1;

    if (attempts >= config.maxAttempts) {
      await NotificationLog.findByIdAndUpdate(job.log_id, {
        status: LOG_STATUS.FAILED,
        attempts,
        last_error: error,
      });

      logger.error('worker', `giving up on ${job.client_id} after ${attempts} attempts - ${error}`);
      return;
    }

    await requeueJob({ ...job, attempts }, this.redis);
    await NotificationLog.findByIdAndUpdate(job.log_id, { attempts, last_error: error });

    logger.warn('worker', `attempt ${attempts} failed for ${job.client_id} - ${error}, requeued`);
  }

  async stop() {
    this.running = false;
    await this.redis.quit();
  }
}
