import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { enqueueReports } from '../services/dispatch.service.js';
import { queueLength, processingLength } from '../services/queue.js';
import { yesterday } from '../utils/dates.js';

const router = Router();

// manual trigger, so the system is demoable without waiting for 9am
router.post(
  '/trigger',
  asyncHandler(async (req, res) => {
    const { date, force } = req.body || {};

    let reportDate = yesterday();
    if (date) {
      reportDate = new Date(date);
      if (Number.isNaN(reportDate.getTime())) {
        throw AppError.badRequest('date must be a valid ISO date');
      }
    }

    const summary = await enqueueReports({ reportDate, force: force === true });
    res.status(202).json({ success: true, data: summary });
  })
);

router.get(
  '/queue',
  asyncHandler(async (req, res) => {
    // a job being sent right now is still outstanding, so count both lists
    const [waiting, inFlight] = await Promise.all([queueLength(), processingLength()]);

    res.json({ success: true, data: { pending: waiting + inFlight, waiting, inFlight } });
  })
);

export default router;
