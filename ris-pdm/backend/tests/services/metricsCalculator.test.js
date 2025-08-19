// Jest globals are available automatically
const MetricsCalculatorService = require('../../src/services/metricsCalculator');
const { createMockAzureDevOpsService, generateTestMetrics, environmentHelpers } = require('../utils/testHelpers');

// Mock the data transformers
jest.mock('../../src/utils/dataTransformers', () => ({
  calculateVelocity: jest.fn(),
  calculateTeamPerformance: jest.fn(),
  calculateQualityMetrics: jest.fn(),
  calculateSprintMetrics: jest.fn(),
  transformForCharts: jest.fn()
}));

describe('MetricsCalculatorService', () => {
  let metricsCalculator;
  let mockAzureService;
  let mockTransformers;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAzureService = createMockAzureDevOpsService();
    metricsCalculator = new MetricsCalculatorService(mockAzureService);
    
    // Get the mocked transformers
    mockTransformers = require('../../src/utils/dataTransformers');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with Azure DevOps service', () => {
      expect(metricsCalculator.azureService).toBe(mockAzureService);
      expect(metricsCalculator.cache).toBeInstanceOf(Map);
      expect(metricsCalculator.cacheTTL).toBe(5 * 60 * 1000); // 5 minutes
    });

    test('should throw error without Azure DevOps service', () => {
      expect(() => new MetricsCalculatorService()).toThrow();
    });
  });

  describe('Overview Metrics Calculation', () => {
    beforeEach(() => {
      // Mock transformer functions
      mockTransformers.calculateVelocity.mockReturnValue(32);
      mockTransformers.calculateQualityMetrics.mockReturnValue({
        bugCount: 5,
        defectEscapeRate: 2.1,
        codeQuality: 7.8
      });
      mockTransformers.calculateTeamPerformance.mockReturnValue({
        teamSatisfaction: 8.5,
        deliveryPredictability: 85
      });
    });

    test('should calculate overview metrics successfully', async () => {
      const mockWorkItems = [
        { id: 1, type: 'User Story', state: 'Closed', storyPoints: 5 },
        { id: 2, type: 'Bug', state: 'Active', storyPoints: 2 }
      ];
      
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        attributes: { startDate: '2024-01-01', finishDate: '2024-01-14' }
      };

      // Mock service methods
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue(mockWorkItems);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue(mockSprint);
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({
        plYtd: 1250000,
        satisfaction: 4.2,
        cycleTime: 5.2
      });

      const options = { period: 'sprint', startDate: '2024-01-01', endDate: '2024-01-14' };
      const result = await metricsCalculator.calculateOverviewMetrics(options);

      expect(result).toHaveProperty('velocity', 32);
      expect(result).toHaveProperty('quality');
      expect(result.quality).toHaveProperty('bugCount', 5);
      expect(result).toHaveProperty('teamPerformance');
      expect(result.teamPerformance).toHaveProperty('teamSatisfaction', 8.5);
      expect(result).toHaveProperty('kpis');
      expect(result.kpis).toHaveProperty('plYtd', 1250000);
    });

    test('should use cached metrics when available', async () => {
      const cachedData = generateTestMetrics();
      const options = { period: 'sprint', startDate: '2024-01-01', endDate: '2024-01-14' };
      const cacheKey = `overview_${options.period}_${options.startDate}_${options.endDate}_undefined`;
      
      // Set cache
      metricsCalculator.cache.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now()
      });

      const result = await metricsCalculator.calculateOverviewMetrics(options);

      expect(result).toEqual(cachedData);
      // Should not call Azure service
      expect(mockAzureService.getWorkItems).not.toHaveBeenCalled();
    });

    test('should cache calculated metrics', async () => {
      const mockWorkItems = [
        { id: 1, type: 'User Story', state: 'Closed', storyPoints: 5 }
      ];

      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue(mockWorkItems);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue({});
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({});

      const options = { period: 'sprint' };
      await metricsCalculator.calculateOverviewMetrics(options);

      // Check if result was cached
      const cacheKey = `overview_${options.period}_undefined_undefined_undefined`;
      const cachedItem = metricsCalculator.cache.get(cacheKey);
      expect(cachedItem).toBeDefined();
      expect(cachedItem.data).toBeDefined();
    });

    test('should handle missing work items gracefully', async () => {
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([]);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue({});
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({});

      // Set transformer defaults for empty data
      mockTransformers.calculateVelocity.mockReturnValue(0);
      mockTransformers.calculateQualityMetrics.mockReturnValue({
        bugCount: 0,
        defectEscapeRate: 0,
        codeQuality: 0
      });

      const result = await metricsCalculator.calculateOverviewMetrics();

      expect(result.velocity).toBe(0);
      expect(result.quality.bugCount).toBe(0);
    });
  });

  describe('KPI Calculations', () => {
    test('should calculate KPIs from work items and sprint data', async () => {
      const mockWorkItems = [
        { id: 1, type: 'User Story', state: 'Closed', storyPoints: 8, effort: 16 },
        { id: 2, type: 'Bug', state: 'Active', storyPoints: 3, effort: 6 }
      ];
      const mockSprint = {
        id: 'sprint-1',
        capacity: 40,
        commitment: 50
      };

      const kpis = await metricsCalculator.calculateKPIs(mockWorkItems, mockSprint);

      expect(kpis).toHaveProperty('velocity');
      expect(kpis).toHaveProperty('burndownRate');
      expect(kpis).toHaveProperty('commitmentReliability');
      expect(typeof kpis.velocity).toBe('number');
    });

    test('should handle P/L calculation', async () => {
      const mockWorkItems = [
        { id: 1, type: 'User Story', businessValue: 1000, effort: 8 },
        { id: 2, type: 'Feature', businessValue: 2000, effort: 16 }
      ];

      // Mock business value calculation
      metricsCalculator.calculateBusinessValue = jest.fn().mockReturnValue(1250000);

      const kpis = await metricsCalculator.calculateKPIs(mockWorkItems, {});

      expect(kpis).toHaveProperty('plYtd');
      expect(metricsCalculator.calculateBusinessValue).toHaveBeenCalledWith(mockWorkItems);
    });

    test('should calculate satisfaction metrics', async () => {
      const mockWorkItems = [
        { id: 1, satisfactionScore: 4.5, customerFeedback: 'positive' },
        { id: 2, satisfactionScore: 3.8, customerFeedback: 'neutral' }
      ];

      const kpis = await metricsCalculator.calculateKPIs(mockWorkItems, {});

      expect(kpis).toHaveProperty('satisfaction');
      expect(kpis.satisfaction).toBeGreaterThanOrEqual(0);
      expect(kpis.satisfaction).toBeLessThanOrEqual(5);
    });
  });

  describe('Individual Performance Metrics', () => {
    test('should calculate individual performance metrics', async () => {
      const userId = 'user-123';
      const mockUserWorkItems = [
        { id: 1, assignedTo: userId, type: 'User Story', state: 'Closed', storyPoints: 5 },
        { id: 2, assignedTo: userId, type: 'Bug', state: 'Resolved', storyPoints: 2 }
      ];

      mockAzureService.getWorkItems.mockResolvedValue(mockUserWorkItems);

      const result = await metricsCalculator.calculateIndividualPerformance(userId, {
        startDate: '2024-01-01',
        endDate: '2024-01-14'
      });

      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('velocity');
      expect(result.metrics).toHaveProperty('qualityScore');
      expect(result.metrics).toHaveProperty('deliveryConsistency');
    });

    test('should handle user with no work items', async () => {
      const userId = 'user-no-items';
      mockAzureService.getWorkItems.mockResolvedValue([]);

      const result = await metricsCalculator.calculateIndividualPerformance(userId);

      expect(result.userId).toBe(userId);
      expect(result.metrics.velocity).toBe(0);
      expect(result.metrics.qualityScore).toBe(0);
    });

    test('should calculate team comparison metrics', async () => {
      const userId = 'user-123';
      const mockTeamData = {
        averageVelocity: 25,
        averageQuality: 7.5,
        teamSize: 10
      };

      mockAzureService.getWorkItems.mockResolvedValue([
        { id: 1, assignedTo: userId, storyPoints: 8 }
      ]);

      metricsCalculator.getTeamBenchmarks = jest.fn().mockResolvedValue(mockTeamData);

      const result = await metricsCalculator.calculateIndividualPerformance(userId);

      expect(result).toHaveProperty('teamComparison');
      expect(result.teamComparison).toHaveProperty('velocityPercentile');
      expect(result.teamComparison).toHaveProperty('qualityPercentile');
    });
  });

  describe('Sprint Metrics', () => {
    test('should calculate current sprint metrics', async () => {
      const mockSprint = {
        id: 'sprint-1',
        name: 'Sprint 1',
        attributes: {
          startDate: '2024-01-01T00:00:00Z',
          finishDate: '2024-01-14T00:00:00Z'
        }
      };
      const mockSprintWorkItems = [
        { id: 1, state: 'Closed', storyPoints: 5 },
        { id: 2, state: 'Active', storyPoints: 3 },
        { id: 3, state: 'New', storyPoints: 8 }
      ];

      mockAzureService.getCurrentIteration.mockResolvedValue(mockSprint);
      mockAzureService.getWorkItems.mockResolvedValue(mockSprintWorkItems);
      
      mockTransformers.calculateSprintMetrics.mockReturnValue({
        totalPoints: 16,
        completedPoints: 5,
        remainingPoints: 11,
        completionRate: 31.25
      });

      const result = await metricsCalculator.calculateCurrentSprintMetrics();

      expect(result).toHaveProperty('sprint', mockSprint);
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('totalPoints', 16);
      expect(result.metrics).toHaveProperty('completionRate', 31.25);
    });

    test('should calculate burndown data', async () => {
      const sprintId = 'sprint-1';
      const mockBurndownData = [
        { date: '2024-01-01', remaining: 50, ideal: 50 },
        { date: '2024-01-02', remaining: 45, ideal: 46.4 },
        { date: '2024-01-03', remaining: 40, ideal: 42.9 }
      ];

      metricsCalculator.generateBurndownData = jest.fn().mockResolvedValue(mockBurndownData);

      const result = await metricsCalculator.calculateBurndownData(sprintId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('remaining');
      expect(result[0]).toHaveProperty('ideal');
    });
  });

  describe('Cache Management', () => {
    test('should respect cache TTL', async () => {
      const options = { period: 'sprint' };
      const cacheKey = `overview_${options.period}_undefined_undefined_undefined`;
      
      // Set expired cache entry
      metricsCalculator.cache.set(cacheKey, {
        data: { test: 'expired' },
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      });

      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([]);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue({});
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({});

      await metricsCalculator.calculateOverviewMetrics(options);

      // Should have called service methods (cache was expired)
      expect(metricsCalculator.getWorkItemsForPeriod).toHaveBeenCalled();
    });

    test('should clear cache on demand', () => {
      // Add some cache entries
      metricsCalculator.cache.set('key1', { data: 'value1', timestamp: Date.now() });
      metricsCalculator.cache.set('key2', { data: 'value2', timestamp: Date.now() });

      expect(metricsCalculator.cache.size).toBe(2);

      metricsCalculator.clearCache();

      expect(metricsCalculator.cache.size).toBe(0);
    });

    test('should get cache statistics', () => {
      metricsCalculator.cache.set('key1', { data: 'value1', timestamp: Date.now() });
      metricsCalculator.cache.set('key2', { data: 'value2', timestamp: Date.now() - 10000 });

      const stats = metricsCalculator.getCacheStats();

      expect(stats).toHaveProperty('totalEntries', 2);
      expect(stats).toHaveProperty('validEntries');
      expect(stats).toHaveProperty('expiredEntries');
    });
  });

  describe('Error Handling', () => {
    test('should handle Azure DevOps service errors', async () => {
      mockAzureService.getWorkItems.mockRejectedValue(new Error('Service unavailable'));
      
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      await expect(metricsCalculator.calculateOverviewMetrics()).rejects.toThrow('Service unavailable');
    });

    test('should handle missing sprint data gracefully', async () => {
      mockAzureService.getCurrentIteration.mockResolvedValue(null);
      
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue(null);
      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([]);
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({});

      const result = await metricsCalculator.calculateOverviewMetrics();

      expect(result).toBeDefined();
    });

    test('should handle transformer calculation errors', async () => {
      mockTransformers.calculateVelocity.mockImplementation(() => {
        throw new Error('Calculation error');
      });

      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue([{ id: 1 }]);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue({});

      await expect(metricsCalculator.calculateOverviewMetrics()).rejects.toThrow('Calculation error');
    });
  });

  describe('Performance Optimization', () => {
    test('should handle large datasets efficiently', async () => {
      const largeWorkItemSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        type: 'User Story',
        state: 'Closed',
        storyPoints: Math.floor(Math.random() * 13) + 1
      }));

      metricsCalculator.getWorkItemsForPeriod = jest.fn().mockResolvedValue(largeWorkItemSet);
      metricsCalculator.getCurrentSprintData = jest.fn().mockResolvedValue({});
      metricsCalculator.calculateKPIs = jest.fn().mockResolvedValue({});

      const start = Date.now();
      await metricsCalculator.calculateOverviewMetrics();
      const duration = Date.now() - start;

      // Should complete within reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    test('should batch process work items', async () => {
      const workItems = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      
      const batchSize = 25;
      const batches = await metricsCalculator.batchProcessWorkItems(workItems, batchSize, (batch) => {
        return batch.map(item => ({ ...item, processed: true }));
      });

      expect(batches).toHaveLength(4); // 100 items in batches of 25
      expect(batches[0]).toHaveLength(25);
      expect(batches[3]).toHaveLength(25);
    });
  });

  describe('Data Validation', () => {
    test('should validate work item data integrity', () => {
      const invalidWorkItem = { id: null, type: '', storyPoints: -1 };
      const validWorkItem = { id: 1, type: 'User Story', storyPoints: 5 };

      expect(metricsCalculator.validateWorkItem(invalidWorkItem)).toBe(false);
      expect(metricsCalculator.validateWorkItem(validWorkItem)).toBe(true);
    });

    test('should sanitize metrics calculations', () => {
      const metrics = {
        velocity: NaN,
        bugCount: -5,
        satisfaction: 10.5
      };

      const sanitized = metricsCalculator.sanitizeMetrics(metrics);

      expect(sanitized.velocity).toBe(0); // NaN -> 0
      expect(sanitized.bugCount).toBe(0); // negative -> 0
      expect(sanitized.satisfaction).toBe(5); // > 5 -> 5
    });
  });
});