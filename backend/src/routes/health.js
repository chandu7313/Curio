/**
 * Curio Backend — Health Check Route
 *
 * @module backend/routes/health
 */

import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/', healthController.getHealth);

export default router;

