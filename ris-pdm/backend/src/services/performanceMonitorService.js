/**
 * Performance Monitoring Service
 * Collects and analyzes performance metrics for optimization
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const os = require('os');
const logger = require('../../utils/logger');

class PerformanceMonitorService extends EventEmitter {
  constructor() {
    super();
    
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      database: new Map(),
      cache: new Map(),
      memory: [],
      cpu: [],
      system: []
    };
    
    this.config = {
      metricsRetention: 60 * 60 * 1000, // 1 hour
      samplingInterval: 30000, // 30 seconds
      slowRequestThreshold: 1000, // 1 second
      highMemoryThreshold: 0.95, // 95%
      maxMetricsCount: 10000
    };
    
    this.timers = new Map();
    this.startTime = Date.now();
    
    // Start background monitoring
    this.initializeMonitoring();
  }

  /**
   * Initialize background monitoring tasks
   */
  initializeMonitoring() {
    // System metrics collection
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.samplingInterval);

    // Metrics cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.metricsRetention / 4); // Cleanup every 15 minutes

    logger.info('🔍 Performance monitoring service initialized');
  }

  /**
   * Start timing a request
   */
  startRequest(requestId, metadata = {}) {
    const startTime = performance.now();
    const timestamp = Date.now();
    
    this.timers.set(requestId, {
      startTime,
      timestamp,
      metadata: {
        ...metadata,
        userAgent: metadata.userAgent?.substring(0, 100), // Truncate long user agents
        ip: metadata.ip
      }
    });
    
    return requestId;
  }

  /**
   * End timing a request and collect metrics
   */
  endRequest(requestId, statusCode = 200, additionalData = {}) {
    const timer = this.timers.get(requestId);
    if (!timer) return;
    
    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    
    const requestMetric = {
      requestId,
      duration,
      statusCode,
      timestamp: timer.timestamp,
      metadata: timer.metadata,
      ...additionalData
    };
    
    // Store request metric
    this.metrics.requests.set(requestId, requestMetric);
    
    // Check for slow requests
    if (duration > this.config.slowRequestThreshold) {
      logger.warn(`🐌 Slow request detected: ${requestId} took ${duration.toFixed(2)}ms`, {
        url: timer.metadata.url,
        method: timer.metadata.method,
        statusCode
      });
      
      this.emit('slowRequest', requestMetric);
    }
    
    // Emit performance event
    this.emit('requestComplete', requestMetric);
    
    // Cleanup timer
    this.timers.delete(requestId);
    
    return requestMetric;
  }

  /**
   * Track database operation performance
   */
  trackDatabaseOperation(operation, duration, details = {}) {
    const metric = {
      operation,
      duration,
      timestamp: Date.now(),
      details,
      id: `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.metrics.database.set(metric.id, metric);
    
    // Check for slow database operations
    if (duration > 500) { // 500ms threshold
      logger.warn(`🗃️ Slow database operation: ${operation} took ${duration.toFixed(2)}ms`, details);
      this.emit('slowDatabaseOperation', metric);
    }
    
    return metric;
  }

  /**
   * Track cache operation performance
   */
  trackCacheOperation(operation, hit, duration = 0, details = {}) {
    const metric = {
      operation,
      hit,
      duration,
      timestamp: Date.now(),
      details,
      id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.metrics.cache.set(metric.id, metric);
    
    return metric;
  }

  /**
   * Collect system performance metrics
   */
  collectSystemMetrics() {
    const timestamp = Date.now();
    
    // Memory metrics
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    const memoryMetric = {
      timestamp,
      process: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      system: systemMemory,
      utilization: {
        heap: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        system: (systemMemory.used / systemMemory.total) * 100
      }
    };
    
    this.metrics.memory.push(memoryMetric);
    
    // CPU metrics
    const cpuUsage = process.cpuUsage();
    const cpuMetric = {
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system,
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length
    };
    
    this.metrics.cpu.push(cpuMetric);
    
    // System metrics
    const systemMetric = {
      timestamp,
      uptime: process.uptime(),
      systemUptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    };
    
    this.metrics.system.push(systemMetric);
    
    // Check for memory pressure
    if (memoryMetric.utilization.heap > this.config.highMemoryThreshold * 100) {
      logger.warn(`⚠️ High memory usage detected: ${memoryMetric.utilization.heap.toFixed(2)}%`);
      this.emit('highMemoryUsage', memoryMetric);
    }
    
    // Limit metrics count
    this.limitMetricsSize();
  }

  /**
   * Limit the size of metrics arrays to prevent memory leaks
   */
  limitMetricsSize() {
    const maxSize = 1000; // Keep last 1000 entries
    
    if (this.metrics.memory.length > maxSize) {
      this.metrics.memory = this.metrics.memory.slice(-maxSize);
    }
    
    if (this.metrics.cpu.length > maxSize) {
      this.metrics.cpu = this.metrics.cpu.slice(-maxSize);
    }
    
    if (this.metrics.system.length > maxSize) {
      this.metrics.system = this.metrics.system.slice(-maxSize);
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.metricsRetention;
    let cleaned = 0;
    
    // Clean request metrics
    for (const [key, metric] of this.metrics.requests.entries()) {
      if (metric.timestamp < cutoff) {
        this.metrics.requests.delete(key);
        cleaned++;
      }
    }
    
    // Clean database metrics
    for (const [key, metric] of this.metrics.database.entries()) {
      if (metric.timestamp < cutoff) {
        this.metrics.database.delete(key);
        cleaned++;
      }
    }
    
    // Clean cache metrics
    for (const [key, metric] of this.metrics.cache.entries()) {
      if (metric.timestamp < cutoff) {
        this.metrics.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned up ${cleaned} old performance metrics`);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(timeWindow = 60000) { // Last 1 minute by default
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    // Filter recent metrics
    const recentRequests = Array.from(this.metrics.requests.values())
      .filter(m => m.timestamp >= cutoff);
    
    const recentDatabase = Array.from(this.metrics.database.values())
      .filter(m => m.timestamp >= cutoff);
    
    const recentCache = Array.from(this.metrics.cache.values())
      .filter(m => m.timestamp >= cutoff);
    
    const recentMemory = this.metrics.memory
      .filter(m => m.timestamp >= cutoff);
    
    const recentCpu = this.metrics.cpu
      .filter(m => m.timestamp >= cutoff);
    
    // Calculate request statistics
    const requestStats = this.calculateRequestStats(recentRequests);
    const databaseStats = this.calculateDatabaseStats(recentDatabase);
    const cacheStats = this.calculateCacheStats(recentCache);
    const systemStats = this.calculateSystemStats(recentMemory, recentCpu);
    
    return {
      timestamp: new Date().toISOString(),
      timeWindow,
      uptime: process.uptime(),
      requests: requestStats,
      database: databaseStats,
      cache: cacheStats,
      system: systemStats,
      alerts: this.generateAlerts(requestStats, systemStats)
    };
  }

  /**
   * Calculate request statistics
   */
  calculateRequestStats(requests) {
    if (requests.length === 0) {
      return {
        count: 0,
        averageResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        errorRate: 0,
        slowRequestCount: 0
      };
    }
    
    const durations = requests.map(r => r.duration).sort((a, b) => a - b);
    const errorCount = requests.filter(r => r.statusCode >= 400).length;
    const slowCount = requests.filter(r => r.duration > this.config.slowRequestThreshold).length;
    
    return {
      count: requests.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
      errorRate: (errorCount / requests.length) * 100,
      slowRequestCount: slowCount,
      throughput: requests.length / 60 // requests per minute
    };
  }

  /**
   * Calculate database statistics
   */
  calculateDatabaseStats(operations) {
    if (operations.length === 0) {
      return {
        count: 0,
        averageResponseTime: 0,
        slowOperationCount: 0
      };
    }
    
    const durations = operations.map(op => op.duration);
    const slowCount = operations.filter(op => op.duration > 500).length;
    
    return {
      count: operations.length,
      averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowOperationCount: slowCount,
      operationTypes: this.groupBy(operations, 'operation')
    };
  }

  /**
   * Calculate cache statistics
   */
  calculateCacheStats(operations) {
    if (operations.length === 0) {
      return {
        count: 0,
        hitRate: 0,
        averageResponseTime: 0
      };
    }
    
    const hitCount = operations.filter(op => op.hit).length;
    const durations = operations.filter(op => op.duration > 0).map(op => op.duration);
    
    return {
      count: operations.length,
      hitRate: (hitCount / operations.length) * 100,
      averageResponseTime: durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0,
      operations: this.groupBy(operations, 'operation')
    };
  }

  /**
   * Calculate system statistics
   */
  calculateSystemStats(memory, cpu) {
    if (memory.length === 0 || cpu.length === 0) {
      return {
        memory: { current: 0, average: 0, peak: 0 },
        cpu: { current: 0, average: 0 },
        loadAverage: [0, 0, 0]
      };
    }
    
    const currentMemory = memory[memory.length - 1];
    const currentCpu = cpu[cpu.length - 1];
    
    const memoryValues = memory.map(m => m.utilization.heap);
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const peakMemory = Math.max(...memoryValues);
    
    return {
      memory: {
        current: currentMemory.utilization.heap,
        average: avgMemory,
        peak: peakMemory,
        heapUsed: currentMemory.process.heapUsed,
        heapTotal: currentMemory.process.heapTotal
      },
      cpu: {
        current: currentCpu.user + currentCpu.system,
        loadAverage: currentCpu.loadAverage
      },
      uptime: currentMemory.timestamp - this.startTime
    };
  }

  /**
   * Generate performance alerts
   */
  generateAlerts(requestStats, systemStats) {
    const alerts = [];
    
    // High response time alert
    if (requestStats.averageResponseTime > 1000) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `High average response time: ${requestStats.averageResponseTime.toFixed(2)}ms`,
        threshold: 1000
      });
    }
    
    // High error rate alert
    if (requestStats.errorRate > 5) {
      alerts.push({
        type: 'error',
        severity: 'critical',
        message: `High error rate: ${requestStats.errorRate.toFixed(2)}%`,
        threshold: 5
      });
    }
    
    // High memory usage alert
    if (systemStats.memory.current > 95) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${systemStats.memory.current.toFixed(2)}%`,
        threshold: 95
      });
    }
    
    return alerts;
  }

  /**
   * Calculate percentile
   */
  percentile(values, p) {
    if (values.length === 0) return 0;
    
    const index = (p / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return values[lower];
    
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  /**
   * Group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Get health check information
   */
  getHealthCheck() {
    const stats = this.getPerformanceStats(300000); // 5 minutes
    
    const isHealthy = 
      stats.requests.errorRate < 5 &&
      stats.requests.averageResponseTime < 2000 &&
      stats.system.memory.current < 90;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      metrics: {
        averageResponseTime: stats.requests.averageResponseTime,
        errorRate: stats.requests.errorRate,
        memoryUsage: stats.system.memory.current,
        requestCount: stats.requests.count
      },
      alerts: stats.alerts
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format = 'prometheus') {
    const stats = this.getPerformanceStats();
    
    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(stats);
    }
    
    return stats;
  }

  /**
   * Format metrics for Prometheus
   */
  formatPrometheusMetrics(stats) {
    const metrics = [];
    
    // Request metrics
    metrics.push(`# HELP http_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    metrics.push(`http_requests_total ${stats.requests.count}`);
    
    metrics.push(`# HELP http_request_duration_milliseconds HTTP request latencies`);
    metrics.push(`# TYPE http_request_duration_milliseconds histogram`);
    metrics.push(`http_request_duration_milliseconds_average ${stats.requests.averageResponseTime}`);
    
    // Memory metrics
    metrics.push(`# HELP process_memory_usage_percent Process memory usage percentage`);
    metrics.push(`# TYPE process_memory_usage_percent gauge`);
    metrics.push(`process_memory_usage_percent ${stats.system.memory.current}`);
    
    return metrics.join('\n');
  }

  /**
   * Shutdown the monitoring service
   */
  shutdown() {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    logger.info('🔍 Performance monitoring service shutdown');
  }
}

module.exports = PerformanceMonitorService;