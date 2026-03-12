import { Router } from 'express';
import {
  register, login, refresh, logout, logoutAll, getMe,
  registerValidation, loginValidation,
} from '../controllers/authController.js';
import protect from '../middlewares/auth.js';
import validate, { runValidators } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register',   authLimiter, runValidators(registerValidation), validate, register);
router.post('/login',      authLimiter, runValidators(loginValidation),    validate, login);
router.post('/refresh',    authLimiter, refresh);
router.post('/logout',     logout);
router.post('/logout-all', protect, logoutAll);
router.get('/me',          protect, getMe);

export default router;