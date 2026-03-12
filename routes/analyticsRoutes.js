import { Router } from 'express';
import {
  weeklyAnalytics, allTimeAnalytics, burnoutStatus,
} from '../controllers/analyticsController.js';
import protect from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/weekly',         weeklyAnalytics);
router.get('/all-time',       allTimeAnalytics);
router.get('/burnout-status', burnoutStatus);

export default router;