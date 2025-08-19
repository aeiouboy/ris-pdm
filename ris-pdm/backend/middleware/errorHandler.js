const logger = require('../utils/logger');

/**
 * Global error handling middleware
 * This should be the last middleware in the stack
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      code: 'INVALID_ID',
      statusCode: 404,
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = {
      message,
      code: 'DUPLICATE_FIELD',
      statusCode: 400,
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = {
      message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      message,
      code: 'INVALID_TOKEN',
      statusCode: 401,
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      message,
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
    };
  }

  // Azure AD authentication errors
  if (err.name === 'AuthenticationError') {
    error = {
      message: err.message || 'Authentication failed',
      code: 'AUTHENTICATION_FAILED',
      statusCode: 401,
    };
  }

  // Azure DevOps API errors
  if (err.name === 'AzureDevOpsError') {
    error = {
      message: err.message || 'Azure DevOps API error',
      code: 'AZURE_DEVOPS_ERROR',
      statusCode: err.statusCode || 500,
    };
  }

  // Rate limiting errors
  if (err.type === 'entity.too.large') {
    error = {
      message: 'Request entity too large',
      code: 'REQUEST_TOO_LARGE',
      statusCode: 413,
    };
  }

  // Default error response
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = error.code || 'INTERNAL_ERROR';

  const errorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Include request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;