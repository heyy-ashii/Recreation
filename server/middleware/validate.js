import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      return next(new AppError(field ? `${field}: ${issue.message}` : issue.message, 400));
    }
    if (source === 'body') req.body = result.data;
    else req.validated = { ...(req.validated || {}), [source]: result.data };
    next();
  };

// Accepts a Mongo ObjectId (24 hex) or a Sheet UUID (36 chars with dashes).
export const objectId = z.string().trim().regex(/^([a-f\d]{24}|[a-f\d-]{36})$/i, 'Invalid id');
export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
export const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, dot or underscore');
export const name = z.string().trim().min(1, 'Name is required').max(80);
