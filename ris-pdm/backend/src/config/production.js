/**
 * Production Configuration Management
 * 
 * Centralized configuration management for production environment.
 * Handles environment variables, feature flags, and deployment settings.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const logger = require('../../utils/logger').child({ component: 'ProductionConfig' });

/**
 * Production Configuration Manager
 * Validates and manages production-specific configurations
 */
class ProductionConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
    this.isStaging = this.environment === 'staging';
    this.isDevelopment = this.environment === 'development';
    
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Configuration object
   */
  loadConfiguration() {
    return {
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT) || 3001,
        host: process.env.HOST || '0.0.0.0',
        cors: {
          origin: this.parseCorsOrigins(process.env.CORS_ORIGIN),
          credentials: process.env.CORS_CREDENTIALS === 'true'
        }
      },

      // Database Configuration
      database: {
        url: process.env.DATABASE_URL,
        pool: {
          min: parseInt(process.env.DB_POOL_MIN) || 2,
          max: parseInt(process.env.DB_POOL_MAX) || 10
        },
        ssl: this.isProduction || this.isStaging,
        timeout: parseInt(process.env.DB_TIMEOUT) || 30000
      },

      // Redis Configuration
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        tls: this.isProduction && process.env.REDIS_TLS === 'true',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      },

      // Azure DevOps Configuration
      azureDevOps: {
        organization: process.env.AZURE_DEVOPS_ORG,
        project: process.env.AZURE_DEVOPS_PROJECT,
        pat: process.env.AZURE_DEVOPS_PAT,
        apiVersion: process.env.AZURE_DEVOPS_API_VERSION || '7.0',
        rateLimit: parseInt(process.env.AZURE_DEVOPS_RATE_LIMIT) || 180
      },

      // OAuth Configuration
      oauth: {
        clientId: process.env.AZURE_OAUTH_CLIENT_ID,
        clientSecret: process.env.AZURE_OAUTH_CLIENT_SECRET,
        redirectUri: process.env.AZURE_OAUTH_REDIRECT_URI,
        scopes: process.env.AZURE_OAUTH_SCOPES?.split(',') || ['vso.work', 'vso.project']
      },

      // Security Configuration
      security: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiration: process.env.JWT_EXPIRATION || '1h',
        encryptionKey: process.env.ENCRYPTION_KEY,
        webhookSecret: process.env.AZURE_DEVOPS_WEBHOOK_SECRET,
        rateLimiting: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300
        }
      },

      // Performance Configuration
      performance: {
        cacheEnabled: process.env.CACHE_ENABLED !== 'false',
        cacheTtl: {
          workItems: parseInt(process.env.CACHE_TTL_WORK_ITEMS) || 300,
          projects: parseInt(process.env.CACHE_TTL_PROJECTS) || 3600,
          metrics: parseInt(process.env.CACHE_TTL_METRICS) || 900
        },
        compression: process.env.COMPRESSION_ENABLED !== 'false',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000
      },

      // Feature Flags
      features: {
        webhooksEnabled: process.env.FEATURE_WEBHOOKS !== 'false',
        oauthEnabled: process.env.FEATURE_OAUTH !== 'false',
        metricsEnabled: process.env.FEATURE_METRICS !== 'false',
        realtimeEnabled: process.env.FEATURE_REALTIME !== 'false',
        debugMode: process.env.DEBUG_MODE === 'true'
      },

      // Monitoring Configuration
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        logLevel: process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug'),
        metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000,
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000
      },

      // Deployment Configuration
      deployment: {
        version: process.env.APP_VERSION || '1.0.0',
        buildId: process.env.BUILD_ID,
        deploymentId: process.env.DEPLOYMENT_ID,
        region: process.env.DEPLOYMENT_REGION || 'us-east-1'
      }
    };
  }

  /**
   * Parse CORS origins from environment variable
   * @param {string} corsOrigin - Comma-separated CORS origins
   * @returns {Array|boolean} Array of origins or boolean for wildcard
   */
  parseCorsOrigins(corsOrigin) {
    if (!corsOrigin) {
      return this.isDevelopment ? ['http://localhost:3000', 'http://localhost:5173'] : false;
    }

    if (corsOrigin === '*') {
      return true;
    }

    return corsOrigin.split(',').map(origin => origin.trim());
  }

  /**
   * Validate required configuration
   */
  validateConfiguration() {
    const required = this.getRequiredConfig();
    const missing = [];

    required.forEach(({ path, value, required: isRequired }) => {
      if (isRequired && (!value || (Array.isArray(value) && value.length === 0))) {
        missing.push(path);
      }
    });

    if (missing.length > 0) {
      const message = `Missing required configuration: ${missing.join(', ')}`;
      logger.error(message);
      
      if (this.isProduction) {
        throw new Error(message);
      } else {
        logger.warn('Using default values for missing configuration in development');
      }
    }

    logger.info('Configuration validation completed', {
      environment: this.environment,
      missingCount: missing.length,
      featuresEnabled: Object.keys(this.config.features).filter(key => this.config.features[key])
    });
  }

  /**
   * Get required configuration paths
   * @returns {Array} Array of required configuration objects
   */
  getRequiredConfig() {
    return [
      // Critical for production
      { path: 'database.url', value: this.config.database.url, required: this.isProduction },
      { path: 'redis.url', value: this.config.redis.url, required: this.isProduction },
      { path: 'security.jwtSecret', value: this.config.security.jwtSecret, required: this.isProduction },
      { path: 'security.encryptionKey', value: this.config.security.encryptionKey, required: this.isProduction },
      
      // Azure DevOps integration
      { path: 'azureDevOps.organization', value: this.config.azureDevOps.organization, required: true },
      { path: 'azureDevOps.project', value: this.config.azureDevOps.project, required: true },
      { path: 'azureDevOps.pat', value: this.config.azureDevOps.pat, required: !this.config.oauth.clientId },
      
      // OAuth (if enabled)
      { path: 'oauth.clientId', value: this.config.oauth.clientId, required: this.config.features.oauthEnabled && this.isProduction },
      { path: 'oauth.clientSecret', value: this.config.oauth.clientSecret, required: this.config.features.oauthEnabled && this.isProduction },
      { path: 'oauth.redirectUri', value: this.config.oauth.redirectUri, required: this.config.features.oauthEnabled && this.isProduction }
    ];
  }

  /**
   * Get configuration by path
   * @param {string} path - Configuration path (e.g., 'server.port')
   * @returns {*} Configuration value
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Check if feature is enabled
   * @param {string} feature - Feature name
   * @returns {boolean} True if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.config.features[feature] === true;
  }

  /**
   * Get database configuration
   * @returns {Object} Database configuration
   */
  getDatabaseConfig() {
    return this.config.database;
  }

  /**
   * Get Redis configuration
   * @returns {Object} Redis configuration
   */
  getRedisConfig() {
    return this.config.redis;
  }

  /**
   * Get Azure DevOps configuration
   * @returns {Object} Azure DevOps configuration
   */
  getAzureDevOpsConfig() {
    return this.config.azureDevOps;
  }

  /**
   * Get OAuth configuration
   * @returns {Object} OAuth configuration
   */
  getOAuthConfig() {
    return this.config.oauth;
  }

  /**
   * Get security configuration
   * @returns {Object} Security configuration
   */
  getSecurityConfig() {
    return this.config.security;
  }

  /**
   * Get complete configuration (for debugging)
   * @param {boolean} includeSensitive - Include sensitive values
   * @returns {Object} Configuration object
   */
  getFullConfig(includeSensitive = false) {
    if (includeSensitive) {
      return this.config;
    }

    // Return config with sensitive values masked
    const masked = JSON.parse(JSON.stringify(this.config));
    
    // Mask sensitive values
    const sensitiveKeys = ['pat', 'clientSecret', 'jwtSecret', 'encryptionKey', 'webhookSecret', 'password'];
    
    const maskSensitive = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          maskSensitive(obj[key]);
        } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = obj[key] ? '***MASKED***' : null;
        }
      }
    };

    maskSensitive(masked);
    return masked;
  }

  /**
   * Get configuration summary for health checks
   * @returns {Object} Configuration summary
   */
  getHealthSummary() {
    return {
      environment: this.environment,
      version: this.config.deployment.version,
      features: this.config.features,
      services: {
        database: !!this.config.database.url,
        redis: !!this.config.redis.url,
        azureDevOps: !!(this.config.azureDevOps.organization && this.config.azureDevOps.project),
        oauth: !!(this.config.oauth.clientId && this.config.oauth.clientSecret)
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const productionConfig = new ProductionConfig();

module.exports = productionConfig;