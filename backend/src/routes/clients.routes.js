import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import AppError from '../utils/AppError.js';
import Client from '../models/Client.js';
import NotificationLog from '../models/NotificationLog.js';

const router = Router();

// accepts the local mock too, otherwise testing would need a real slack workspace
function isValidWebhook(url) {
  if (typeof url !== 'string') return false;
  if (url === '') return true;

  return /^https:\/\/hooks\.slack\.com\/services\/.+/.test(url) || /^https?:\/\/localhost(:\d+)?\//.test(url);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clients = await Client.find().sort({ _id: 1 }).lean();
    res.json({ success: true, data: clients });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id).lean();
    if (!client) throw AppError.notFound('Client not found');

    res.json({ success: true, data: client });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { slack_webhook_url, slack_notifications_enabled } = req.body;
    const update = {};

    if (slack_webhook_url !== undefined) {
      if (!isValidWebhook(slack_webhook_url)) {
        throw AppError.badRequest('Webhook must be a https://hooks.slack.com/services/... URL');
      }
      update.slack_webhook_url = slack_webhook_url.trim();
    }

    if (slack_notifications_enabled !== undefined) {
      if (typeof slack_notifications_enabled !== 'boolean') {
        throw AppError.badRequest('slack_notifications_enabled must be a boolean');
      }
      update.slack_notifications_enabled = slack_notifications_enabled;
    }

    if (!Object.keys(update).length) {
      throw AppError.badRequest('Nothing to update');
    }

    const client = await Client.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!client) throw AppError.notFound('Client not found');

    res.json({ success: true, data: client });
  })
);

router.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const logs = await NotificationLog.find({ client_id: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: logs });
  })
);

export default router;
