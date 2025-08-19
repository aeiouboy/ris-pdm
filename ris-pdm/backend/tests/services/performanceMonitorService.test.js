// Jest globals are available automatically
const PerformanceMonitorService = require('../../src/services/performanceMonitorService');
const { environmentHelpers } = require('../utils/testHelpers');

// Mock dependencies
jest.mock('../../utils/logger');

describe('PerformanceMonitorService', () => {
  let performanceMonitor;
  let mockLogger;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
    mockLogger = require('../../utils/logger');
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
  });

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitorService();
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor', () => {
    test('should initialize with default thresholds', () => {
      expect(performanceMonitor.thresholds).toBeDefined();
      expect(performanceMonitor.thresholds.response).toBe(1000); // 1 second
      expect(performanceMonitor.thresholds.memory).toBe(500 * 1024 * 1024); // 500MB
      expect(performanceMonitor.thresholds.cpu).toBe(80); // 80%
    });

    test('should accept custom thresholds', () => {
      const customMonitor = new PerformanceMonitorService({
        response: 500,
        memory: 1024 * 1024 * 1024, // 1GB
        cpu: 90
      });

      expect(customMonitor.thresholds.response).toBe(500);
      expect(customMonitor.thresholds.memory).toBe(1024 * 1024 * 1024);
      expect(customMonitor.thresholds.cpu).toBe(90);
    });

    test('should initialize metrics storage', () => {
      expect(performanceMonitor.metrics).toBeDefined();
      expect(performanceMonitor.metrics.requests).toEqual([]);
      expect(performanceMonitor.metrics.system).toEqual([]);
    });
  });

  describe('Request Performance Tracking', () => {
    test('should start request timer', () => {
      const timer = performanceMonitor.startTimer('test-operation');
      
      expect(timer).toBeDefined();
      expect(typeof timer.end).toBe('function');
      expect(timer.startTime).toBeDefined();
    });

    test('should measure request duration', async () => {
      const timer = performanceMonitor.startTimer('test-request');
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const duration = timer.end();
      
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(200);
    });

    test('should track multiple concurrent requests', () => {
      const timer1 = performanceMonitor.startTimer('request-1');
      const timer2 = performanceMonitor.startTimer('request-2');
      const timer3 = performanceMonitor.startTimer('request-3');

      expect(timer1.id).not.toBe(timer2.id);
      expect(timer2.id).not.toBe(timer3.id);
      expect(timer1.id).not.toBe(timer3.id);
    });

    test('should log slow requests', async () => {
      // Set a very low threshold for testing
      const testMonitor = new PerformanceMonitorService({ response: 50 });
      const timer = testMonitor.startTimer('slow-request');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      timer.end();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow request detected'),
        expect.objectContaining({
          operation: 'slow-request',
          duration: expect.any(Number)
        })
      );
    });
  });

  describe('System Resource Monitoring', () => {
    test('should collect system metrics', () => {
      const metrics = performanceMonitor.getSystemMetrics();
      
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('percentage');
    });

    test('should detect high memory usage', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 600 * 1024 * 1024, // 600MB
        heapTotal: 400 * 1024 * 1024,
        heapUsed: 350 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      });

      performanceMonitor.collectSystemMetrics();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('High memory usage detected'),
        expect.any(Object)
      );

      process.memoryUsage = originalMemoryUsage;
    });

    test('should track memory trends', () => {
      // Collect multiple data points
      performanceMonitor.collectSystemMetrics();
      performanceMonitor.collectSystemMetrics();
      performanceMonitor.collectSystemMetrics();

      const trends = performanceMonitor.getMemoryTrend();
      
      expect(trends).toHaveProperty('current');
      expect(trends).toHaveProperty('average');
      expect(trends).toHaveProperty('peak');
      expect(trends).toHaveProperty('trend'); // 'increasing', 'decreasing', 'stable'
    });
  });

  describe('Database Performance Monitoring', () => {
    test('should track database query performance', async () => {
      const queryTimer = performanceMonitor.startTimer('db-query-users');
      
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = queryTimer.end();
      
      const dbMetrics = performanceMonitor.getDatabaseMetrics();
      expect(dbMetrics).toHaveProperty('totalQueries');
      expect(dbMetrics).toHaveProperty('averageDuration');
      expect(dbMetrics.totalQueries).toBeGreaterThan(0);
    });

    test('should identify slow database queries', async () => {
      const testMonitor = new PerformanceMonitorService({ 
        database: { slow: 30 } 
      });
      
      const queryTimer = testMonitor.startTimer('db-query-complex');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      queryTimer.end();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow database query'),
        expect.any(Object)
      );
    });

    test('should track query frequency', () => {
      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        const timer = performanceMonitor.startTimer('db-query-frequent');
        timer.end();
      }

      const metrics = performanceMonitor.getDatabaseMetrics();
      expect(metrics.totalQueries).toBe(5);
    });
  });

  describe('API Endpoint Performance', () => {
    test('should track endpoint response times', () => {
      performanceMonitor.trackEndpoint('/api/metrics/overview', 150, 200);
      performanceMonitor.trackEndpoint('/api/metrics/overview', 200, 200);
      performanceMonitor.trackEndpoint('/api/workitems', 80, 200);

      const endpointMetrics = performanceMonitor.getEndpointMetrics();
      
      expect(endpointMetrics).toHaveProperty('/api/metrics/overview');
      expect(endpointMetrics).toHaveProperty('/api/workitems');
      
      const overviewMetrics = endpointMetrics['/api/metrics/overview'];
      expect(overviewMetrics.count).toBe(2);
      expect(overviewMetrics.averageResponseTime).toBe(175);
    });

    test('should identify performance bottlenecks', () => {
      // Track slow endpoint
      for (let i = 0; i < 10; i++) {
        performanceMonitor.trackEndpoint('/api/slow-endpoint', 2000, 200);
      }

      const bottlenecks = performanceMonitor.getBottlenecks();
      
      expect(bottlenecks.slowEndpoints).toContain('/api/slow-endpoint');
    });

    test('should track error rates', () => {
      performanceMonitor.trackEndpoint('/api/error-prone', 100, 500);
      performanceMonitor.trackEndpoint('/api/error-prone', 120, 404);
      performanceMonitor.trackEndpoint('/api/error-prone', 90, 200);

      const endpointMetrics = performanceMonitor.getEndpointMetrics();
      const errorProneMetrics = endpointMetrics['/api/error-prone'];
      
      expect(errorProneMetrics.errorRate).toBeCloseTo(66.67, 1); // 2 errors out of 3 requests
    });
  });

  describe('Real-time Alerts', () => {
    test('should trigger performance alert', () => {
      const alertSpy = jest.spyOn(performanceMonitor, 'triggerAlert');
      
      // Simulate high response time
      performanceMonitor.trackEndpoint('/api/test', 3000, 200);
      
      expect(alertSpy).toHaveBeenCalledWith(
        'HIGH_RESPONSE_TIME',
        expect.objectContaining({
          endpoint: '/api/test',
          responseTime: 3000
        })
      );
    });

    test('should debounce repeated alerts', () => {
      const alertSpy = jest.spyOn(performanceMonitor, 'triggerAlert');
      
      // Trigger same alert multiple times quickly
      performanceMonitor.triggerAlert('TEST_ALERT', { test: true });
      performanceMonitor.triggerAlert('TEST_ALERT', { test: true });
      performanceMonitor.triggerAlert('TEST_ALERT', { test: true });
      
      // Should only trigger once due to debouncing
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });

    test('should clear alerts when performance improves', () => {
      // Trigger alert
      performanceMonitor.triggerAlert('HIGH_MEMORY', { memory: 600 });
      
      // Simulate memory improvement
      performanceMonitor.clearAlert('HIGH_MEMORY');
      
      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts).not.toContain('HIGH_MEMORY');
    });
  });

  describe('Performance Reports', () => {
    test('should generate performance summary', () => {
      // Add some test data
      performanceMonitor.trackEndpoint('/api/test1', 100, 200);
      performanceMonitor.trackEndpoint('/api/test2', 200, 200);
      performanceMonitor.trackEndpoint('/api/test3', 150, 500);

      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary).toHaveProperty('totalRequests');
      expect(summary).toHaveProperty('averageResponseTime');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('slowestEndpoints');
      expect(summary).toHaveProperty('systemHealth');
    });

    test('should export performance data', () => {
      const exportData = performanceMonitor.exportMetrics();
      
      expect(exportData).toHaveProperty('requests');
      expect(exportData).toHaveProperty('system');
      expect(exportData).toHaveProperty('endpoints');
      expect(exportData).toHaveProperty('alerts');
      expect(exportData).toHaveProperty('metadata');
    });

    test('should filter export data by date range', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const exportData = performanceMonitor.exportMetrics({
        startDate: oneDayAgo,
        endDate: now
      });
      
      expect(exportData.metadata.filters).toEqual({
        startDate: oneDayAgo.toISOString(),
        endDate: now.toISOString()
      });
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should clean old metrics data', () => {
      // Add old data
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      performanceMonitor.metrics.requests.push({
        timestamp: oldTimestamp,
        duration: 100,
        operation: 'old-request'
      });

      const initialCount = performanceMonitor.metrics.requests.length;
      
      performanceMonitor.cleanupOldMetrics(7); // Keep 7 days
      
      expect(performanceMonitor.metrics.requests.length).toBeLessThan(initialCount);
    });

    test('should reset metrics', () => {
      // Add some data
      performanceMonitor.trackEndpoint('/api/test', 100, 200);
      performanceMonitor.collectSystemMetrics();

      performanceMonitor.resetMetrics();

      expect(performanceMonitor.metrics.requests).toEqual([]);
      expect(performanceMonitor.metrics.system).toEqual([]);
      expect(performanceMonitor.metrics.endpoints).toEqual({});
    });

    test('should handle graceful shutdown', async () => {
      const shutdownSpy = jest.spyOn(performanceMonitor, 'exportMetrics');
      
      await performanceMonitor.shutdown();
      
      expect(shutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Integration with Monitoring Systems', () => {
    test('should format metrics for Prometheus', () => {
      performanceMonitor.trackEndpoint('/api/test', 100, 200);
      
      const prometheusMetrics = performanceMonitor.getPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('# HELP http_request_duration_ms');
      expect(prometheusMetrics).toContain('# TYPE http_request_duration_ms histogram');
      expect(prometheusMetrics).toContain('http_request_duration_ms');
    });

    test('should send metrics to external monitoring service', async () => {
      const mockSend = jest.fn().mockResolvedValue(true);
      performanceMonitor.setExternalMonitoring({
        send: mockSend,
        enabled: true
      });

      performanceMonitor.trackEndpoint('/api/test', 100, 200);
      
      // Trigger metric send
      await performanceMonitor.sendToExternalMonitoring();
      
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.any(Object),
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle timer errors gracefully', () => {
      const timer = performanceMonitor.startTimer('test');
      
      // Simulate error in timer
      timer.startTime = null;
      
      expect(() => timer.end()).not.toThrow();
    });

    test('should handle system metrics collection errors', () => {
      // Mock error in system metrics
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn().mockImplementation(() => {
        throw new Error('CPU usage error');
      });

      expect(() => performanceMonitor.collectSystemMetrics()).not.toThrow();
      
      process.cpuUsage = originalCpuUsage;
    });

    test('should log performance monitoring errors', () => {
      // Trigger an error condition
      performanceMonitor.trackEndpoint(null, null, null);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Performance monitoring error'),
        expect.any(Object)
      );
    });
  });

  describe('Configuration', () => {
    test('should validate configuration on initialization', () => {
      expect(() => {
        new PerformanceMonitorService({
          response: -1, // Invalid threshold
          memory: 'invalid'
        });
      }).toThrow('Invalid performance monitoring configuration');
    });

    test('should update thresholds at runtime', () => {
      performanceMonitor.updateThresholds({
        response: 2000,
        memory: 1024 * 1024 * 1024
      });

      expect(performanceMonitor.thresholds.response).toBe(2000);
      expect(performanceMonitor.thresholds.memory).toBe(1024 * 1024 * 1024);
    });

    test('should support feature toggles', () => {
      const configuredMonitor = new PerformanceMonitorService({
        features: {
          systemMonitoring: false,
          alerting: true,
          externalReporting: false
        }
      });

      expect(configuredMonitor.features.systemMonitoring).toBe(false);
      expect(configuredMonitor.features.alerting).toBe(true);
    });
  });
});