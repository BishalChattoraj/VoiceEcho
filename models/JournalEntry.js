import mongoose from 'mongoose';

export const MOOD_LABELS = Object.freeze([
  'very_negative', 'negative', 'neutral', 'positive', 'very_positive',
]);

const journalEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    audioKey:   { type: String, default: null },
    transcript: {
      type: String,
      required: [true, 'Transcript is required'],
      maxlength: [5000, 'Transcript too long'],
      trim: true,
    },
    moodScore: { type: Number, required: true, min: -1, max: 1 },
    moodLabel: { type: String, enum: MOOD_LABELS, required: true },
    sentimentDetails: {
      score:       { type: Number,   default: 0 },
      comparative: { type: Number,   default: 0 },
      positive:    { type: [String], default: [] },
      negative:    { type: [String], default: [] },
    },
    aiAdvice:           { type: String,  default: null },
    burnoutContributor: { type: Boolean, default: false },
    userNote: {
      type: String,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: null,
      trim: true,
    },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

journalEntrySchema.index({ user: 1, recordedAt: -1 });
journalEntrySchema.index({ user: 1, moodLabel: 1 });

export default mongoose.model('JournalEntry', journalEntrySchema);