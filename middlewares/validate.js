import { validationResult } from 'express-validator';
import { sendError } from '../utils/apiResponse.js';

/**
 * runValidators — wraps an array of express-validator chains so they can be
 * used as a single middleware function (required for Express v5 compatibility).
 */
export const runValidators = (validations) => async (req, res, next) => {
  for (const validation of validations) {
    const result = await validation.run(req);
    if (!result.isEmpty()) break; // stop on first chain failure (optional)
  }
  next();
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

export default validate;
