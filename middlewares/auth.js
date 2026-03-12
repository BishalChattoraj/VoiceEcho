import { verifyAccessToken } from '../services/tokenService.js';
import { sendError } from '../utils/apiResponse.js';

const protect = (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return sendError(res, 401, 'Authentication required. Please log in.');
    }

    const decoded = verifyAccessToken(token);
    req.userId = decoded.sub;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token expired. Please refresh.');
    }
    return sendError(res, 401, 'Invalid token. Please log in again.');
  }
};

export default protect;