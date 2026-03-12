import User from '../models/User.js';
import logger from '../utils/logger.js';

const NEGATIVE_LABELS = new Set(['negative', 'very_negative']);
const THRESHOLD = parseInt(process.env.BURNOUT_NEGATIVE_STREAK_THRESHOLD || '5', 10);

export const updateBurnoutStatus = async (userId, moodLabel) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    if (NEGATIVE_LABELS.has(moodLabel)) {
      user.negativeStreak += 1;
    } else {
      user.negativeStreak = 0;
      user.burnoutFlagged = false;
      user.burnoutFlaggedAt = null;
    }

    if (user.negativeStreak >= THRESHOLD && !user.burnoutFlagged) {
      user.burnoutFlagged = true;
      user.burnoutFlaggedAt = new Date();
      logger.warn(`[Burnout] Risk flagged for user ${userId} — streak: ${user.negativeStreak}`);
    }

    await user.save();

    return {
      burnoutFlagged: user.burnoutFlagged,
      negativeStreak: user.negativeStreak,
      threshold: THRESHOLD,
    };
  } catch (error) {
    logger.error(`[Burnout] Update failed for user ${userId}: ${error.message}`);
    return null;
  }
};