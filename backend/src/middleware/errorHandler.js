import config from '../config/index.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// express treats a 4-arg handler as the error handler, so `next` has to stay
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error('api', `${req.method} ${req.originalUrl}`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.isOperational ? err.message : 'Something went wrong',
      ...(config.env === 'development' && { stack: err.stack }),
    },
  });
}
