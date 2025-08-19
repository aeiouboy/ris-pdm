const { Pool } = require('pg');
const Redis = require('redis');

// PostgreSQL Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'performance_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of connections
  min: parseInt(process.env.DB_POOL_MIN) || 5,  // Minimum number of connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000, // 2 seconds
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000, // 60 seconds
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Redis Configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Connection pool settings
  family: 4, // 4 (IPv4) or 6 (IPv6)
  keepAlive: true,
  connectTimeout: 60000,
  commandTimeout: 5000,
};

class DatabaseService {
  constructor() {
    this.pgPool = null;
    this.redisClient = null;
    this.isConnected = false;
    this.isRedisConnected = false;
  }

  // Initialize PostgreSQL connection pool
  async initializePostgreSQL() {
    try {
      this.pgPool = new Pool(dbConfig);
      
      // Test the connection
      const client = await this.pgPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('✅ PostgreSQL connection pool initialized successfully');
      
      // Set up error handlers
      this.pgPool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client:', err);
        this.isConnected = false;
      });

      this.pgPool.on('connect', () => {
        console.log('🔗 New PostgreSQL client connected');
      });

      this.pgPool.on('remove', () => {
        console.log('🔌 PostgreSQL client removed from pool');
      });

      return this.pgPool;
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL connection:', error);
      throw error;
    }
  }

  // Initialize Redis connection
  async initializeRedis() {
    try {
      this.redisClient = Redis.createClient(redisConfig);
      
      // Set up error handlers
      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isRedisConnected = false;
      });

      this.redisClient.on('connect', () => {
        console.log('🔗 Redis client connected');
      });

      this.redisClient.on('ready', () => {
        console.log('✅ Redis client ready');
        this.isRedisConnected = true;
      });

      this.redisClient.on('end', () => {
        console.log('🔌 Redis client disconnected');
        this.isRedisConnected = false;
      });

      // Connect to Redis
      await this.redisClient.connect();
      
      // Test the connection
      await this.redisClient.ping();
      console.log('✅ Redis connection established successfully');
      
      return this.redisClient;
    } catch (error) {
      console.error('❌ Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  // Initialize all database connections
  async initialize() {
    try {
      await this.initializePostgreSQL();
      await this.initializeRedis();
      console.log('🚀 All database connections initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database connections:', error);
      throw error;
    }
  }

  // Get PostgreSQL client from pool
  async getPostgreSQLClient() {
    if (!this.isConnected || !this.pgPool) {
      throw new Error('PostgreSQL connection pool not initialized');
    }
    return await this.pgPool.connect();
  }

  // Execute PostgreSQL query
  async query(text, params = []) {
    if (!this.isConnected || !this.pgPool) {
      throw new Error('PostgreSQL connection pool not initialized');
    }
    
    const start = Date.now();
    try {
      const result = await this.pgPool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.LOG_QUERIES === 'true') {
        console.log('📊 Query executed:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Query error:', { text, params, error: error.message });
      throw error;
    }
  }

  // Execute PostgreSQL transaction
  async transaction(callback) {
    const client = await this.getPostgreSQLClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Redis operations
  async setCache(key, value, ttlSeconds = 300) {
    if (!this.isRedisConnected || !this.redisClient) {
      console.warn('⚠️ Redis not available, skipping cache set');
      return false;
    }
    
    try {
      const serializedValue = JSON.stringify(value);
      await this.redisClient.setEx(key, ttlSeconds, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ Redis set error:', error);
      return false;
    }
  }

  async getCache(key) {
    if (!this.isRedisConnected || !this.redisClient) {
      console.warn('⚠️ Redis not available, cache miss');
      return null;
    }
    
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Redis get error:', error);
      return null;
    }
  }

  async deleteCache(key) {
    if (!this.isRedisConnected || !this.redisClient) {
      return false;
    }
    
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error('❌ Redis delete error:', error);
      return false;
    }
  }

  async invalidateCachePattern(pattern) {
    if (!this.isRedisConnected || !this.redisClient) {
      return false;
    }
    
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('❌ Redis pattern invalidation error:', error);
      return false;
    }
  }

  // Health check for both connections
  async healthCheck() {
    const health = {
      postgresql: false,
      redis: false,
      timestamp: new Date().toISOString()
    };

    // Check PostgreSQL
    try {
      await this.query('SELECT 1');
      health.postgresql = true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
    }

    // Check Redis
    try {
      if (this.redisClient) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return health;
  }

  // Graceful shutdown
  async close() {
    console.log('🔄 Closing database connections...');
    
    try {
      if (this.pgPool) {
        await this.pgPool.end();
        console.log('✅ PostgreSQL pool closed');
      }
      
      if (this.redisClient) {
        await this.redisClient.disconnect();
        console.log('✅ Redis client disconnected');
      }
      
      this.isConnected = false;
      this.isRedisConnected = false;
      console.log('✅ All database connections closed');
    } catch (error) {
      console.error('❌ Error closing database connections:', error);
      throw error;
    }
  }

  // Migration runner
  async runMigrations() {
    const migrationQueries = [
      // Enable UUID extension
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      
      // Check if migration tracking table exists
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`
    ];

    try {
      for (const query of migrationQueries) {
        await this.query(query);
      }
      console.log('✅ Migration infrastructure ready');
    } catch (error) {
      console.error('❌ Migration setup failed:', error);
      throw error;
    }
  }

  // Check if migration was applied
  async isMigrationApplied(version) {
    try {
      const result = await this.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  // Mark migration as applied
  async markMigrationApplied(version) {
    try {
      await this.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [version]
      );
    } catch (error) {
      console.error('Error marking migration as applied:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connections...');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connections...');
  await databaseService.close();
  process.exit(0);
});

module.exports = {
  databaseService,
  DatabaseService
};