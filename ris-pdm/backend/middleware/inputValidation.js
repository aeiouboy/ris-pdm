/**
 * Input Validation Middleware using Zod
 * Prevents SQL injection, XSS, and enforces data constraints
 */

const { z } = require('zod');
const logger = require('../utils/logger');

/**
 * Security-focused string validation
 */
const createSecureString = (minLength = 1, maxLength = 255) => {
  return z.string()
    .min(minLength, `Must be at least ${minLength} characters`)
    .max(maxLength, `Must not exceed ${maxLength} characters`)
    .refine(
      (value) => !/<script|javascript:|data:|vbscript:/i.test(value),
      { message: 'Invalid content detected' }
    )
    .refine(
      (value) => !/(\s*(union|select|insert|update|delete|drop|create|alter)\s+)/i.test(value),
      { message: 'Invalid content detected' }
    )
    .transform((value) => value.trim());
};

/**
 * Email validation with additional security checks
 */
const secureEmail = z.string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .refine(
    (email) => !/[<>'"&]/.test(email),
    { message: 'Email contains invalid characters' }
  )
  .transform((email) => email.toLowerCase().trim());

/**
 * Common validation schemas
 */
const schemas = {
  // User validation
  user: z.object({
    email: secureEmail,
    name: createSecureString(1, 100),
    role: z.enum(['admin', 'user', 'viewer']).optional()
  }),

  // Authentication validation
  login: z.object({
    email: secureEmail,
    password: z.string()
      .min(1, 'Password required')
      .max(500, 'Password too long') // Prevent DoS via large passwords
  }),

  // Webhook validation
  webhook: z.object({
    eventType: z.string()
      .min(1, 'Event type required')
      .max(100, 'Event type too long')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid event type format'),
    subscriptionId: z.string().uuid().optional(),
    notificationId: z.number().int().positive().optional(),
    data: z.record(z.any()).optional()
  }),

  // Product/metric queries
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    project: createSecureString(1, 100).optional(),
    organization: createSecureString(1, 100).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional()
  }),

  // Export request validation  
  export: z.object({
    format: z.enum(['csv', 'json', 'pdf']),
    filters: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      projects: z.array(createSecureString(1, 100)).max(50).optional()
    }).optional(),
    options: z.object({
      includeHeaders: z.boolean().optional(),
      compress: z.boolean().optional()
    }).optional()
  })
};

/**
 * Create validation middleware for specific schema
 */
const createValidator = (schema, options = {}) => {
  const { 
    target = 'body', // 'body', 'query', 'params'
    strict = true,
    logErrors = true
  } = options;

  return (req, res, next) => {
    try {
      const data = req[target];
      
      // Parse and validate
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error?.errors?.map(err => ({
          field: err.path?.join('.') || 'unknown',
          message: err.message || 'Invalid input',
          code: err.code || 'invalid'
        })) || [{ field: 'unknown', message: 'Validation failed', code: 'invalid' }];

        if (logErrors) {
          logger.warn('Input validation failed', {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
            errors,
            securityEvent: 'MALICIOUS_INPUT_DETECTED'
          });
        }

        return res.status(400).json({
          error: 'Validation failed',
          details: strict ? errors : ['Invalid input format'],
          timestamp: new Date().toISOString()
        });
      }

      // Replace original data with validated and sanitized data
      req[target] = result.data;
      next();
      
    } catch (error) {
      logger.error('Validation middleware error:', error);
      
      return res.status(500).json({
        error: 'Internal validation error',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Pre-configured validators
 */
const validators = {
  user: createValidator(schemas.user),
  login: createValidator(schemas.login),
  webhook: createValidator(schemas.webhook),
  query: createValidator(schemas.query, { target: 'query' }),
  export: createValidator(schemas.export),
  
  // Custom validators for common use cases
  userUpdate: createValidator(schemas.user.partial()),
  strictUser: createValidator(schemas.user, { strict: true }),
  lenientQuery: createValidator(schemas.query.partial(), { 
    target: 'query', 
    strict: false 
  })
};

/**
 * Body size limiting middleware (prevents DoS via large payloads)
 */
const createBodySizeLimit = (maxSize = '1mb') => {
  return (req, res, next) => {
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length']);
      const maxBytes = parseSize(maxSize);
      
      if (contentLength > maxBytes) {
        logger.warn('Request body too large', {
          endpoint: req.originalUrl,
          contentLength,
          maxBytes,
          ip: req.ip,
          securityEvent: 'LARGE_PAYLOAD_DETECTED'
        });
        
        return res.status(413).json({
          error: 'Payload too large',
          maxSize: maxSize,
          timestamp: new Date().toISOString()
        });
      }
    }
    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (sizeStr) => {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/i);
  if (!match) return 1024 * 1024; // Default 1MB
  
  const [, num, unit] = match;
  const size = parseFloat(num);
  
  switch (unit.toLowerCase()) {
    case 'kb': return size * 1024;
    case 'mb': return size * 1024 * 1024;
    case 'gb': return size * 1024 * 1024 * 1024;
    default: return size;
  }
};

/**
 * Content-Type validation middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }
    
    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(400).json({
        error: 'Content-Type header required',
        timestamp: new Date().toISOString()
      });
    }
    
    const isValid = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isValid) {
      logger.warn('Invalid content type', {
        contentType,
        allowed: allowedTypes,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      
      return res.status(415).json({
        error: 'Unsupported Media Type',
        allowed: allowedTypes,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = {
  schemas,
  validators,
  createValidator,
  createSecureString,
  secureEmail,
  createBodySizeLimit,
  validateContentType,
  parseSize
};