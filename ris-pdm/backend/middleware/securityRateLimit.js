/**
 * Enhanced Security Rate Limiting Middleware
 * Implements tiered rate limiting with Redis backend
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Initialize Redis client for rate limiting
 */
const initializeRedisClient = async () => {
  if (redisClient) {
    return redisClient;
  }

  // Skip Redis in test environment to avoid connection issues
  if (process.env.NODE_ENV === 'test') {
    logger.info('⏭️ Skipping Redis connection in test environment');
    return null;
  }

  try {
    redisClient = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_RATE_LIMIT_DB || 1, // Separate DB for rate limiting
    });

    await redisClient.connect();
    
    redisClient.on('error', (err) => {
      logger.error('Redis rate limiting client error:', err);
    });

    logger.info('✅ Redis rate limiting client connected');
    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to connect Redis rate limiting client:', error);
    return null;
  }
};

/**
 * Rate limiting configuration for different endpoint tiers
 */
const rateLimitConfigs = {
  auth: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
      error: 'Too many authentication attempts, please try again later',
      retryAfter: '60 seconds',
      rateLimited: true
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip + ':' + (req.body?.email || 'unknown');
    },
  },
  
  webhooks: {
    windowMs: 60 * 1000, // 1 minute  
    max: 100, // 100 requests per minute
    message: {
      error: 'Webhook rate limit exceeded',
      retryAfter: '60 seconds',
      rateLimited: true
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  api: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 requests per hour
    message: {
      error: 'API rate limit exceeded, please try again later',
      retryAfter: '1 hour',
      rateLimited: true
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes
    message: {
      error: 'Too many requests, please try again later',
      retryAfter: '15 minutes',
      rateLimited: true
    },
    standardHeaders: true,
    legacyHeaders: false,
  }
};

/**
 * Create rate limiter for specific tier
 */
const createRateLimit = async (tier, customOptions = {}) => {
  const config = rateLimitConfigs[tier];
  if (!config) {
    throw new Error(`Unknown rate limit tier: ${tier}`);
  }

  const redisClient = await initializeRedisClient();
  
  const options = {
    ...config,
    ...customOptions,
    // Use Redis store if available, fallback to memory store
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: `rate_limit:${tier}:`,
    }) : undefined,
    
    // Security event logging (updated for express-rate-limit v6+)
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        tier,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        limit: options.max,
        windowMs: options.windowMs,
        securityEvent: 'RATE_LIMIT_EXCEEDED'
      });
      
      res.status(429).json({
        error: options.message?.error || 'Too many requests',
        retryAfter: options.message?.retryAfter,
        rateLimited: true,
        timestamp: new Date().toISOString()
      });
    },
    
    // Skip health checks and favicon
    skip: (req) => {
      return req.path === '/health' || 
             req.path === '/favicon.ico' ||
             req.path === '/api/health';
    },
  };

  return rateLimit(options);
};

/**
 * Pre-configured rate limiters
 */
const createAuthLimiter = () => createRateLimit('auth');
const createWebhookLimiter = () => createRateLimit('webhooks');  
const createApiLimiter = () => createRateLimit('api');
const createGeneralLimiter = () => createRateLimit('general');

/**
 * Smart rate limiter that applies different limits based on endpoint
 */
const createSmartRateLimit = async () => {
  const authLimiter = await createAuthLimiter();
  const webhookLimiter = await createWebhookLimiter();
  const apiLimiter = await createApiLimiter();
  const generalLimiter = await createGeneralLimiter();

  return (req, res, next) => {
    if (req.path.startsWith('/api/auth/')) {
      return authLimiter(req, res, next);
    } else if (req.path.startsWith('/api/webhooks/')) {
      return webhookLimiter(req, res, next);
    } else if (req.path.startsWith('/api/')) {
      return apiLimiter(req, res, next);
    } else {
      return generalLimiter(req, res, next);
    }
  };
};

/**
 * Graceful shutdown - close Redis connections
 */
const shutdown = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('✅ Redis rate limiting client disconnected');
  }
};

module.exports = {
  createRateLimit,
  createAuthLimiter,
  createWebhookLimiter, 
  createApiLimiter,
  createGeneralLimiter,
  createSmartRateLimit,
  initializeRedisClient,
  rateLimitConfigs,
  shutdown
};