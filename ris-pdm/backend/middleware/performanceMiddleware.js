/**
 * Performance Monitoring Middleware
 * Tracks request performance metrics and integrates with PerformanceMonitorService
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Create performance monitoring middleware
 */
function createPerformanceMiddleware(performanceMonitor) {
  return (req, res, next) => {
    // Skip monitoring for health checks and static files
    if (req.path === '/health' || req.path.startsWith('/static')) {
      return next();
    }

    // Generate unique request ID
    const requestId = uuidv4();
    req.requestId = requestId;
    
    // Add request ID to response headers for debugging
    res.set('X-Request-ID', requestId);
    
    // Capture request metadata
    const metadata = {
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: req.get('Content-Length'),
      acceptEncoding: req.get('Accept-Encoding'),
      referer: req.get('Referer')
    };
    
    // Start timing
    if (performanceMonitor && typeof performanceMonitor.startRequest === 'function') {
      performanceMonitor.startRequest(requestId, metadata);
    }
    
    // Monitor response
    res.on('finish', () => {
      if (performanceMonitor && typeof performanceMonitor.endRequest === 'function') {
        // Additional response metadata
        const responseData = {
          contentLength: res.get('Content-Length'),
          contentType: res.get('Content-Type'),
          contentEncoding: res.get('Content-Encoding'),
          cacheControl: res.get('Cache-Control')
        };
        
        performanceMonitor.endRequest(requestId, res.statusCode, responseData);
      }
    });
    
    // Monitor for request timeout/abort
    req.on('close', () => {
      if (req.aborted && performanceMonitor && typeof performanceMonitor.endRequest === 'function') {
        performanceMonitor.endRequest(requestId, 499, { aborted: true }); // Client closed connection
      }
    });
    
    next();
  };
}

/**
 * Database operation timing middleware
 */
