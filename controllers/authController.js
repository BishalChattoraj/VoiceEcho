import { body } from 'express-validator';
import User from '../models/User.js';
import RefreshToken from '../models/refreshToken.js';
import {
  generateAccessToken, generateRefreshToken,
  rotateRefreshToken, revokeRefreshToken, revokeAllUserTokens,
} from '../services/tokenService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
};

export const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 60 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain a number'),
];

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// @POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return sendError(res, 409, 'Email already registered');

  const user = await User.create({ name, email, password });
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = await generateRefreshToken(user._id, req.headers['user-agent'], req.ip);

  res
    .cookie('accessToken',  accessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return sendSuccess(res, 201, 'Registration successful', { user, accessToken, refreshToken });
});

// @POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 401, 'Invalid email or password');
  }

  if (!user.isActive) return sendError(res, 403, 'Account is deactivated');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const accessToken  = generateAccessToken(user._id);
  const refreshToken = await generateRefreshToken(user._id, req.headers['user-agent'], req.ip);

  res
    .cookie('accessToken',  accessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return sendSuccess(res, 200, 'Login successful', { user, accessToken, refreshToken });
});

// @POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const oldToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!oldToken) return sendError(res, 401, 'Refresh token is required');

  const { newToken, userId } = await rotateRefreshToken(oldToken, req.headers['user-agent'], req.ip);
  const newAccessToken = generateAccessToken(userId);

  res
    .cookie('accessToken',  newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
    .cookie('refreshToken', newToken,        { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return sendSuccess(res, 200, 'Token refreshed', { accessToken: newAccessToken, refreshToken: newToken });
});

// @POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) await revokeRefreshToken(refreshToken);

  res.clearCookie('accessToken', COOKIE_OPTIONS).clearCookie('refreshToken', COOKIE_OPTIONS);
  return sendSuccess(res, 200, 'Logged out successfully');
});

// @POST /api/auth/logout-all
export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllUserTokens(req.userId);
  res.clearCookie('accessToken', COOKIE_OPTIONS).clearCookie('refreshToken', COOKIE_OPTIONS);
  return sendSuccess(res, 200, 'Logged out from all devices');
});

// @GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, 'User not found');
  return sendSuccess(res, 200, 'User profile', { user });
});