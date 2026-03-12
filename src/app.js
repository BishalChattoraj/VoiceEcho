import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes      from '../routes/authRoutes.js';
import journalRoutes   from '../routes/journalRoutes.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';
import errorHandler    from '../middlewares/errorHandler.js';
import { globalLimiter } from '../middlewares/rateLimiter.js';
import logger from '../utils/logger.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Security ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr:  ["'none'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "blob:"],
      mediaSrc:       ["'self'", "blob:"],
      connectSrc:     ["'self'"],
      workerSrc:      ["'self'", "blob:"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Global Rate Limiter ───────────────────────────────────
app.use(globalLimiter);

// ── Body Parsers ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── HTTP Request Logging ──────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'VoiceEcho API is running',
    timestamp: new Date().toISOString(),
    disclaimer: 'VoiceEcho is not a medical diagnosis tool. Always consult a professional.',
  });
});

// ── Static Frontend ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/journal',   journalRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── SPA Fallback ──────────────────────────────────────────
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── API 404 Handler ───────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Centralized Error Handler ─────────────────────────────
app.use(errorHandler);

export default app;