function createDatabaseMiddleware(performanceMonitor) {
  return {
    // Wrapper for database operations
    wrapDatabaseOperation: (operation, operationName) => {
      return async (...args) => {
        if (!performanceMonitor) {
          return await operation(...args);
        }
        
        const startTime = Date.now();
        
        try {
          const result = await operation(...args);
          const duration = Date.now() - startTime;
          
          performanceMonitor.trackDatabaseOperation(operationName, duration, {
            args: args.length,
            resultSize: result ? JSON.stringify(result).length : 0
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          performanceMonitor.trackDatabaseOperation(operationName, duration, {
            args: args.length,
            error: error.message
          });
          
          throw error;
        }
      };
    }
  };
}

/**
 * Cache operation timing middleware
 */
function createCacheMiddleware(performanceMonitor) {
  return {
    // Wrapper for cache operations
    wrapCacheOperation: (operation, operationName) => {
      return async (...args) => {
        if (!performanceMonitor) {
          return await operation(...args);
        }
        
        const startTime = Date.now();
        let hit = false;
        
        try {
          const result = await operation(...args);
          const duration = Date.now() - startTime;
          
          // Determine if it was a cache hit (result exists for get operations)
          if (operationName.includes('get') && result !== null && result !== undefined) {
            hit = true;
          }
          
          performanceMonitor.trackCacheOperation(operationName, hit, duration, {
            args: args.length,
            resultSize: result ? JSON.stringify(result).length : 0
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          performanceMonitor.trackCacheOperation(operationName, false, duration, {
            args: args.length,
            error: error.message
          });
          
          throw error;
        }
      };
    }
  };
}

/**
 * API endpoint performance monitoring
 */
function createAPIEndpointMiddleware(performanceMonitor) {
  const endpointMetrics = new Map();
  
  return (req, res, next) => {
    if (!performanceMonitor) {
      return next();
    }
    
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Track endpoint-specific metrics
      if (!endpointMetrics.has(endpoint)) {
        endpointMetrics.set(endpoint, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          errors: 0
        });
      }
      
      const metrics = endpointMetrics.get(endpoint);
      metrics.count++;
      metrics.totalTime += duration;
      metrics.minTime = Math.min(metrics.minTime, duration);
      metrics.maxTime = Math.max(metrics.maxTime, duration);
      
      if (res.statusCode >= 400) {
        metrics.errors++;
      }
      
      // Log slow endpoints
      if (duration > 2000) { // 2 seconds
        logger.warn(`🐌 Slow API endpoint: ${endpoint} took ${duration}ms`);
      }
      
      // Emit endpoint performance event
      try {
        const monitor = typeof performanceMonitor === 'function' ? performanceMonitor() : performanceMonitor;
        if (monitor && typeof monitor.emit === 'function') {
          monitor.emit('endpointPerformance', {
            endpoint,
            duration,
            statusCode: res.statusCode,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // Silently handle performance monitoring errors to avoid crashing the server
        logger.debug('Performance monitoring error:', error.message);
      }
    });
    
    // Make endpoint metrics available
    req.endpointMetrics = () => {
      const summary = {};
      for (const [endpoint, metrics] of endpointMetrics.entries()) {
        summary[endpoint] = {
          ...metrics,
          avgTime: metrics.totalTime / metrics.count,
          errorRate: (metrics.errors / metrics.count) * 100
        };
      }
      return summary;
    };
    
    next();
  };
}

/**
 * Memory usage monitoring middleware
 */
function createMemoryMonitoringMiddleware(performanceMonitor) {
  let lastMemoryCheck = Date.now();
  const MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  
  return (req, res, next) => {
    const now = Date.now();
    
    // Check memory usage periodically
    if (now - lastMemoryCheck > MEMORY_CHECK_INTERVAL && performanceMonitor) {
      const memoryUsage = process.memoryUsage();
      const memoryUtilization = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      if (memoryUtilization > 80) { // 80% threshold
        logger.warn(`⚠️ High memory usage detected: ${memoryUtilization.toFixed(2)}%`, {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024)
        });
        
        try {
          const monitor = typeof performanceMonitor === 'function' ? performanceMonitor() : performanceMonitor;
          if (monitor && typeof monitor.emit === 'function') {
            monitor.emit('memoryPressure', {
              memoryUsage,
              utilization: memoryUtilization,
              timestamp: now
            });
          }
        } catch (error) {
          // Silently handle performance monitoring errors to avoid crashing the server
          logger.debug('Performance monitoring error:', error.message);
        }
      }
      
      lastMemoryCheck = now;
    }
    
    next();
  };
}

/**
 * Request size monitoring middleware
 */
function createRequestSizeMiddleware(performanceMonitor) {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length')) || 0;
    
    // Log large requests
    if (contentLength > 10 * 1024 * 1024) { // 10MB
      logger.warn(`📊 Large request: ${req.method} ${req.path} - ${(contentLength / 1024 / 1024).toFixed(2)}MB`);
      
      if (performanceMonitor) {
        try {
          const monitor = typeof performanceMonitor === 'function' ? performanceMonitor() : performanceMonitor;
          if (monitor && typeof monitor.emit === 'function') {
            monitor.emit('largeRequest', {
              method: req.method,
              path: req.path,
              size: contentLength,
              contentType: req.get('Content-Type'),
              timestamp: Date.now()
            });
          }
        } catch (error) {
          // Silently handle performance monitoring errors to avoid crashing the server
          logger.debug('Performance monitoring error:', error.message);
        }
      }
    }
    
    next();
  };
}

/**
 * Create comprehensive performance monitoring middleware stack
 */
function createPerformanceStack(performanceMonitor) {
  return [
    createPerformanceMiddleware(performanceMonitor),
    createAPIEndpointMiddleware(performanceMonitor),
    createMemoryMonitoringMiddleware(performanceMonitor),
    createRequestSizeMiddleware(performanceMonitor)
  ];
}

module.exports = {
  createPerformanceMiddleware,
  createDatabaseMiddleware,
  createCacheMiddleware,
  createAPIEndpointMiddleware,
  createMemoryMonitoringMiddleware,
  createRequestSizeMiddleware,
  createPerformanceStack
};