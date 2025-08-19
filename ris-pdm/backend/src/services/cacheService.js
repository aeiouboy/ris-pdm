/**
 * Enhanced Cache Service with Redis Integration
 * Provides multi-tier caching with fallback to in-memory cache
 */

const NodeCache = require('node-cache');
const { redisConfig } = require('../config/redisConfig');
const logger = require('../../utils/logger');

class CacheService {
  constructor() {
    // Fallback in-memory cache (smaller TTL)
    this.memoryCache = new NodeCache({ 
      stdTTL: 60,  // 1 minute TTL for memory cache
      checkperiod: 30,  // Check for expired keys every 30 seconds
      useClones: false,  // Better performance, but be careful with mutations
      deleteOnExpire: true,
      enableLegacyCallbacks: false
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      redisHits: 0,
      memoryHits: 0,
      sets: 0,
      errors: 0
    };

    // Performance monitoring
    this.performanceLog = [];
    this.maxPerformanceLogSize = 1000;
  }

  /**
   * Initialize the cache service
   */
  async initialize() {
    try {
      await redisConfig.connect();
      logger.info('✅ Cache service initialized with Redis support');
      return true;
    } catch (error) {
      logger.warn('⚠️ Redis unavailable, using memory cache only:', error.message);
      return false;
    }
  }

  /**
   * Generate a standardized cache key
   */
  generateKey(namespace, identifier, params = {}) {
    const keyParts = [namespace, identifier];
    
    // Add sorted parameter keys for consistency
    const sortedParams = Object.keys(params).sort().map(key => `${key}:${params[key]}`);
    if (sortedParams.length > 0) {
      keyParts.push(...sortedParams);
    }
    
    return redisConfig.generateKey('cache', ...keyParts);
  }

  /**
   * Set data in cache with multi-tier strategy
   */
  async set(key, data, options = {}) {
    const startTime = Date.now();
    const { 
      ttl = redisConfig.cacheTTL.workItems,
      useMemoryCache = true,
      compress = false 
    } = options;

    let success = false;
    
    try {
      // Try Redis first (primary cache)
      if (redisConfig.isReady()) {
        success = await redisConfig.set(key, data, ttl);
        if (success) {
          logger.debug(`Data cached in Redis: ${key}`);
        }
      }

      // Always store in memory cache as backup (with shorter TTL)
      if (useMemoryCache) {
        const memoryTTL = Math.min(ttl, 300); // Max 5 minutes in memory
        this.memoryCache.set(key, data, memoryTTL);
        logger.debug(`Data cached in memory: ${key} (TTL: ${memoryTTL}s)`);
        success = true;
      }

      this.stats.sets++;
      this.recordPerformance('SET', key, Date.now() - startTime, success);
      
      return success;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get data from cache with multi-tier lookup
   */
  async get(key) {
    const startTime = Date.now();
    
    try {
      let data = null;
      let source = null;

      // Try Redis first (primary cache)
      if (redisConfig.isReady()) {
        data = await redisConfig.get(key);
        if (data !== null) {
          source = 'redis';
          this.stats.redisHits++;
          
          // Refresh memory cache if we got data from Redis
          this.memoryCache.set(key, data, 300); // 5 min in memory
        }
      }

      // Fallback to memory cache
      if (data === null) {
        data = this.memoryCache.get(key);
        if (data !== undefined) {
          source = 'memory';
          this.stats.memoryHits++;
        }
      }

      const duration = Date.now() - startTime;
      
      if (data !== null && data !== undefined) {
        this.stats.hits++;
        this.recordPerformance('HIT', key, duration, true, source);
        logger.debug(`Cache hit for ${key} from ${source} (${duration}ms)`);
        return data;
      } else {
        this.stats.misses++;
        this.recordPerformance('MISS', key, duration, false);
        logger.debug(`Cache miss for ${key} (${duration}ms)`);
        return null;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Delete from all cache tiers
   */
  async delete(key) {
    const startTime = Date.now();
    
    try {
      let deletedCount = 0;

      // Delete from Redis
      if (redisConfig.isReady()) {
        const redisDeleted = await redisConfig.delete(key);
        if (redisDeleted) deletedCount++;
      }

      // Delete from memory cache
      const memoryDeleted = this.memoryCache.del(key);
      if (memoryDeleted) deletedCount++;

      const duration = Date.now() - startTime;
      this.recordPerformance('DELETE', key, duration, deletedCount > 0);
      
      logger.debug(`Deleted cache key ${key} from ${deletedCount} tiers`);
      return deletedCount > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern) {
    const startTime = Date.now();
    
    try {
      let clearedCount = 0;

      // Clear from Redis
      if (redisConfig.isReady()) {
        const redisCleared = await redisConfig.deletePattern(pattern);
        if (redisCleared) clearedCount++;
      }

      // Clear from memory cache (get all keys and filter)
      const memoryKeys = this.memoryCache.keys();
      const matchingKeys = memoryKeys.filter(key => {
        // Convert Redis pattern to regex
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(regexPattern).test(key);
      });
      
      matchingKeys.forEach(key => this.memoryCache.del(key));
      if (matchingKeys.length > 0) clearedCount++;

      const duration = Date.now() - startTime;
      logger.info(`Cleared cache pattern ${pattern} (${duration}ms, affected ${clearedCount} tiers)`);
      
      return clearedCount > 0;
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get or set pattern - get data if exists, otherwise execute function and cache result
   */
  async getOrSet(key, asyncFunction, options = {}) {
    const cached = await this.get(key);
    
    if (cached !== null) {
      return cached;
    }

    try {
      const startTime = Date.now();
      const data = await asyncFunction();
      const duration = Date.now() - startTime;
      
      if (data !== null && data !== undefined) {
        await this.set(key, data, options);
        logger.debug(`Generated and cached data for ${key} (${duration}ms)`);
      }
      
      return data;
    } catch (error) {
      logger.error(`Error in getOrSet for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   */
  async getBatch(keys) {
    const results = {};
    const startTime = Date.now();
    
    // Use Promise.all for parallel execution
    const promises = keys.map(async (key) => {
      const data = await this.get(key);
      return { key, data };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ key, data }) => {
      results[key] = data;
    });
    
    const duration = Date.now() - startTime;
    logger.debug(`Batch get completed for ${keys.length} keys (${duration}ms)`);
    
    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  async setBatch(entries, options = {}) {
    const startTime = Date.now();
    
    // Use Promise.all for parallel execution
    const promises = entries.map(({ key, data }) => 
      this.set(key, data, options)
    );
    
    const results = await Promise.all(promises);
    const successCount = results.filter(Boolean).length;
    
    const duration = Date.now() - startTime;
    logger.debug(`Batch set completed: ${successCount}/${entries.length} successful (${duration}ms)`);
    
    return successCount;
  }

  /**
   * Record performance metrics
   */
  recordPerformance(operation, key, duration, success, source = null) {
    const record = {
      timestamp: Date.now(),
      operation,
      key: key.length > 100 ? key.substring(0, 100) + '...' : key,
      duration,
      success,
      source
    };
    
    this.performanceLog.push(record);
    
    // Keep log size manageable
    if (this.performanceLog.length > this.maxPerformanceLogSize) {
      this.performanceLog.shift();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStatistics() {
    const redisHealth = await redisConfig.healthCheck();
    const memoryStats = this.memoryCache.getStats();
    
    // Calculate performance metrics
    const recentOperations = this.performanceLog.slice(-100);
    const avgDuration = recentOperations.length > 0 
      ? recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length
      : 0;
    
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      timestamp: new Date().toISOString(),
      overall: {
        hitRate: `${hitRate}%`,
        totalOperations: this.stats.hits + this.stats.misses + this.stats.sets,
        avgResponseTime: `${avgDuration.toFixed(2)}ms`,
        errorRate: this.stats.errors
      },
      cacheStats: {
        ...this.stats,
        redisEnabled: redisConfig.isReady(),
        memoryKeys: memoryStats.keys,
        memoryValues: memoryStats.values
      },
      redis: redisHealth,
      performance: {
        recentOperationsCount: recentOperations.length,
        fastestOperation: Math.min(...recentOperations.map(op => op.duration)) || 0,
        slowestOperation: Math.max(...recentOperations.map(op => op.duration)) || 0
      }
    };
  }

  /**
   * Warm up cache with essential data
   */
  async warmup(essentialDataFunctions = {}) {
    logger.info('🔥 Starting cache warmup...');
    const startTime = Date.now();
    let warmedItems = 0;

    for (const [key, dataFunction] of Object.entries(essentialDataFunctions)) {
      try {
        const data = await dataFunction();
        if (data) {
          await this.set(key, data, { ttl: 1800 }); // 30 minutes for warmup data
          warmedItems++;
        }
      } catch (error) {
        logger.warn(`Warmup failed for ${key}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ Cache warmup completed: ${warmedItems} items (${duration}ms)`);
    return warmedItems;
  }

  /**
   * Health check for the entire cache system
   */
  async healthCheck() {
    const stats = await this.getStatistics();
    
    return {
      status: redisConfig.isReady() ? 'healthy' : 'degraded',
      redis: stats.redis,
      memory: {
        status: 'healthy',
        keyCount: stats.cacheStats.memoryKeys
      },
      performance: stats.performance,
      timestamp: stats.timestamp
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('🔄 Shutting down cache service...');
    
    // Clear in-memory cache
    this.memoryCache.flushAll();
    
    // Disconnect Redis
    await redisConfig.disconnect();
    
    logger.info('✅ Cache service shutdown complete');
  }
}

// Export singleton instance
const cacheService = new CacheService();
module.exports = cacheService;