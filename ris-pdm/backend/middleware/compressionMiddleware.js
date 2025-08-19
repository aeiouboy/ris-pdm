/**
 * Enhanced Compression Middleware
 * Optimizes API response compression with intelligent algorithms and caching
 */

const compression = require('compression');
const zlib = require('zlib');
const logger = require('../utils/logger');

// Content type configurations for different compression strategies
const COMPRESSION_CONFIG = {
  // High compression for JSON APIs (most dashboard data)
  json: {
    level: 6, // Good balance between speed and compression ratio
    threshold: 1024, // 1KB minimum
    algorithms: ['gzip', 'deflate', 'br']
  },
  
  // Medium compression for HTML/text
  text: {
    level: 4,
    threshold: 1024,
    algorithms: ['gzip', 'deflate']
  },
  
  // Light compression for already compressed content
  binary: {
    level: 1,
    threshold: 4096, // 4KB minimum for binary
    algorithms: ['gzip']
  },
  
  // No compression for very small responses or pre-compressed content
  skip: {
    level: 0,
    threshold: Infinity,
    algorithms: []
  }
};

// Content types that should not be compressed
const SKIP_COMPRESSION = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/zip',
  'application/gzip',
  'application/x-rar-compressed',
  'application/pdf' // Usually already compressed
]);

// Content types that benefit most from compression
const HIGH_COMPRESSION_TYPES = new Set([
  'application/json',
  'application/javascript',
  'text/javascript',
  'text/css',
  'text/html',
  'text/xml',
  'application/xml',
  'text/plain',
  'image/svg+xml'
]);

/**
 * Determine compression strategy based on content type and size
 */
function getCompressionStrategy(contentType, contentLength) {
  if (SKIP_COMPRESSION.has(contentType)) {
    return COMPRESSION_CONFIG.skip;
  }
  
  if (HIGH_COMPRESSION_TYPES.has(contentType)) {
    return COMPRESSION_CONFIG.json;
  }
  
  if (contentType.startsWith('text/')) {
    return COMPRESSION_CONFIG.text;
  }
  
  if (contentLength && contentLength > 50000) { // 50KB
    return COMPRESSION_CONFIG.binary;
  }
  
  return COMPRESSION_CONFIG.json; // Default
}

/**
 * Custom compression filter
 */
function shouldCompress(req, res) {
  // Skip compression for specific routes if needed
  if (req.path.includes('/health') || req.path.includes('/metrics')) {
    return false;
  }
  
  // Get content type
  const contentType = res.get('Content-Type') || '';
  const contentLength = parseInt(res.get('Content-Length')) || 0;
  
  // Get compression strategy
  const strategy = getCompressionStrategy(contentType, contentLength);
  
  // Check if content is large enough to benefit from compression
  if (contentLength > 0 && contentLength < strategy.threshold) {
    return false;
  }
  
  // Use default compression filter for other checks
  return compression.filter(req, res);
}

/**
 * Enhanced compression middleware with performance monitoring
 */
function createCompressionMiddleware(performanceMonitor) {
  const compressionMiddleware = compression({
    level: 6, // Default compression level
    threshold: 1024, // 1KB minimum
    filter: shouldCompress,
    
    // Custom compression function for better control
    strategy: zlib.constants.Z_DEFAULT_STRATEGY,
    
    // Memory level optimization
    memLevel: 8, // Default is 8, range is 1-9
    
    // Window size optimization (affects memory usage and compression ratio)
    windowBits: 15 // Default is 15, range is 8-15
  });

  // Return enhanced middleware with monitoring
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    let originalSize = 0;
    let compressedSize = 0;
    
    // Override res.send to capture metrics
    res.send = function(data) {
      if (data && typeof data === 'string') {
        originalSize = Buffer.byteLength(data, 'utf8');
      } else if (data && Buffer.isBuffer(data)) {
        originalSize = data.length;
      } else if (data) {
        originalSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
      }
      
      return originalSend.call(this, data);
    };
    
    // Monitor response finish to capture compressed size
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      compressedSize = parseInt(res.get('Content-Length')) || 0;
      
      if (originalSize > 0 && performanceMonitor) {
        const compressionRatio = originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
        const savingsKB = (originalSize - compressedSize) / 1024;
        
        // Track compression performance
        const compressionMetric = {
          url: req.path,
          method: req.method,
          originalSize,
          compressedSize,
          compressionRatio: compressionRatio * 100,
          savingsKB,
          duration,
          contentType: res.get('Content-Type') || 'unknown',
          encoding: res.get('Content-Encoding') || 'none'
        };
        
        // Log significant compressions in development
        if (process.env.NODE_ENV === 'development' && savingsKB > 1) {
          logger.debug(`📦 Compression: ${req.path} - ${originalSize}B → ${compressedSize}B (${(compressionRatio * 100).toFixed(1)}% saved)`);
        }
        
        // Emit compression event for monitoring
        try {
          const monitor = typeof performanceMonitor === 'function' ? performanceMonitor() : performanceMonitor;
          if (monitor && typeof monitor.emit === 'function') {
            monitor.emit('compression', compressionMetric);
          }
        } catch (error) {
          // Silently handle performance monitoring errors to avoid crashing the server
          logger.debug('Performance monitoring error:', error.message);
        }
      }
    });
    
    // Apply compression middleware
    compressionMiddleware(req, res, next);
  };
}

