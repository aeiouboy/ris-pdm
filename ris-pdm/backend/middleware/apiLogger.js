/**
 * API Logging Middleware for Azure DevOps Integration Monitoring
 * Tracks API performance, Azure DevOps calls, and system health
 */

const logger = require('../utils/logger');
const { performance } = require('perf_hooks');

/**
 * Azure DevOps API logger middleware
 * Logs detailed information about Azure DevOps API integration
 */
const azureDevOpsLogger = (req, res, next) => {
  const startTime = performance.now();
  const originalSend = res.send;
  
  // Track request metadata
  const requestMetadata = {
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'anonymous',
    userEmail: req.user?.email || 'anonymous',
    query: req.query,
    params: req.params
  };

  // Store request metadata for access in controllers
  req.requestMetadata = requestMetadata;
  
  logger.info('Azure DevOps API Request Started', requestMetadata);

  // Override res.send to capture response data
  res.send = function(data) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Parse response data for metrics
    let responseMetrics = {};
    try {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      if (responseData.data) {
        responseMetrics = extractResponseMetrics(responseData.data);
      }
      if (responseData.error) {
        responseMetrics.hasError = true;
        responseMetrics.errorType = responseData.error;
      }
      if (responseData.dataSource) {
        responseMetrics.dataSource = responseData.dataSource;
      }
    } catch (error) {
      // Ignore parsing errors for non-JSON responses
    }

    const responseMetadata = {
      ...requestMetadata,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      responseSize: Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data)),
      ...responseMetrics
    };

    // Log different levels based on performance and status
    if (res.statusCode >= 500) {
      logger.error('Azure DevOps API Request Failed', responseMetadata);
    } else if (res.statusCode >= 400) {
      logger.warn('Azure DevOps API Request Error', responseMetadata);
    } else if (duration > 5000) {
      logger.warn('Azure DevOps API Request Slow', responseMetadata);
    } else if (duration > 2000) {
      logger.info('Azure DevOps API Request Completed (Slow)', responseMetadata);
    } else {
      logger.info('Azure DevOps API Request Completed', responseMetadata);
    }

    // Track performance metrics
    trackPerformanceMetrics(responseMetadata);
    
    originalSend.call(this, data);
  };

  next();
};

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract metrics from response data for monitoring
 */
function extractResponseMetrics(responseData) {
  const metrics = {};
  
  if (responseData.summary) {
    metrics.totalTeamMembers = responseData.summary.totalTeamMembers;
    metrics.totalWorkItems = responseData.summary.totalWorkItems;
    metrics.completedWorkItems = responseData.summary.completedWorkItems;
    metrics.avgVelocity = responseData.summary.avgVelocity;
    metrics.avgQualityScore = responseData.summary.avgQualityScore;
  }
  
  if (responseData.kpis) {
    metrics.deliveryPredictability = responseData.kpis.deliveryPredictability;
    metrics.teamSatisfaction = responseData.kpis.teamSatisfaction;
    metrics.codeQuality = responseData.kpis.codeQuality;
  }
  
  if (responseData.alerts && Array.isArray(responseData.alerts)) {
    metrics.alertCount = responseData.alerts.length;
    metrics.criticalAlerts = responseData.alerts.filter(a => a.severity === 'high').length;
  }
  
  if (responseData.workItems) {
    metrics.workItemsTotal = responseData.workItems.total;
    metrics.workItemsCompleted = responseData.workItems.completed;
    metrics.workItemsInProgress = responseData.workItems.inProgress;
    metrics.workItemsBlocked = responseData.workItems.blocked;
  }
  
  return metrics;
}

/**
 * Track performance metrics for monitoring and alerting
 */
function trackPerformanceMetrics(metadata) {
  // Track slow requests
  if (parseFloat(metadata.duration) > 5000) {
    logger.warn('Performance Alert: Slow API Response', {
      path: metadata.path,
      duration: metadata.duration,
      userId: metadata.userId,
      statusCode: metadata.statusCode
    });
  }
  
  // Track error patterns
  if (metadata.hasError) {
    logger.error('Error Pattern Detected', {
      path: metadata.path,
      errorType: metadata.errorType,
      userId: metadata.userId,
      timestamp: metadata.timestamp
    });
  }
  
  // Track data source usage
  if (metadata.dataSource === 'fallback') {
    logger.warn('Azure DevOps Fallback Data Used', {
      path: metadata.path,
      userId: metadata.userId,
      timestamp: metadata.timestamp
    });
  }
}

/**
 * Azure DevOps service health monitoring middleware
 */
const azureDevOpsHealthMonitor = async (req, res, next) => {
  // Add health check headers
  res.setHeader('X-Azure-DevOps-Health', 'monitoring');
  res.setHeader('X-Request-ID', req.requestMetadata?.requestId || generateRequestId());
  
  next();
};

/**
 * Error logging middleware specifically for Azure DevOps integration
 */
const azureDevOpsErrorLogger = (error, req, res, next) => {
  const errorMetadata = {
    requestId: req.requestMetadata?.requestId || generateRequestId(),
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: {
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      params: req.params,
      userId: req.user?.id,
      userEmail: req.user?.email
    },
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version
    }
  };

  // Special handling for Azure DevOps specific errors
  if (error.message.includes('Azure DevOps') || error.message.includes('AZURE_DEVOPS')) {
    logger.error('Azure DevOps Integration Error', errorMetadata);
    
    // Return structured error response for Azure DevOps issues
    return res.status(503).json({
      error: 'Azure DevOps service temporarily unavailable',
      code: 'AZURE_DEVOPS_ERROR',
      details: 'Please check Azure DevOps configuration and connectivity',
      requestId: errorMetadata.requestId,
      timestamp: errorMetadata.timestamp
    });
  }
  
  logger.error('API Error', errorMetadata);
  next(error);
};

/**
 * Daily metrics summary logger (can be called by a scheduled job)
 */
const generateDailyMetricsSummary = () => {
  const today = new Date().toISOString().split('T')[0];
  
  logger.info('Daily Azure DevOps Metrics Summary', {
    date: today,
    summary: 'Azure DevOps integration metrics summary',
    note: 'This would contain aggregated metrics in a real implementation'
  });
};

/**
 * System resource monitoring for Azure DevOps API performance
 */
const systemResourceMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  // Log resource usage if concerning
  if (memUsage.rss > 100 * 1024 * 1024) { // 100MB
    logger.warn('High Memory Usage Detected', {
      memoryUsage: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
      },
      path: req.originalUrl
    });
  }
  
  next();
};

module.exports = {
  azureDevOpsLogger,
  azureDevOpsHealthMonitor,
  azureDevOpsErrorLogger,
  systemResourceMonitor,
  generateDailyMetricsSummary
};