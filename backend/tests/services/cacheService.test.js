// Jest globals are available automatically
const cacheService = require('../../src/services/cacheService');
const { createMockRedisClient, environmentHelpers, flushPromises } = require('../utils/testHelpers');

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn()
}));

// Mock Node-Cache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    has: jest.fn(),
    keys: jest.fn(),
    getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, keys: 0 }),
    flush: jest.fn(),
    close: jest.fn()
  }));
});

describe('CacheService', () => {
  let mockRedisClient;
  let mockNodeCache;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient = createMockRedisClient();
    require('redis').createClient.mockReturnValue(mockRedisClient);
    
    // Mock Node-Cache instance
    const NodeCache = require('node-cache');
    mockNodeCache = new NodeCache();
    
    // Reset cache service state
    cacheService.redisClient = null;
    cacheService.memoryCache = null;
    cacheService.isRedisAvailable = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Initialization', () => {
    test('should initialize with Redis when available', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      
      await cacheService.init();
      
      expect(cacheService.isRedisAvailable).toBe(true);
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    test('should fallback to memory cache when Redis unavailable', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));
      
      await cacheService.init();
      
      expect(cacheService.isRedisAvailable).toBe(false);
      expect(cacheService.memoryCache).toBeDefined();
    });

    test('should handle Redis connection errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection error'));
      
      await expect(cacheService.init()).resolves.not.toThrow();
      expect(cacheService.isRedisAvailable).toBe(false);
    });
  });

  describe('Redis Operations', () => {
    beforeEach(async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
    });

    test('should get value from Redis', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));
      
      const result = await cacheService.get(testKey);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
      expect(result).toEqual(testValue);
    });

    test('should set value in Redis', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };
      const ttl = 300;
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      await cacheService.set(testKey, testValue, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(testKey, ttl, JSON.stringify(testValue));
    });

    test('should delete value from Redis', async () => {
      const testKey = 'test-key';
      mockRedisClient.del.mockResolvedValue(1);
      
      await cacheService.del(testKey);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(testKey);
    });

    test('should check existence in Redis', async () => {
      const testKey = 'test-key';
      mockRedisClient.exists.mockResolvedValue(1);
      
      const result = await cacheService.exists(testKey);
      
      expect(mockRedisClient.exists).toHaveBeenCalledWith(testKey);
      expect(result).toBe(true);
    });

    test('should handle JSON parse errors', async () => {
      const testKey = 'test-key';
      mockRedisClient.get.mockResolvedValue('invalid-json');
      
      const result = await cacheService.get(testKey);
      
      expect(result).toBeNull();
    });

    test('should handle Redis operation errors', async () => {
      const testKey = 'test-key';
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.get(testKey);
      
      expect(result).toBeNull();
    });
  });

  describe('Memory Cache Operations', () => {
    beforeEach(async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      await cacheService.init();
    });

    test('should get value from memory cache', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };
      mockNodeCache.get.mockReturnValue(testValue);
      
      const result = await cacheService.get(testKey);
      
      expect(mockNodeCache.get).toHaveBeenCalledWith(testKey);
      expect(result).toEqual(testValue);
    });

    test('should set value in memory cache', async () => {
      const testKey = 'test-key';
      const testValue = { data: 'test-data' };
      const ttl = 300;
      mockNodeCache.set.mockReturnValue(true);
      
      await cacheService.set(testKey, testValue, ttl);
      
      expect(mockNodeCache.set).toHaveBeenCalledWith(testKey, testValue, ttl);
    });

    test('should delete value from memory cache', async () => {
      const testKey = 'test-key';
      mockNodeCache.del.mockReturnValue(1);
      
      await cacheService.del(testKey);
      
      expect(mockNodeCache.del).toHaveBeenCalledWith(testKey);
    });

    test('should check existence in memory cache', async () => {
      const testKey = 'test-key';
      mockNodeCache.has.mockReturnValue(true);
      
      const result = await cacheService.exists(testKey);
      
      expect(mockNodeCache.has).toHaveBeenCalledWith(testKey);
      expect(result).toBe(true);
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys', () => {
      const key1 = cacheService.generateKey('workitems', { type: 'story', state: 'active' });
      const key2 = cacheService.generateKey('workitems', { type: 'story', state: 'active' });
      
      expect(key1).toBe(key2);
      expect(key1).toContain('workitems');
    });

    test('should generate different keys for different parameters', () => {
      const key1 = cacheService.generateKey('workitems', { type: 'story' });
      const key2 = cacheService.generateKey('workitems', { type: 'bug' });
      
      expect(key1).not.toBe(key2);
    });

    test('should handle null/undefined parameters', () => {
      const key1 = cacheService.generateKey('test', null);
      const key2 = cacheService.generateKey('test', undefined);
      const key3 = cacheService.generateKey('test');
      
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key3).toBeDefined();
    });
  });

  describe('TTL Management', () => {
    beforeEach(async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
    });

    test('should set expiration time', async () => {
      const testKey = 'test-key';
      const ttl = 300;
      mockRedisClient.expire.mockResolvedValue(1);
      
      await cacheService.expire(testKey, ttl);
      
      expect(mockRedisClient.expire).toHaveBeenCalledWith(testKey, ttl);
    });

    test('should handle default TTL values', async () => {
      const testKey = 'test-key';
      const testValue = 'test-value';
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      await cacheService.set(testKey, testValue);
      
      // Should use default TTL
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(testKey, expect.any(Number), JSON.stringify(testValue));
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
    });

    test('should get multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];
      
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(values[0]))
        .mockResolvedValueOnce(JSON.stringify(values[1]))
        .mockResolvedValueOnce(JSON.stringify(values[2]));
      
      const result = await cacheService.mget(keys);
      
      expect(result).toEqual(values);
    });

    test('should set multiple values', async () => {
      const keyValuePairs = [
        { key: 'key1', value: 'value1', ttl: 300 },
        { key: 'key2', value: 'value2', ttl: 600 }
      ];
      
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      await cacheService.mset(keyValuePairs);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(2);
    });

    test('should delete multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockRedisClient.del.mockResolvedValue(keys.length);
      
      const result = await cacheService.mdel(keys);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(keys.length);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should return cache statistics', async () => {
      await cacheService.init();
      
      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('cacheType');
      expect(stats).toHaveProperty('isRedisAvailable');
    });

    test('should track cache hits and misses', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      await cacheService.init();
      
      mockNodeCache.getStats.mockReturnValue({ hits: 10, misses: 5, keys: 8 });
      
      const stats = await cacheService.getStats();
      
      expect(stats.hits).toBe(10);
      expect(stats.misses).toBe(5);
      expect(stats.keys).toBe(8);
    });
  });

  describe('Cache Patterns', () => {
    beforeEach(async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
    });

    test('should implement cache-aside pattern', async () => {
      const key = 'test-key';
      const fetchFunction = jest.fn().mockResolvedValue({ data: 'fetched-data' });
      
      mockRedisClient.get.mockResolvedValueOnce(null); // Cache miss
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      const result = await cacheService.getOrSet(key, fetchFunction, 300);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(fetchFunction).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fetched-data' });
    });

    test('should return cached value when available', async () => {
      const key = 'test-key';
      const cachedData = { data: 'cached-data' };
      const fetchFunction = jest.fn();
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));
      
      const result = await cacheService.getOrSet(key, fetchFunction, 300);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(fetchFunction).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    test('should handle cache warming', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const warmupFunction = jest.fn()
        .mockResolvedValueOnce({ key: 'key1', value: 'value1' })
        .mockResolvedValueOnce({ key: 'key2', value: 'value2' })
        .mockResolvedValueOnce({ key: 'key3', value: 'value3' });
      
      mockRedisClient.setEx.mockResolvedValue('OK');
      
      await cacheService.warmup(keys, warmupFunction, 300);
      
      expect(warmupFunction).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from Redis disconnection', async () => {
      // Initially Redis available
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
      
      expect(cacheService.isRedisAvailable).toBe(true);
      
      // Simulate Redis disconnection
      mockRedisClient.get.mockRejectedValue(new Error('Connection lost'));
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
      // Should fallback gracefully
    });

    test('should handle memory cache fallback', async () => {
      // Start with Redis unavailable
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      await cacheService.init();
      
      expect(cacheService.isRedisAvailable).toBe(false);
      
      // Operations should work with memory cache
      const testKey = 'test-key';
      const testValue = 'test-value';
      
      mockNodeCache.set.mockReturnValue(true);
      mockNodeCache.get.mockReturnValue(testValue);
      
      await cacheService.set(testKey, testValue);
      const result = await cacheService.get(testKey);
      
      expect(result).toBe(testValue);
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should flush all cache data', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
      
      mockRedisClient.flushAll = jest.fn().mockResolvedValue('OK');
      
      await cacheService.flush();
      
      expect(mockRedisClient.flushAll).toHaveBeenCalled();
    });

    test('should cleanup resources on close', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.isReady = true;
      await cacheService.init();
      
      await cacheService.close();
      
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    test('should handle cleanup with memory cache', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      await cacheService.init();
      
      await cacheService.close();
      
      expect(mockNodeCache.close).toHaveBeenCalled();
    });
  });
});