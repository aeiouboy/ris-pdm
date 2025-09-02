/**
 * Production-Grade Error Handling Middleware
 * 
 * Comprehensive error handling system for production environment.
 * Provides structured error responses, logging, and monitoring.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const logger = require('../../utils/logger').child({ component: 'ProductionErrorHandler' });

/**
 * Error categories and their characteristics
 */
const ERROR_CATEGORIES = {
  AUTHENTICATION: {
    code: 'AUTH_ERROR',
    statusCode: 401,
    retryable: false,
    logLevel: 'warn'
  },
  AUTHORIZATION: {
    code: 'AUTHZ_ERROR',
    statusCode: 403,
    retryable: false,
    logLevel: 'warn'
  },
  VALIDATION: {
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    retryable: false,
    logLevel: 'info'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    statusCode: 404,
    retryable: false,
    logLevel: 'info'
  },
  RATE_LIMIT: {
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
    retryable: true,
    logLevel: 'warn'
  },
  EXTERNAL_API: {
    code: 'EXTERNAL_API_ERROR',
    statusCode: 502,
    retryable: true,
    logLevel: 'error'
  },
  DATABASE: {
    code: 'DATABASE_ERROR',
    statusCode: 503,
    retryable: true,
    logLevel: 'error'
  },
  CACHE: {
    code: 'CACHE_ERROR',
    statusCode: 500,
    retryable: true,
    logLevel: 'warn'
  },
  WEBHOOK: {
    code: 'WEBHOOK_ERROR',
    statusCode: 422,
    retryable: true,
    logLevel: 'error'
  },
  INTERNAL: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    retryable: false,
    logLevel: 'error'
  }
};

/**
 * Production Error Handler Class
 */
class ProductionErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.alertThresholds = {
      errorRate: 10, // errors per minute
      criticalErrors: 5 // critical errors per minute
    };
    this.monitoringWindow = 60000; // 1 minute
    
    // Start monitoring
    this.startErrorMonitoring();
  }

  /**
   * Main error handling middleware
   * @param {Error} err - Error object
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @param {Function} next - Next middleware function
   */
  handle(err, req, res, next) {
    // Ignore if response already sent
    if (res.headersSent) {
      return next(err);
    }

    try {
      const errorDetails = this.analyzeError(err, req);
      const errorResponse = this.formatErrorResponse(errorDetails, req);
      
      // Log error
      this.logError(errorDetails, req);
      
      // Track error for monitoring
      this.trackError(errorDetails);
      
      // Send response
      res.status(errorDetails.statusCode).json(errorResponse);
      
    } catch (handlerError) {
      // Fallback error handling
      logger.error('Error handler failed:', handlerError.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        code: 'HANDLER_ERROR',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    }
  }

  /**
   * Analyze error and categorize
   * @param {Error} err - Error object
   * @param {Request} req - Express request object
   * @returns {Object} Error details
   */
  analyzeError(err, req) {
    let category = ERROR_CATEGORIES.INTERNAL;
    let userMessage = 'An internal error occurred';
    let retryAfter = null;
    let details = {};

    // Categorize error based on type and message
    if (err.name === 'ValidationError' || err.code === 'VALIDATION_FAILED') {
      category = ERROR_CATEGORIES.VALIDATION;
      userMessage = 'Request validation failed';
      details.validationErrors = err.details || err.errors || [];
      
    } else if (err.name === 'UnauthorizedError' || err.code === 'AUTHENTICATION_FAILED') {
      category = ERROR_CATEGORIES.AUTHENTICATION;
      userMessage = 'Authentication required';
      
    } else if (err.name === 'ForbiddenError' || err.code === 'INSUFFICIENT_PERMISSIONS') {
      category = ERROR_CATEGORIES.AUTHORIZATION;
      userMessage = 'Insufficient permissions';
      
    } else if (err.name === 'NotFoundError' || err.code === 'RESOURCE_NOT_FOUND') {
      category = ERROR_CATEGORIES.NOT_FOUND;
      userMessage = 'Resource not found';
      
    } else if (err.code === 'RATE_LIMIT_EXCEEDED' || err.statusCode === 429) {
      category = ERROR_CATEGORIES.RATE_LIMIT;
      userMessage = 'Too many requests, please try again later';
      retryAfter = err.retryAfter || 60;
      
    } else if (err.message?.includes('Azure DevOps') || err.code === 'AZURE_API_ERROR') {
      category = ERROR_CATEGORIES.EXTERNAL_API;
      userMessage = 'External service temporarily unavailable';
      retryAfter = 30;
      details.service = 'Azure DevOps';
      
    } else if (err.code === 'CONNECTION_REFUSED' || err.code?.includes('DATABASE')) {
      category = ERROR_CATEGORIES.DATABASE;
      userMessage = 'Database service temporarily unavailable';
      retryAfter = 15;
      
    } else if (err.message?.includes('Redis') || err.code === 'CACHE_ERROR') {
      category = ERROR_CATEGORIES.CACHE;
      userMessage = 'Cache service error';
      
    } else if (err.code === 'WEBHOOK_ERROR' || req.path?.includes('webhook')) {
      category = ERROR_CATEGORIES.WEBHOOK;
      userMessage = 'Webhook processing failed';
      details.webhookEvent = err.webhookEvent || 'unknown';
    }

    return {
      originalError: err,
      category: category.code,
      statusCode: category.statusCode,
      userMessage,
      logLevel: category.logLevel,
      retryable: category.retryable,
      retryAfter,
      details,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || this.generateRequestId()
    };
  }

  /**
   * Format error response for client
   * @param {Object} errorDetails - Error details object
   * @param {Request} req - Express request object
   * @returns {Object} Formatted error response
   */
  formatErrorResponse(errorDetails, req) {
    const response = {
      success: false,
      error: errorDetails.category,
      message: errorDetails.userMessage,
      code: errorDetails.category,
      timestamp: errorDetails.timestamp,
      requestId: errorDetails.requestId
    };

    // Add retry information for retryable errors
    if (errorDetails.retryable && errorDetails.retryAfter) {
      response.retryAfter = errorDetails.retryAfter;
      response.retryable = true;
    }

    // Add validation details
    if (errorDetails.details.validationErrors?.length > 0) {
      response.validationErrors = errorDetails.details.validationErrors;
    }

    // Add service information for external errors
    if (errorDetails.details.service) {
      response.service = errorDetails.details.service;
    }

    // Add debug information in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        originalMessage: errorDetails.originalError.message,
        stack: errorDetails.stack,
        details: errorDetails.details
      };
    }

    // Add API documentation link for certain errors
    if ([ERROR_CATEGORIES.AUTHENTICATION.code, ERROR_CATEGORIES.VALIDATION.code].includes(errorDetails.category)) {
      response.documentation = `${req.protocol}://${req.get('host')}/docs/api`;
    }

    return response;
  }

  /**
   * Log error with appropriate level and context
   * @param {Object} errorDetails - Error details object
   * @param {Request} req - Express request object
   */
  logError(errorDetails, req) {
    const logData = {
      requestId: errorDetails.requestId,
      category: errorDetails.category,
      statusCode: errorDetails.statusCode,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.method !== 'GET' ? this.sanitizeLogData(req.body) : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      error: {
        message: errorDetails.originalError.message,
        name: errorDetails.originalError.name,
        code: errorDetails.originalError.code
      }
    };

    // Include stack trace for errors and critical issues
    if (['error', 'fatal'].includes(errorDetails.logLevel)) {
      logData.stack = errorDetails.originalError.stack;
    }

    // Log with appropriate level
    logger[errorDetails.logLevel](`${errorDetails.category}: ${errorDetails.userMessage}`, logData);
  }

  /**
   * Track error for monitoring and alerting
   * @param {Object} errorDetails - Error details object
   */
  trackError(errorDetails) {
    const minute = Math.floor(Date.now() / this.monitoringWindow);
    const key = `${minute}-${errorDetails.category}`;
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, 0);
    }
    
    this.errorCounts.set(key, this.errorCounts.get(key) + 1);
    
    // Check for alert thresholds
    this.checkAlertThresholds(minute, errorDetails);
  }

  /**
   * Check if error rates exceed alert thresholds
   * @param {number} minute - Current minute window
   * @param {Object} errorDetails - Error details object
   */
  checkAlertThresholds(minute, errorDetails) {
    // Count total errors in current minute
    let totalErrors = 0;
    let criticalErrors = 0;
    
    for (const [key, count] of this.errorCounts.entries()) {
      if (key.startsWith(`${minute}-`)) {
        totalErrors += count;
        
        if (key.includes('INTERNAL_ERROR') || key.includes('DATABASE_ERROR') || key.includes('EXTERNAL_API_ERROR')) {
          criticalErrors += count;
        }
      }
    }

    // Trigger alerts if thresholds exceeded
    if (totalErrors >= this.alertThresholds.errorRate) {
      logger.warn('High error rate alert', {
        totalErrors,
        threshold: this.alertThresholds.errorRate,
        minute,
        alertType: 'HIGH_ERROR_RATE'
      });
    }

    if (criticalErrors >= this.alertThresholds.criticalErrors) {
      logger.error('Critical error rate alert', {
        criticalErrors,
        threshold: this.alertThresholds.criticalErrors,
        minute,
        alertType: 'CRITICAL_ERROR_RATE'
      });
    }
  }

  /**
   * Start error monitoring and cleanup
   */
  startErrorMonitoring() {
    // Clean up old error counts every minute
    setInterval(() => {
      const currentMinute = Math.floor(Date.now() / this.monitoringWindow);
      const cutoffMinute = currentMinute - 10; // Keep last 10 minutes
      
      for (const key of this.errorCounts.keys()) {
        const minute = parseInt(key.split('-')[0]);
        if (minute < cutoffMinute) {
          this.errorCounts.delete(key);
        }
      }
    }, this.monitoringWindow);

    logger.info('Production error monitoring started');
  }

  /**
   * Get error statistics for monitoring
   * @returns {Object} Error statistics
   */
  getErrorStatistics() {
    const currentMinute = Math.floor(Date.now() / this.monitoringWindow);
    const stats = {
      currentMinute,
      totalErrors: 0,
      errorsByCategory: {},
      recentMinutes: []
    };

    // Aggregate last 5 minutes
    for (let i = 0; i < 5; i++) {
      const minute = currentMinute - i;
      let minuteErrors = 0;
      
      for (const [key, count] of this.errorCounts.entries()) {
        if (key.startsWith(`${minute}-`)) {
          const category = key.split('-')[1];
          stats.errorsByCategory[category] = (stats.errorsByCategory[category] || 0) + count;
          stats.totalErrors += count;
          minuteErrors += count;
        }
      }
      
      stats.recentMinutes.push({
        minute,
        errors: minuteErrors,
        timestamp: new Date(minute * this.monitoringWindow).toISOString()
      });
    }

    return stats;
  }

  /**
   * Sanitize sensitive data for logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeLogData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'pat'];
    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = '***SANITIZED***';
        }
      }
    };

    sanitize(sanitized);
    return sanitized;
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
const productionErrorHandler = new ProductionErrorHandler();

// Export middleware function
module.exports = {
  middleware: (err, req, res, next) => productionErrorHandler.handle(err, req, res, next),
  handler: productionErrorHandler,
  ERROR_CATEGORIES
};