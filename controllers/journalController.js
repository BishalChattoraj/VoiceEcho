import { body, param } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JournalEntry from '../models/JournalEntry.js';
import { transcribeAudio } from '../services/transcriptionService.js';
import { analyzeSentiment } from '../services/sentimentService.js';
import { generateAdvice } from '../services/aiAdviceService.js';
import { updateBurnoutStatus } from '../services/burnoutService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const textEntryValidation = [
  body('text').trim().notEmpty().withMessage('Text is required').isLength({ max: 5000 }),
  body('includeAdvice').optional().isBoolean(),
];

export const objectIdValidation = [
  param('id').isMongoId().withMessage('Invalid entry ID'),
];

const cleanupAudio = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) logger.error(`[Journal] Failed to delete audio: ${err.message}`);
    });
  }
};

const processEntry = async (userId, transcript, audioKey, includeAdvice) => {
  const { moodScore, moodLabel, sentimentDetails } = analyzeSentiment(transcript);
  const aiAdvice = includeAdvice ? await generateAdvice(transcript, moodLabel) : null;

  const entry = await JournalEntry.create({
    user: userId,
    audioKey: audioKey || null,
    transcript,
    moodScore,
    moodLabel,
    sentimentDetails,
    aiAdvice,
    burnoutContributor: ['negative', 'very_negative'].includes(moodLabel),
  });

  const burnout = await updateBurnoutStatus(userId, moodLabel);
  return { entry, burnout };
};

// @POST /api/journal/audio
export const submitAudioEntry = asyncHandler(async (req, res) => {
  if (!req.file) return sendError(res, 400, 'Audio file is required');

  const { path: filePath, mimetype, filename } = req.file;
  const includeAdvice = req.body.includeAdvice === 'true';

  try {
    const transcript = await transcribeAudio(filePath, mimetype);
    const { entry, burnout } = await processEntry(req.userId, transcript, filename, includeAdvice);
    return sendSuccess(res, 201, 'Journal entry created', { entry, burnout });
  } catch (error) {
    cleanupAudio(filePath);
    throw error;
  }
});

// @POST /api/journal/text
export const submitTextEntry = asyncHandler(async (req, res) => {
  const { text, includeAdvice } = req.body;
  const { entry, burnout } = await processEntry(req.userId, text, null, includeAdvice === true || includeAdvice === 'true');
  return sendSuccess(res, 201, 'Journal entry created', { entry, burnout });
});

// @GET /api/journal
export const getEntries = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const skip  = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    JournalEntry.find({ user: req.userId }).sort({ recordedAt: -1 }).skip(skip).limit(limit).select('-sentimentDetails'),
    JournalEntry.countDocuments({ user: req.userId }),
  ]);

  return sendSuccess(res, 200, 'Journal entries', {
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page < Math.ceil(total / limit) },
  });
});

// @GET /api/journal/:id
export const getEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({ _id: req.params.id, user: req.userId });
  if (!entry) return sendError(res, 404, 'Journal entry not found');
  return sendSuccess(res, 200, 'Journal entry', { entry });
});

// @PATCH /api/journal/:id
export const updateEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { userNote: req.body.userNote },
    { returnDocument: 'after', runValidators: true }
  );
  if (!entry) return sendError(res, 404, 'Journal entry not found');
  return sendSuccess(res, 200, 'Entry updated', { entry });
});

// @DELETE /api/journal/:id
export const deleteEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!entry) return sendError(res, 404, 'Journal entry not found');

  if (entry.audioKey) {
    cleanupAudio(path.join(__dirname, '../uploads/audio', entry.audioKey));
  }

  return sendSuccess(res, 200, 'Entry deleted');
});