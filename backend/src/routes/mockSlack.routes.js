import { Router } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = Router();

// stands in for a real Slack webhook so the 429 retry path is testable locally.
// ?fail=1 forces a rejection, handy when demoing instead of waiting on the dice
router.post('/', (req, res) => {
  const forced = req.query.fail === '1';
  const shouldFail = forced || Math.random() < config.mockFailureRate;

  if (shouldFail) {
    logger.warn('mock-slack', `429 rejected${forced ? ' (forced)' : ''}, retry after ${config.mockRetryAfterSeconds}s`);
    return res
      .status(429)
      .set('Retry-After', String(config.mockRetryAfterSeconds))
      .json({ ok: false, error: 'rate_limited' });
  }

  const title = req.body?.blocks?.[0]?.text?.text || req.body?.text || 'no payload';
  logger.info('mock-slack', `200 accepted - ${title}`);

  res.status(200).json({ ok: true });
});

export default router;