/**
 * Response caching middleware for static/semi-static content
 */
function createCacheMiddleware() {
  const cache = new Map();
  const MAX_CACHE_SIZE = 100; // Limit cache entries
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip caching for authenticated requests with user-specific data
    if (req.headers.authorization) {
      return next();
    }
    
    // Generate cache key
    const cacheKey = `${req.method}:${req.path}:${req.query ? JSON.stringify(req.query) : ''}`;
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug(`📦 Cache hit: ${cacheKey}`);
      
      // Set cached headers
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
      
      return res.send(cached.data);
    }
    
    // Override res.send to cache response
    const originalSend = res.send;
    res.send = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data) {
        // Limit cache size
        if (cache.size >= MAX_CACHE_SIZE) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        
        // Cache response
        cache.set(cacheKey, {
          data,
          headers: {
            'Content-Type': res.get('Content-Type'),
            'Cache-Control': 'public, max-age=300', // 5 minutes
            'ETag': `"${Date.now()}"` // Simple ETag
          },
          timestamp: Date.now()
        });
        
        // Set cache headers
        res.set('Cache-Control', 'public, max-age=300');
        res.set('ETag', `"${Date.now()}"`);
        
        logger.debug(`📦 Cached response: ${cacheKey}`);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Content negotiation middleware for optimal response format
 */
function createContentNegotiationMiddleware() {
  return (req, res, next) => {
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const userAgent = req.get('User-Agent') || '';
    
    // Prefer Brotli for modern browsers
    if (acceptEncoding.includes('br') && !userAgent.includes('Safari/')) {
      res.set('Vary', 'Accept-Encoding');
    }
    
    // Set optimal cache headers for API responses
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'private, max-age=0, must-revalidate');
      res.set('Vary', 'Accept-Encoding, Authorization');
    }
    
    next();
  };
}

/**
 * Response size monitoring middleware
 */
function createResponseSizeMonitor(performanceMonitor) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const contentLength = parseInt(res.get('Content-Length')) || 0;
      const duration = Date.now() - startTime;
      
      // Log large responses
      if (contentLength > 1024 * 1024) { // 1MB
        logger.warn(`📊 Large response: ${req.path} - ${(contentLength / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Track response size metrics
      if (performanceMonitor) {
        try {
          const monitor = typeof performanceMonitor === 'function' ? performanceMonitor() : performanceMonitor;
          if (monitor && typeof monitor.emit === 'function') {
            monitor.emit('responseSize', {
              url: req.path,
              method: req.method,
              size: contentLength,
              duration,
              statusCode: res.statusCode
            });
          }
        } catch (error) {
          // Silently handle performance monitoring errors to avoid crashing the server
          logger.debug('Performance monitoring error:', error.message);
        }
      }
    });
    
    next();
  };
}

/**
 * Create comprehensive compression and optimization middleware stack
 */
function createOptimizedCompressionStack(performanceMonitor = null) {
  return [
    createContentNegotiationMiddleware(),
    createResponseSizeMonitor(performanceMonitor),
    createCompressionMiddleware(performanceMonitor),
    // Note: Cache middleware disabled for now to prevent issues with real-time data
    // createCacheMiddleware()
  ];
}

/**
 * Get compression statistics
 */
function getCompressionStats() {
  return {
    strategies: Object.keys(COMPRESSION_CONFIG),
    skipTypes: Array.from(SKIP_COMPRESSION),
    highCompressionTypes: Array.from(HIGH_COMPRESSION_TYPES),
    configuration: COMPRESSION_CONFIG
  };
}

module.exports = {
  createOptimizedCompressionStack,
  createCompressionMiddleware,
  createCacheMiddleware,
  createContentNegotiationMiddleware,
  createResponseSizeMonitor,
  getCompressionStats,
  shouldCompress
};