import { config } from '../config.js';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let error = err;
  if (err?.name === 'CastError') error = new AppError('Resource not found', 404);
  else if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    error = new AppError(`That ${field} is already in use`, 409);
  } else if (err?.name === 'ValidationError') {
    error = new AppError(Object.values(err.errors)[0]?.message || 'Invalid data', 400);
  } else if (err?.name === 'MulterError') {
    error = new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message, 400);
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError('Invalid JSON body', 400);
  } else if (err?.type === 'entity.too.large') {
    error = new AppError('Request body too large', 413);
  }

  if (!error.isOperational) {
    if (!config.isTest) console.error('[error]', err);
    return res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again later.' });
  }
  res.status(error.statusCode).json({ status: error.status, message: error.message });
}
