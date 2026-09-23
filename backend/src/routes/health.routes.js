import { Router } from 'express';
import { isMongoHealthy } from '../loaders/mongo.js';
import { isRedisHealthy } from '../loaders/redis.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mongo = isMongoHealthy();
    const redis = await isRedisHealthy();
    const healthy = mongo && redis;

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        status: healthy ? 'ok' : 'degraded',
        mongo: mongo ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
        uptimeSeconds: Math.floor(process.uptime()),
      },
    });
  })
);

export default router;
