import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import RefreshToken from '../models/refreshToken.js';
import logger from '../utils/logger.js';

export const generateAccessToken = (userId) => {
  return jwt.sign(
    { sub: userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
};

export const generateRefreshToken = async (userId, userAgent = null, ipAddress = null) => {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await RefreshToken.create({ user: userId, token, expiresAt, userAgent, ipAddress });
  return token;
};

export const rotateRefreshToken = async (oldToken, userAgent = null, ipAddress = null) => {
  const tokenDoc = await RefreshToken.findOne({ token: oldToken });

  if (!tokenDoc) throw new Error('Refresh token not found');

  if (tokenDoc.revoked) {
    logger.warn(`Token reuse detected for user ${tokenDoc.user}. Revoking all sessions.`);
    await RefreshToken.updateMany({ user: tokenDoc.user }, { revoked: true });
    throw new Error('Token reuse detected. All sessions terminated.');
  }

  if (tokenDoc.expiresAt < new Date()) throw new Error('Refresh token expired');

  const newToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  tokenDoc.revoked = true;
  tokenDoc.replacedByToken = newToken;
  await tokenDoc.save();

  await RefreshToken.create({ user: tokenDoc.user, token: newToken, expiresAt, userAgent, ipAddress });

  return { newToken, userId: tokenDoc.user };
};

export const revokeRefreshToken = async (token) => {
  await RefreshToken.findOneAndUpdate({ token }, { revoked: true });
};

export const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId, revoked: false }, { revoked: true });
};