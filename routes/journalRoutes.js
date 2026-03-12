import { Router } from 'express';
import {
  submitAudioEntry, submitTextEntry,
  getEntries, getEntry, updateEntry, deleteEntry,
  textEntryValidation, objectIdValidation,
} from '../controllers/journalController.js';
import protect from '../middlewares/auth.js';
import validate, { runValidators } from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.use(protect);

router.post('/audio',  uploadLimiter, upload.single('audio'), submitAudioEntry);
router.post('/text',   runValidators(textEntryValidation), validate, submitTextEntry);
router.get('/',        getEntries);
router.get('/:id',     runValidators(objectIdValidation), validate, getEntry);
router.patch('/:id',   runValidators(objectIdValidation), validate, updateEntry);
router.delete('/:id',  runValidators(objectIdValidation), validate, deleteEntry);

export default router;