import { getWeeklyAnalytics, getAllTimeAnalytics } from '../services/analyticsService.js';
import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// @GET /api/analytics/weekly
export const weeklyAnalytics = asyncHandler(async (req, res) => {
  const data = await getWeeklyAnalytics(req.userId);
  return sendSuccess(res, 200, 'Weekly analytics', data);
});

// @GET /api/analytics/all-time
export const allTimeAnalytics = asyncHandler(async (req, res) => {
  const data = await getAllTimeAnalytics(req.userId);
  return sendSuccess(res, 200, 'All-time analytics', { months: data });
});

// @GET /api/analytics/burnout-status
export const burnoutStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('burnoutFlagged negativeStreak burnoutFlaggedAt');
  if (!user) return sendError(res, 404, 'User not found');

  return sendSuccess(res, 200, 'Burnout status', {
    burnoutFlagged:   user.burnoutFlagged,
    negativeStreak:   user.negativeStreak,
    burnoutFlaggedAt: user.burnoutFlaggedAt,
    threshold: parseInt(process.env.BURNOUT_NEGATIVE_STREAK_THRESHOLD || '5', 10),
    disclaimer: 'This is not a medical diagnosis. Please consult a healthcare professional if you are experiencing distress.',
  });
});