import { Router } from 'express';
import healthRoutes from './health.routes.js';
import clientRoutes from './clients.routes.js';
import reportRoutes from './reports.routes.js';
import mockSlackRoutes from './mockSlack.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/clients', clientRoutes);
router.use('/reports', reportRoutes);
router.use('/mock-slack-webhook', mockSlackRoutes);

export default router;
