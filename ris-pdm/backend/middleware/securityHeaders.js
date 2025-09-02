/**
 * Enhanced Security Headers Middleware
 * Configures Helmet with production-ready security policies
 */

const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Environment-based security configuration
 */
const getSecurityConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          // Remove unsafe-inline in production, use nonces/hashes instead
          ...(isProduction ? [] : ["'unsafe-inline'"])
        ],
        scriptSrc: [
          "'self'",
          // Only allow specific scripts in production
          ...(isProduction ? [] : ["'unsafe-eval'"]) // For development only
        ],
        connectSrc: [
          "'self'",
          "wss:", // WebSocket connections
          "https:", // HTTPS API calls
          ...(isDevelopment ? ["ws:", "http:"] : []) // Development only
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      },
      reportOnly: isDevelopment // Report violations without blocking in dev
    },

    // HTTP Strict Transport Security (HSTS)
    hsts: isProduction ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false // Set to true only after testing
    } : false,

    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: "cross-origin" // Allow cross-origin requests for API
    },

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for API compatibility

    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups"
    },

    // Referrer Policy
    referrerPolicy: {
      policy: ["no-referrer", "strict-origin-when-cross-origin"]
    },

    // Permissions Policy (formerly Feature Policy)
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      magnetometer: [],
      gyroscope: [],
      fullscreen: ["'self'"],
      payment: [],
      usb: []
    }
  };
};

/**
 * Create enhanced helmet middleware
 */
const createSecurityHeaders = () => {
  const config = getSecurityConfig();
  
  return helmet({
    // Use our custom CSP configuration
    contentSecurityPolicy: config.contentSecurityPolicy,
    
    // HSTS for production only
    hsts: config.hsts,
    
    // Cross-origin policies
    crossOriginResourcePolicy: config.crossOriginResourcePolicy,
    crossOriginEmbedderPolicy: config.crossOriginEmbedderPolicy,
    crossOriginOpenerPolicy: config.crossOriginOpenerPolicy,
    
    // Referrer policy
    referrerPolicy: config.referrerPolicy,
    
    // Permissions policy
    permissionsPolicy: config.permissionsPolicy,
    
    // Additional security headers
    noSniff: true, // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    xssFilter: true, // X-XSS-Protection: 1; mode=block
    
    // Remove default helmet headers that might leak info
    hidePoweredBy: true, // Remove X-Powered-By
    
    // DNS prefetch control
    dnsPrefetchControl: {
      allow: false
    },
    
    // IE no open
    ieNoOpen: true,
    
    // Origin agent cluster
    originAgentCluster: true
  });
};

/**
 * Remove server fingerprinting headers
 */
const removeServerHeaders = () => {
  return (req, res, next) => {
    // Remove Express signature
    res.removeHeader('X-Powered-By');
    
    // Remove server header or replace with generic
    res.removeHeader('Server');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Custom security header to identify our security measures
    res.setHeader('X-Security-Level', 'enhanced');
    
    next();
  };
};

/**
 * CORS security enhancement
 */
const createSecureCORS = () => {
  const allowedOrigins = [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ].filter(Boolean);

  return (req, res, next) => {
    const origin = req.headers.origin;
    
    if (req.method === 'OPTIONS') {
      // Preflight request handling
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(200).end();
      } else {
        // Reject unknown origins
        logger.warn('CORS preflight request from unknown origin', {
          origin,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          securityEvent: 'CORS_VIOLATION'
        });
        return res.status(403).json({
          error: 'Origin not allowed by CORS policy',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Regular request handling
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    next();
  };
};

/**
 * Trust proxy configuration for production
 */
const configureTrustProxy = (app) => {
  if (process.env.NODE_ENV === 'production') {
    // Trust first proxy (load balancer, CDN, etc.)
    app.set('trust proxy', 1);
    logger.info('✅ Trust proxy configured for production');
  } else if (process.env.TRUST_PROXY) {
    // Allow manual configuration
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
    logger.info(`✅ Trust proxy configured: ${process.env.TRUST_PROXY}`);
  }
};

/**
 * Security event logging middleware
 */
const securityEventLogger = () => {
  return (req, res, next) => {
    // Log potential security events
    const suspiciousPatterns = [
      /\.\.\//, // Directory traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript protocol
      /data:.*script/i, // Data URL scripts
      /vbscript:/i // VBScript protocol
    ];
    
    const fullUrl = req.originalUrl || req.url;
    const body = JSON.stringify(req.body || {});
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(fullUrl) || pattern.test(body)
    );
    
    if (isSuspicious) {
      logger.warn('Suspicious request detected', {
        method: req.method,
        url: fullUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        securityEvent: 'SUSPICIOUS_REQUEST'
      });
    }
    
    next();
  };
};

/**
 * Initialize all security headers and configurations
 */
const initializeSecurity = (app) => {
  // Configure trust proxy first
  configureTrustProxy(app);
  
  // Apply security headers
  app.use(createSecurityHeaders());
  
  // Remove server fingerprinting
  app.use(removeServerHeaders());
  
  // Enhanced CORS handling
  app.use(createSecureCORS());
  
  // Security event logging
  app.use(securityEventLogger());
  
  // Disable Express signature globally
  app.disable('x-powered-by');
  
  logger.info('✅ Security headers and policies initialized');
};

module.exports = {
  createSecurityHeaders,
  removeServerHeaders,
  createSecureCORS,
  configureTrustProxy,
  securityEventLogger,
  initializeSecurity,
  getSecurityConfig
};