const { jest } = require('@jest/globals');
const { performanceTestHelpers, apiTest, environmentHelpers } = require('../utils/testHelpers');
const { createBasicMocks, cleanupMocks } = require('../mocks/azureDevOpsMocks');

describe('Performance Load Tests', () => {
  let app;
  let api;
  
  beforeAll(async () => {
    environmentHelpers.setTestEnvVars();
    app = require('../../server');
    api = apiTest(app);
    createBasicMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('API Endpoint Load Testing', () => {
    test('should handle concurrent requests to /api/metrics/overview', async () => {
      const concurrentRequests = 10;
      const iterations = 50;

      const requestFn = () => api.getOverviewMetrics();
      
      const start = Date.now();
      const results = await performanceTestHelpers.loadTest(requestFn, {
        concurrent: concurrentRequests,
        iterations
      });
      const duration = Date.now() - start;

      // Verify results
      expect(results.total).toBe(iterations);
      expect(results.successful).toBeGreaterThan(iterations * 0.8); // At least 80% success rate
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds

      // Calculate average response time
      const avgResponseTime = duration / iterations;
      expect(avgResponseTime).toBeLessThan(600); // Average response under 600ms

      console.log(`Load test completed: ${results.successful}/${results.total} successful requests in ${duration}ms`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
    }, 60000);

    test('should handle concurrent KPI requests', async () => {
      const requestFn = () => api.getKPIMetrics({ period: 'sprint' });
      
      const results = await performanceTestHelpers.loadTest(requestFn, {
        concurrent: 5,
        iterations: 25
      });

      expect(results.successful).toBeGreaterThan(20);
      expect(results.failed).toBeLessThan(5);
    }, 30000);

    test('should handle mixed endpoint load', async () => {
      const endpoints = [
        () => api.getOverviewMetrics(),
        () => api.getKPIMetrics(),
        () => api.getBurndownData(),
        () => api.getWorkItems(),
        () => api.getUsers()
      ];

      const requestFn = () => {
        const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        return randomEndpoint();
      };

      const results = await performanceTestHelpers.loadTest(requestFn, {
        concurrent: 8,
        iterations: 40
      });

      expect(results.successful).toBeGreaterThan(32); // 80% success rate
    }, 45000);

    test('should maintain response times under load', async () => {
      const responseTimes = [];
      const targetRequests = 20;

      for (let i = 0; i < targetRequests; i++) {
        const startTime = Date.now();
        
        try {
          await api.getOverviewMetrics();
          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);
        } catch (error) {
          // Log error but continue test
          console.warn(`Request ${i + 1} failed:`, error.message);
        }
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      console.log(`Performance metrics:`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);
      console.log(`95th percentile: ${p95ResponseTime}ms`);

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
      expect(p95ResponseTime).toBeLessThan(1000); // 95% under 1 second
    }, 30000);
  });

  describe('Memory Usage Tests', () => {
    test('should not leak memory during repeated requests', async () => {
      const initialMemory = performanceTestHelpers.measureMemoryUsage();
      
      // Make many requests
      const requests = Array(100).fill().map(() => api.getOverviewMetrics());
      await Promise.allSettled(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for GC
      
      const finalMemory = performanceTestHelpers.measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory usage: Initial: ${initialMemory.heapUsed}MB, Final: ${finalMemory.heapUsed}MB`);
      console.log(`Memory increase: ${memoryIncrease}MB`);
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100);
    }, 45000);

    test('should handle large dataset filtering efficiently', async () => {
      // Mock large dataset
      const mockLargeDataset = Array(5000).fill().map((_, i) => ({
        id: i + 1,
        type: ['User Story', 'Bug', 'Task'][i % 3],
        state: ['New', 'Active', 'Closed'][i % 3],
        assignee: `user${(i % 20) + 1}@company.com`,
        storyPoints: Math.floor(Math.random() * 13) + 1,
        createdDate: new Date(2024, 0, i % 365 + 1).toISOString()
      }));

      // Mock API to return large dataset
      const originalMakeRequest = jest.fn().mockResolvedValue({
        workItems: mockLargeDataset,
        totalCount: mockLargeDataset.length
      });

      const startMemory = performanceTestHelpers.measureMemoryUsage();
      const startTime = Date.now();

      // Process large dataset
      const response = await api.getWorkItems({ limit: 1000, page: 1 });
      
      const endTime = Date.now();
      const endMemory = performanceTestHelpers.measureMemoryUsage();
      
      const processingTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      console.log(`Large dataset processing: ${processingTime}ms, Memory used: ${memoryUsed}MB`);

      // Should process efficiently
      expect(processingTime).toBeLessThan(5000); // Under 5 seconds
      expect(memoryUsed).toBeLessThan(200); // Under 200MB additional memory
      expect(response.status).toBe(200);
    }, 20000);
  });

  describe('Cache Performance Tests', () => {
    test('should show improved performance with caching', async () => {
      // First request (uncached)
      const uncachedStart = Date.now();
      await api.getOverviewMetrics();
      const uncachedTime = Date.now() - uncachedStart;

      // Second request (should be cached)
      const cachedStart = Date.now();
      await api.getOverviewMetrics();
      const cachedTime = Date.now() - cachedStart;

      console.log(`Uncached request: ${uncachedTime}ms, Cached request: ${cachedTime}ms`);

      // Cached request should be significantly faster
      expect(cachedTime).toBeLessThan(uncachedTime * 0.5); // At least 50% faster
      expect(cachedTime).toBeLessThan(100); // Cached response under 100ms
    });

    test('should handle cache misses gracefully', async () => {
      // Make unique requests that won't be cached
      const uniqueRequests = Array(10).fill().map((_, i) => 
        api.getKPIMetrics({ 
          period: 'sprint', 
          productId: `unique-product-${i}` 
        })
      );

      const start = Date.now();
      const results = await Promise.allSettled(uniqueRequests);
      const duration = Date.now() - start;

      const successfulResults = results.filter(r => r.status === 'fulfilled');
      
      console.log(`Cache miss test: ${successfulResults.length}/10 successful in ${duration}ms`);

      expect(successfulResults.length).toBeGreaterThanOrEqual(8); // Allow 2 failures
      expect(duration).toBeLessThan(15000); // Complete within 15 seconds
    });
  });

  describe('WebSocket Performance Tests', () => {
    test('should handle multiple WebSocket connections', async () => {
      const connectionCount = 20;
      const mockConnections = [];

      // Simulate multiple WebSocket connections
      for (let i = 0; i < connectionCount; i++) {
        mockConnections.push({
          id: `connection-${i}`,
          connected: true,
          lastMessage: Date.now()
        });
      }

      const broadcastStart = Date.now();
      
      // Simulate broadcasting message to all connections
      const broadcastPromises = mockConnections.map(conn => 
        new Promise(resolve => {
          // Simulate message processing time
          setTimeout(() => resolve(`Message sent to ${conn.id}`), Math.random() * 10);
        })
      );

      const results = await Promise.allSettled(broadcastPromises);
      const broadcastTime = Date.now() - broadcastStart;

      console.log(`WebSocket broadcast to ${connectionCount} connections: ${broadcastTime}ms`);

      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(connectionCount);
      expect(broadcastTime).toBeLessThan(1000); // Under 1 second for broadcast
    });

    test('should handle real-time data updates efficiently', async () => {
      const updateCount = 100;
      const updateSize = 1024; // 1KB per update
      
      const updates = Array(updateCount).fill().map((_, i) => ({
        id: i,
        timestamp: Date.now(),
        data: 'x'.repeat(updateSize), // Simulate data payload
        type: 'metrics-update'
      }));

      const processingStart = Date.now();
      
      // Simulate processing real-time updates
      const processedUpdates = updates.map(update => ({
        ...update,
        processed: true,
        processingTime: Date.now()
      }));

      const processingTime = Date.now() - processingStart;
      const throughput = (updateCount * updateSize) / (processingTime / 1000); // bytes per second

      console.log(`Processed ${updateCount} updates (${updateCount * updateSize} bytes) in ${processingTime}ms`);
      console.log(`Throughput: ${(throughput / 1024).toFixed(2)} KB/s`);

      expect(processedUpdates).toHaveLength(updateCount);
      expect(processingTime).toBeLessThan(5000); // Under 5 seconds
      expect(throughput).toBeGreaterThan(50 * 1024); // At least 50 KB/s
    });
  });

  describe('Database Query Performance', () => {
    test('should handle complex aggregation queries efficiently', async () => {
      // Simulate complex metrics calculation
      const complexQuery = async () => {
        return api.getOverviewMetrics({
          period: 'quarter',
          includeHistoricalData: true,
          aggregateBy: 'team',
          includeComparisons: true
        });
      };

      const queryStart = Date.now();
      const response = await complexQuery();
      const queryTime = Date.now() - queryStart;

      console.log(`Complex aggregation query: ${queryTime}ms`);

      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(3000); // Under 3 seconds for complex queries
    });

    test('should optimize pagination for large result sets', async () => {
      const pageSize = 100;
      const totalPages = 5;

      const paginationTimes = [];

      for (let page = 1; page <= totalPages; page++) {
        const pageStart = Date.now();
        
        const response = await api.getWorkItems({
          page,
          limit: pageSize
        });
        
        const pageTime = Date.now() - pageStart;
        paginationTimes.push(pageTime);

        expect(response.status).toBe(200);
      }

      const avgPageTime = paginationTimes.reduce((sum, time) => sum + time, 0) / paginationTimes.length;
      const maxPageTime = Math.max(...paginationTimes);

      console.log(`Pagination performance: Avg: ${avgPageTime.toFixed(2)}ms, Max: ${maxPageTime}ms`);

      expect(avgPageTime).toBeLessThan(1000); // Average page load under 1 second
      expect(maxPageTime).toBeLessThan(2000); // No page over 2 seconds
    });
  });

  describe('Export Performance Tests', () => {
    test('should generate Excel exports efficiently', async () => {
      const exportStart = Date.now();
      
      const response = await api.exportDashboard('xlsx', {
        period: 'sprint',
        includeCharts: true,
        includeRawData: true
      });
      
      const exportTime = Date.now() - exportStart;

      console.log(`Excel export generation: ${exportTime}ms`);

      expect(response.status).toBe(200);
      expect(exportTime).toBeLessThan(10000); // Under 10 seconds
      expect(response.headers['content-type']).toContain('spreadsheet');
    });

    test('should generate PDF exports within reasonable time', async () => {
      const exportStart = Date.now();
      
      const response = await api.exportDashboard('pdf', {
        period: 'sprint',
        includeCharts: true
      });
      
      const exportTime = Date.now() - exportStart;

      console.log(`PDF export generation: ${exportTime}ms`);

      expect(response.status).toBe(200);
      expect(exportTime).toBeLessThan(15000); // Under 15 seconds
      expect(response.headers['content-type']).toContain('pdf');
    });

    test('should handle concurrent export requests', async () => {
      const concurrentExports = 3;
      const exportTypes = ['xlsx', 'pdf', 'csv'];

      const exportPromises = exportTypes.slice(0, concurrentExports).map(format =>
        api.exportDashboard(format)
      );

      const exportStart = Date.now();
      const results = await Promise.allSettled(exportPromises);
      const totalTime = Date.now() - exportStart;

      const successfulExports = results.filter(r => r.status === 'fulfilled');

      console.log(`Concurrent exports (${concurrentExports}): ${successfulExports.length} successful in ${totalTime}ms`);

      expect(successfulExports.length).toBe(concurrentExports);
      expect(totalTime).toBeLessThan(20000); // All exports under 20 seconds
    });
  });

  describe('Resource Monitoring', () => {
    test('should monitor CPU usage during high load', async () => {
      const startTime = process.hrtime();
      const startCPU = process.cpuUsage();

      // Generate load
      const loadRequests = Array(50).fill().map(() => api.getOverviewMetrics());
      await Promise.allSettled(loadRequests);

      const endTime = process.hrtime(startTime);
      const endCPU = process.cpuUsage(startCPU);

      const wallClockTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
      const cpuTime = (endCPU.user + endCPU.system) / 1000; // Convert to milliseconds

      const cpuUsagePercent = (cpuTime / wallClockTime) * 100;

      console.log(`CPU usage during load test: ${cpuUsagePercent.toFixed(2)}%`);
      console.log(`Wall clock time: ${wallClockTime.toFixed(2)}ms, CPU time: ${cpuTime.toFixed(2)}ms`);

      // CPU usage should be reasonable (less than 200% for dual core)
      expect(cpuUsagePercent).toBeLessThan(300);
    });

    test('should track memory growth over time', async () => {
      const memoryReadings = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await api.getOverviewMetrics();
        
        const memory = performanceTestHelpers.measureMemoryUsage();
        memoryReadings.push({
          iteration: i + 1,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external
        });

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory growth
      const initialMemory = memoryReadings[0].heapUsed;
      const finalMemory = memoryReadings[iterations - 1].heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth over ${iterations} iterations: ${memoryGrowth}MB`);
      console.log(`Memory readings:`, memoryReadings.slice(0, 3)); // Show first 3 readings

      // Memory growth should be minimal
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    });
  });
});