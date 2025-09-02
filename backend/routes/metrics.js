const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const NodeCache = require('node-cache');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const MetricsCalculatorService = require('../src/services/metricsCalculator');
const BugClassificationService = require('../src/services/bugClassificationService');
const TaskDistributionService = require('../src/services/taskDistributionService');
const ProjectResolutionService = require('../src/services/projectResolutionService');
const { azureDevOpsConfig } = require('../src/config/azureDevOpsConfig');

// Cache for metrics data (TTL: 5 minutes)
const metricsCache = new NodeCache({ stdTTL: 300 });

// Simple rate limiter for team-members endpoint
const rateLimitCache = new NodeCache({ stdTTL: 60 }); // 1 minute window
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute per IP
};

// Initialize Azure DevOps and Metrics services
const azureService = new AzureDevOpsService(azureDevOpsConfig);
const projectResolver = new ProjectResolutionService(azureService);
const metricsCalculator = new MetricsCalculatorService(azureService, projectResolver);
const bugClassificationService = new BugClassificationService(azureService);
const taskDistributionService = new TaskDistributionService(azureDevOpsConfig);

/**
 * @route   GET /api/metrics/overview
 * @desc    Get high-level performance overview
 * @access  Private
 * @query   ?period=sprint&startDate=2024-01-01&endDate=2024-01-31
 */
router.get('/overview',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', startDate, endDate } = req.query;
      const cacheKey = `overview-${period}-${startDate}-${endDate}-${req.user.id}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info(`Returning cached overview metrics for user ${req.user.email}`);
        return res.json(cachedData);
      }

      logger.info(`Fetching overview metrics for user ${req.user?.email || 'anonymous'}`, {
        period,
        startDate,
        endDate,
        userId: req.user?.id,
      });

      // Calculate real metrics using Azure DevOps data with error handling
      let overview;
      try {
        overview = await metricsCalculator.calculateOverviewMetrics({
          period,
          startDate,
          endDate
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for overview metrics:', {
          error: azureError.message,
          userId: req.user?.id,
          period,
          startDate,
          endDate
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: 'Unable to fetch data from Azure DevOps. Please check your configuration and try again.',
          details: azureError.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: overview,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/products/:productId
 * @desc    Get detailed metrics for a specific product
 * @access  Private
 */
router.get('/products/:productId',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { productId } = req.params;
      const { period = 'sprint', sprintId } = req.query;

      logger.info(`Fetching detailed metrics for product ${productId}`, {
        productId,
        period,
        sprintId,
        userId: req.user?.id,
      });

      // Calculate real product metrics using Azure DevOps data with error handling
      let metrics;
      try {
        metrics = await metricsCalculator.calculateProductMetrics(productId, {
          period,
          sprintId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for product metrics:', {
          error: azureError.message,
          productId,
          sprintId,
          userId: req.user?.id
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: `Unable to fetch metrics for product ${productId}. Please check your configuration and try again.`,
          details: azureError.message,
          productId,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      res.json({
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/teams/:teamId
 * @desc    Get team-specific metrics
 * @access  Private
 */
router.get('/teams/:teamId',
  [
    param('teamId').notEmpty().withMessage('Team ID is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter']).withMessage('Invalid period'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { teamId } = req.params;
      const { period = 'sprint' } = req.query;

      logger.info(`Fetching team metrics for team ${teamId}`, {
        teamId,
        period,
        userId: req.user?.id,
      });

      // Calculate real team metrics using Azure DevOps data with error handling
      let teamMetrics;
      try {
        teamMetrics = await metricsCalculator.calculateTeamMetrics(teamId, {
          period
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for team metrics:', {
          error: azureError.message,
          teamId,
          period,
          userId: req.user?.id
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: `Unable to fetch team metrics for team ${teamId}. Please check your configuration and try again.`,
          details: azureError.message,
          teamId,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      res.json({
        data: teamMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/trends
 * @desc    Get historical trends data
 * @access  Private
 */
router.get('/trends',
  [
    query('metric').notEmpty().withMessage('Metric type is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter']).withMessage('Invalid period'),
    query('range').optional().isInt({ min: 1, max: 12 }).withMessage('Range must be between 1 and 12'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { metric, period = 'sprint', range = 6 } = req.query;

      logger.info(`Fetching trends for metric ${metric}`, {
        metric,
        period,
        range,
        userId: req.user?.id,
      });

      // For now, return structured mock data while we develop historical trends
      // TODO: Implement historical data analysis from Azure DevOps
      const trends = {
        metric,
        period,
        range: parseInt(range),
        data: Array.from({ length: parseInt(range) }, (_, i) => ({
          period: `${period}-${i + 1}`,
          value: Math.random() * 100,
          target: 75,
          timestamp: new Date(Date.now() - (range - i) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        })),
        summary: {
          current: 78.5,
          average: 72.3,
          trend: 'increasing',
          variance: 8.2,
        },
        note: 'Historical trends analysis coming in next phase'
      };

      res.json({
        data: trends,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/individual/:userId
 * @desc    Get individual performance metrics for a specific user
 * @access  Private
 */
router.get('/individual/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty if provided'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { userId } = req.params;
      const { period = 'sprint', startDate, endDate, productId } = req.query;
      const cacheKey = `individual-${userId}-${period}-${startDate}-${endDate}-${productId || 'all'}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info(`Returning cached individual metrics for user ${userId}`, { productId });
        return res.json(cachedData);
      }

      logger.info(`Fetching individual metrics for user ${userId}`, {
        userId,
        period,
        startDate,
        endDate,
        productId,
        requesterId: req.user?.id,
      });

      // Calculate real individual metrics using Azure DevOps data with error handling
      let individualMetrics;
      try {
        individualMetrics = await metricsCalculator.calculateIndividualMetrics(userId, {
          period,
          startDate,
          endDate,
          productId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for individual metrics:', {
          error: azureError.message,
          userId,
          period,
          startDate,
          endDate
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: `Unable to fetch individual metrics for user ${userId}. Please check your configuration and try again.`,
          details: azureError.message,
          userId,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: individualMetrics,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/team-members
 * @desc    Get list of available team members for individual performance views
 * @access  Private
 * @query   ?productId=team-product-management&sprintId=current
 */
// Rate limiting middleware for team-members endpoint
const rateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  
  // Get or create request log for this IP
  let requests = rateLimitCache.get(clientIP) || [];
  
  // Filter out requests outside the current window
  requests = requests.filter(timestamp => timestamp > windowStart);
  
  if (requests.length >= RATE_LIMIT.maxRequests) {
    const resetTime = Math.ceil((requests[0] + RATE_LIMIT.windowMs - now) / 1000);
    res.set({
      'X-RateLimit-Limit': RATE_LIMIT.maxRequests,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': resetTime,
      'Retry-After': resetTime
    });
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: resetTime
    });
  }
  
  // Add current request
  requests.push(now);
  rateLimitCache.set(clientIP, requests);
  
  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT.maxRequests,
    'X-RateLimit-Remaining': RATE_LIMIT.maxRequests - requests.length,
    'X-RateLimit-Reset': Math.ceil((now + RATE_LIMIT.windowMs) / 1000)
  });
  
  next();
};

router.get('/team-members', 
  rateLimit,
  [
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
  ],
  async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { productId, sprintId } = req.query;
    
    logger.info('Fetching team members list', {
      productId,
      sprintId,
      userId: req.user?.id,
    });
    
    const cacheKey = `team-members-list-${productId || 'all'}-${sprintId || 'all'}`;
    console.log(`🔧 Team members cache key: ${cacheKey}`);
    
    // Check cache first
    const cachedData = metricsCache.get(cacheKey);
    if (cachedData) {
      logger.info('Returning cached team members list');
      return res.json(cachedData);
    }

    // Get team members from work items filtered by product
    let teamMembers;
    try {
      teamMembers = await metricsCalculator.getTeamMembersList({
        productId,
        sprintId
      });
    } catch (azureError) {
      logger.error('Azure DevOps API error for team members:', {
        error: azureError.message,
        productId,
        sprintId
      });
      
      // Return error response instead of mock data
      return res.status(503).json({
        error: 'Azure DevOps service unavailable',
        message: 'Unable to fetch team members from Azure DevOps. Please check your configuration and try again.',
        details: azureError.message,
        timestamp: new Date().toISOString(),
        retryAfter: 60
      });
    }

    const response = {
      data: teamMembers,
      timestamp: new Date().toISOString(),
    };

    // Cache for 15 minutes
    metricsCache.set(cacheKey, response, 900);
    res.json(response);
    
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/metrics/kpis
 * @desc    Get detailed KPI data for dashboard cards
 * @access  Private
 */
router.get('/kpis',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', productId, sprintId } = req.query;
      const cacheKey = `kpis-${period}-${productId}-${sprintId}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached KPI data');
        return res.json(cachedData);
      }

      logger.info('Fetching detailed KPI data', {
        period,
        productId,
        sprintId,
        userId: req.user?.id,
      });

      // Calculate KPIs using Azure DevOps data
      let kpis;
      try {
        kpis = await metricsCalculator.calculateDetailedKPIs({
          period,
          productId,
          sprintId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for KPIs:', {
          error: azureError.message,
          period,
          productId,
          sprintId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: 'Unable to fetch KPI data from Azure DevOps. Please check your configuration and try again.',
          details: azureError.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: kpis,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/burndown
 * @desc    Get sprint burndown chart data
 * @access  Private
 */
router.get('/burndown',
  [
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { sprintId, productId } = req.query;
      const cacheKey = `burndown-${sprintId}-${productId}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached burndown data');
        return res.json(cachedData);
      }

      logger.info('Fetching sprint burndown data', {
        sprintId,
        productId,
        userId: req.user?.id,
      });

      // Calculate burndown using Azure DevOps data
      let burndownData;
      try {
        burndownData = await metricsCalculator.calculateSprintBurndown({
          sprintId,
          productId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for burndown:', {
          error: azureError.message,
          sprintId,
          productId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: 'Unable to fetch sprint burndown data from Azure DevOps. Please check your configuration and try again.',
          details: azureError.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: burndownData,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/velocity-trend
 * @desc    Get team velocity trend data
 * @access  Private
 */
router.get('/velocity-trend',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter']).withMessage('Invalid period'),
    query('range').optional().isInt({ min: 3, max: 12 }).withMessage('Range must be between 3 and 12'),
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', range = 6, productId } = req.query;
      const cacheKey = `velocity-trend-${period}-${range}-${productId}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached velocity trend data');
        return res.json(cachedData);
      }

      logger.info('Fetching velocity trend data', {
        period,
        range,
        productId,
        userId: req.user?.id,
      });

      // Calculate velocity trend using Azure DevOps data
      let velocityTrend;
      try {
        velocityTrend = await metricsCalculator.calculateVelocityTrend({
          period,
          range: parseInt(range),
          productId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for velocity trend:', {
          error: azureError.message,
          period,
          range,
          productId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: 'Unable to fetch velocity trend data from Azure DevOps. Please check your configuration and try again.',
          details: azureError.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: velocityTrend,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/task-distribution
 * @desc    Get task distribution data for pie chart
 * @access  Private
 */
router.get('/task-distribution',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter']).withMessage('Invalid period'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', sprintId, productId } = req.query;
      const cacheKey = `task-distribution-${period}-${sprintId}-${productId}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached task distribution data');
        return res.json(cachedData);
      }

      logger.info('Fetching task distribution data', {
        period,
        sprintId,
        productId,
        userId: req.user?.id,
      });

      // Calculate task distribution using Azure DevOps data
      let taskDistribution;
      try {
        taskDistribution = await metricsCalculator.calculateTaskDistribution({
          period,
          sprintId,
          productId
        });
      } catch (azureError) {
        logger.error('Azure DevOps API error for task distribution:', {
          error: azureError.message,
          period,
          sprintId,
          productId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          message: 'Unable to fetch task distribution data from Azure DevOps. Please check your configuration and try again.',
          details: azureError.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: taskDistribution,
        timestamp: new Date().toISOString(),
      };

      // Cache the response
      metricsCache.set(cacheKey, response);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/health
 * @desc    Check Azure DevOps service health
 * @access  Private
 */
router.get('/health', async (req, res, next) => {
  try {
    logger.info('Checking Azure DevOps service health');
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      service: 'Azure DevOps Integration',
      status: 'unknown',
      details: {}
    };
    
    try {
      // Test Azure DevOps connectivity
      const serviceHealth = azureService.getServiceHealth();
      
      // Try a simple query to test actual connectivity
      const testQuery = await azureService.getWorkItems({ 
        maxResults: 1,
        workItemTypes: ['Task'] 
      });
      
      healthStatus.status = 'healthy';
      healthStatus.details = {
        configuration: serviceHealth.configuration,
        rateLimiter: serviceHealth.rateLimiter,
        cacheSize: serviceHealth.cacheSize,
        lastTestQuery: {
          success: true,
          resultCount: testQuery.totalCount,
          responseTime: 'Available'
        }
      };
      
    } catch (error) {
      healthStatus.status = 'unhealthy';
      healthStatus.details = {
        error: error.message,
        configuration: {
          hasOrganization: !!azureDevOpsConfig.organization,
          hasProject: !!azureDevOpsConfig.project,
          hasPAT: !!azureDevOpsConfig.pat,
          apiVersion: azureDevOpsConfig.apiVersion
        },
        troubleshooting: [
          'Check AZURE_DEVOPS_ORG environment variable',
          'Check AZURE_DEVOPS_PROJECT environment variable', 
          'Verify AZURE_DEVOPS_PAT is valid and has appropriate permissions',
          'Ensure network connectivity to dev.azure.com'
        ]
      };
    }
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      service: 'Azure DevOps Integration',
      status: 'error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/bugs/classification
 * @desc    Get classified bug analysis
 * @access  Private
 */
router.get('/bugs/classification',
  [
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
    query('states').optional().isString().withMessage('States must be a string'),
    query('assignedTo').optional().isString().withMessage('Assigned to must be a string'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { productId, sprintId, states, assignedTo } = req.query;
      const cacheKey = `bug-classification-${productId}-${sprintId}-${states}-${assignedTo}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached bug classification data');
        return res.json(cachedData);
      }

      logger.info('Fetching bug classification data', {
        productId,
        sprintId,
        states,
        assignedTo,
        userId: req.user?.id,
      });

      // Get classified bugs
      let classificationData;
      try {
        const options = {
          states: states ? states.split(',') : null,
          assignedTo,
          maxResults: 1000
        };

        classificationData = await bugClassificationService.getClassifiedBugs(options);
      } catch (error) {
        logger.error('Error getting bug classification:', {
          error: error.message,
          productId,
          sprintId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Bug classification service unavailable',
          message: 'Unable to fetch bug classification data. Please check your configuration and try again.',
          details: error.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: classificationData,
        timestamp: new Date().toISOString(),
      };

      // Cache the response for 10 minutes
      metricsCache.set(cacheKey, response, 600);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/bugs/stats
 * @desc    Get bug classification statistics summary
 * @access  Private
 */
router.get('/bugs/stats',
  [
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { productId, sprintId } = req.query;
      const cacheKey = `bug-stats-${productId}-${sprintId}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached bug statistics');
        return res.json(cachedData);
      }

      logger.info('Fetching bug classification statistics', {
        productId,
        sprintId,
        userId: req.user?.id,
      });

      // Get bug statistics
      let bugStats;
      try {
        bugStats = await bugClassificationService.getBugClassificationStats({
          maxResults: 1000
        });
      } catch (error) {
        logger.error('Error getting bug statistics:', {
          error: error.message,
          productId,
          sprintId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Bug statistics service unavailable',
          message: 'Unable to fetch bug statistics. Please check your configuration and try again.',
          details: error.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: bugStats,
        timestamp: new Date().toISOString(),
      };

      // Cache the response for 10 minutes
      metricsCache.set(cacheKey, response, 600);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/metrics/bugs/types
 * @desc    Get bug types distribution based on Azure DevOps custom fields
 * @access  Private
 */
router.get('/bugs/types',
  [
    query('productId').optional().notEmpty().withMessage('Product ID cannot be empty'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
    query('states').optional().isString().withMessage('States must be a string'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { productId, sprintId, states } = req.query;
      const cacheKey = `bug-types-${productId}-${sprintId}-${states}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached bug types data');
        return res.json(cachedData);
      }

      logger.info('Fetching bug types distribution', {
        productId,
        sprintId,
        states,
        userId: req.user?.id,
      });

      // Get classified bugs with bug types
      let bugTypesData;
      try {
        // If productId or sprintId provided, use filtered work items (same as Task Distribution)
        let bugs = [];
        if (productId || sprintId) {
          // Get work items filtered by product/sprint (same approach as Task Distribution)
          const workItems = await metricsCalculator.getWorkItemsForProduct(productId, { sprintId });
          
          // Filter for bug-related items using the same logic as Task Distribution
          const BugClassificationService = require('../src/services/bugClassificationService');
          for (const item of workItems) {
            const isBug = await BugClassificationService.isBugWorkItem(item);
            if (isBug) {
              bugs.push(item);
            }
          }
          
          // Convert to classified format
          const classifiedItems = bugs.map(bug => bugClassificationService.classifyBug(bug));
          
          var classifiedBugs = {
            bugs: classifiedItems,
            totalCount: classifiedItems.length,
            classification: bugClassificationService.generateClassificationSummary(classifiedItems)
          };
        } else {
          // Fallback to original behavior for backward compatibility
          const options = {
            states: states ? states.split(',') : null,
            maxResults: 1000
          };
          
          var classifiedBugs = await bugClassificationService.getClassifiedBugs(options);
        }
        
        // Extract bug types distribution
        const bugTypeDistribution = {};
        const originalTypeDistribution = {};
        
        classifiedBugs.bugs.forEach(bug => {
          const bugType = bug.classification.bugType;
          
          // Count by classified type
          bugTypeDistribution[bugType.type] = (bugTypeDistribution[bugType.type] || 0) + 1;
          
          // Count by original Azure DevOps type if available
          if (bugType.originalType) {
            originalTypeDistribution[bugType.originalType] = (originalTypeDistribution[bugType.originalType] || 0) + 1;
          }
        });

        const total = classifiedBugs.totalCount;
        
        // Convert to percentage format
        const bugTypeStats = Object.entries(bugTypeDistribution).map(([type, count]) => ({
          type,
          count,
          percentage: Math.round((count / total) * 100)
        })).sort((a, b) => b.count - a.count);

        const originalTypeStats = Object.entries(originalTypeDistribution).map(([originalType, count]) => ({
          originalType,
          count,
          percentage: Math.round((count / total) * 100)
        })).sort((a, b) => b.count - a.count);

        bugTypesData = {
          classifiedTypes: bugTypeStats,
          azureDevOpsTypes: originalTypeStats,
          distribution: classifiedBugs.classification.bugType || {},
          totalBugs: total,
          breakdown: {
            withAzureDevOpsType: classifiedBugs.bugs.filter(b => b.classification.bugType.originalType).length,
            patternMatched: classifiedBugs.bugs.filter(b => b.classification.bugType.source === 'pattern_matching').length,
            defaultClassified: classifiedBugs.bugs.filter(b => b.classification.bugType.source === 'default').length
          }
        };

      } catch (error) {
        logger.error('Error getting bug types distribution:', {
          error: error.message,
          productId,
          sprintId
        });
        
        // Return error response instead of mock data
        return res.status(503).json({
          error: 'Bug types service unavailable',
          message: 'Unable to fetch bug types distribution. Please check your configuration and try again.',
          details: error.message,
          timestamp: new Date().toISOString(),
          retryAfter: 60
        });
      }

      const response = {
        data: bugTypesData,
        timestamp: new Date().toISOString(),
      };

      // Cache the response for 10 minutes
      metricsCache.set(cacheKey, response, 600);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/metrics/test-dashboard-data
 * @desc    Test endpoint for dashboard API methods
 * @access  Private - For testing only
 */
router.post('/test-dashboard-data', async (req, res) => {
  try {
    const { project = 'Product - Data as a Service', iterationId = 'current' } = req.body;
    
    logger.info(`🧪 Testing dashboard API methods for project: ${project}`);
    
    const results = {
      project,
      iterationId,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Get Sprint Capacity
    try {
      logger.info(`Testing getSprintCapacity...`);
      const capacity = await azureService.getSprintCapacity(project, iterationId);
      results.tests.sprintCapacity = {
        success: true,
        data: capacity,
        hasData: capacity.teamCapacities && capacity.teamCapacities.length > 0
      };
    } catch (error) {
      results.tests.sprintCapacity = {
        success: false,
        error: error.message
      };
    }

    // Test 2: Get Official Sprint Burndown
    try {
      logger.info(`Testing getSprintBurndown...`);
      const burndown = await azureService.getSprintBurndown(project, iterationId);
      results.tests.sprintBurndown = {
        success: true,
        data: burndown,
        hasData: burndown.dataExists
      };
    } catch (error) {
      results.tests.sprintBurndown = {
        success: false,
        error: error.message
      };
    }

    // Test 3: Get Work Item Analytics
    try {
      logger.info(`Testing getWorkItemAnalytics...`);
      const analytics = await azureService.getWorkItemAnalytics(project, {
        iterationId: iterationId !== 'current' ? iterationId : undefined,
        maxResults: 50
      });
      results.tests.workItemAnalytics = {
        success: true,
        data: analytics,
        hasData: analytics.workItems && analytics.workItems.length > 0,
        source: analytics.source
      };
    } catch (error) {
      results.tests.workItemAnalytics = {
        success: false,
        error: error.message
      };
    }

    // Summary
    const successfulTests = Object.values(results.tests).filter(test => test.success).length;
    const totalTests = Object.keys(results.tests).length;
    
    results.summary = {
      successful: successfulTests,
      total: totalTests,
      successRate: `${Math.round((successfulTests / totalTests) * 100)}%`
    };

    logger.info(`✅ Dashboard API tests completed: ${successfulTests}/${totalTests} successful`);
    
    res.json(results);
    
  } catch (error) {
    logger.error('Dashboard API test failed:', error);
    res.status(500).json({
      error: 'Dashboard API test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/metrics/task-distribution-enhanced
 * @desc    Get enhanced task distribution with bug classification
 * @access  Private
 * @query   ?productId=abc&iterationPath=sprint&assignedTo=user&dateRange=2024-01-01,2024-01-31
 */
router.get('/task-distribution-enhanced',
  [
    query('productId').optional().isString().withMessage('Product ID must be a string'),
    query('iterationPath').optional().isString().withMessage('Iteration path must be a string'),
    query('assignedTo').optional().isString().withMessage('Assigned to must be a string'),
    query('dateRange').optional().isString().withMessage('Date range must be a string'),
    query('includeRemoved').optional().isBoolean().withMessage('Include removed must be boolean')
  ],
  async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { 
        productId,
        iterationPath,
        assignedTo,
        dateRange,
        includeRemoved = false
      } = req.query;

      // Parse date range if provided
      let parsedDateRange = null;
      if (dateRange) {
        const [start, end] = dateRange.split(',');
        parsedDateRange = { start, end };
      }

      // Resolve product to Azure DevOps project
      let projectName = null;
      if (productId) {
        try {
          projectName = await projectResolver.resolveProjectName(productId);
        } catch (resolveError) {
          logger.warn(`Failed to resolve project for productId: ${productId}`, resolveError);
        }
      }

      const cacheKey = `task-distribution-enhanced-${projectName || 'default'}-${iterationPath || 'all'}-${assignedTo || 'all'}-${dateRange || 'all'}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached enhanced task distribution data');
        return res.json({
          ...cachedData,
          cached: true,
          duration: Date.now() - startTime
        });
      }

      logger.info('Azure DevOps API Request Started', {
        endpoint: '/task-distribution-enhanced',
        productId,
        projectName,
        iterationPath,
        userId: req.user?.id
      });

      // Initialize task distribution service
      await taskDistributionService.initialize();

      // Calculate task distribution
      const distributionData = await taskDistributionService.calculateTaskDistribution({
        projectName,
        iterationPath,
        assignedTo,
        dateRange: parsedDateRange,
        includeRemoved
      });

      const response = {
        data: distributionData,
        metadata: {
          projectName: projectName || 'default',
          queryParameters: {
            productId,
            iterationPath,
            assignedTo,
            dateRange: parsedDateRange,
            includeRemoved
          },
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        },
        cached: false
      };

      // Cache the result
      metricsCache.set(cacheKey, response, 300); // 5 minutes

      logger.info('Azure DevOps API Request Completed', {
        endpoint: '/task-distribution-enhanced',
        duration: Date.now() - startTime,
        totalItems: distributionData.metadata.totalItems
      });

      res.json(response);

    } catch (error) {
      logger.error('Error in task distribution enhanced endpoint:', {
        error: error.message,
        stack: error.stack,
        productId: req.query.productId,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Task distribution calculation failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      });
    }
  }
);

/**
 * @route   GET /api/metrics/bug-classification/:projectId
 * @desc    Get detailed bug classification statistics
 * @access  Private
 * @query   ?environment=prod&severity=high&startDate=2024-01-01&endDate=2024-01-31&iterationPath=current
 */
router.get('/bug-classification/:projectId',
  [
    param('projectId').notEmpty().withMessage('Project ID is required'),
    query('environment').optional().isIn(['Deploy', 'Prod', 'SIT', 'UAT', 'Other']).withMessage('Invalid environment'),
    query('severity').optional().isIn(['1', '2', '3', '4']).withMessage('Invalid severity'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('iterationPath').optional().isString().withMessage('Invalid iteration path')
  ],
  async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { projectId } = req.params;
      const { environment, severity, startDate, endDate, iterationPath } = req.query;

      // Resolve project name
      let projectName = null;
      try {
        projectName = await projectResolver.resolveProjectName(projectId);
      } catch (resolveError) {
        return res.status(404).json({
          error: 'Project not found',
          message: `Unable to resolve project ID: ${projectId}`,
          timestamp: new Date().toISOString()
        });
      }

      const filters = {
        environment,
        severity,
        startDate,
        endDate,
        iterationPath
      };

      const cacheKey = `bug-classification-${projectName}-${JSON.stringify(filters)}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached bug classification data');
        return res.json({
          ...cachedData,
          cached: true,
          duration: Date.now() - startTime
        });
      }

      logger.info('Fetching bug classification data', {
        projectId,
        projectName,
        filters,
        userId: req.user?.id
      });

      // Initialize task distribution service
      await taskDistributionService.initialize();

      // Get bug classification statistics
      const bugClassificationData = await taskDistributionService.getBugTypeDistribution(projectName, {
        environment,
        severity,
        startDate,
        endDate,
        iterationPath
      });

      // Get environment-specific data if requested
      const environmentData = {};
      if (environment) {
        environmentData[environment] = await azureService.getBugsByEnvironment(environment, {
          projectName,
          iterationPath,
          environment,
          severity,
          startDate,
          endDate
        });
      } else {
        // Get data for all environments
        const environments = ['Deploy', 'Prod', 'SIT', 'UAT'];
        for (const env of environments) {
          try {
            environmentData[env] = await azureService.getBugsByEnvironment(env, {
              projectName,
              iterationPath,
              environment: env,
              severity,
              startDate,
              endDate
            });
          } catch (envError) {
            logger.warn(`Failed to get bugs for environment ${env}:`, envError.message);
            environmentData[env] = { environment: env, bugs: [], count: 0 };
          }
        }
      }

      const response = {
        bugTypes: bugClassificationData,
        bugsByEnvironment: environmentData,
        insights: {
          topBugSources: Object.keys(bugClassificationData.bugTypes || {}).slice(0, 5),
          resolutionPatterns: {
            avgResolutionTime: '5 days', // This would be calculated from actual data
            fastestEnvironment: 'SIT',
            slowestEnvironment: 'Prod'
          },
          recommendations: bugClassificationData.classificationRate < 80 ? 
            ['Improve bug classification rate by training team on custom field usage'] : 
            ['Bug classification is healthy']
        },
        filters: {
          availableEnvironments: ['Deploy', 'Prod', 'SIT', 'UAT', 'Other'],
          dateRange: { start: startDate, end: endDate },
          projectName
        },
        metadata: {
          projectId,
          projectName,
          totalBugs: bugClassificationData.totalBugs,
          classificationRate: bugClassificationData.classificationRate,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        },
        cached: false
      };

      // Cache the result
      metricsCache.set(cacheKey, response, 600); // 10 minutes

      res.json(response);

    } catch (error) {
      logger.error('Error in bug classification endpoint:', {
        error: error.message,
        stack: error.stack,
        projectId: req.params.projectId,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Bug classification calculation failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      });
    }
  }
);

/**
 * @route   POST /api/metrics/task-distribution/export
 * @desc    Export task distribution data in various formats
 * @access  Private
 * @body    { format: 'csv|pdf', filters: {}, includeCharts: boolean, dateRange: {} }
 */
router.post('/task-distribution/export',
  [
    query('format').isIn(['csv', 'pdf']).withMessage('Format must be csv or pdf'),
    query('includeCharts').optional().isBoolean().withMessage('Include charts must be boolean')
  ],
  async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { format = 'csv', includeCharts = false } = req.query;
      const { filters = {}, dateRange } = req.body;

      logger.info('Generating task distribution export', {
        format,
        includeCharts,
        filters,
        userId: req.user?.id
      });

      // Get task distribution data
      await taskDistributionService.initialize();
      
      const distributionData = await taskDistributionService.calculateTaskDistribution({
        ...filters,
        dateRange
      });

      if (format === 'csv') {
        // Generate CSV data
        const csvData = generateTaskDistributionCSV(distributionData);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="task-distribution-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvData);
      } else if (format === 'pdf') {
        // For now, return JSON with PDF generation placeholder
        res.json({
          message: 'PDF generation feature will be implemented in next iteration',
          data: distributionData,
          format: 'pdf',
          includeCharts,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error in task distribution export:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Export generation failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      });
    }
  }
);

/**
 * @route   GET /api/metrics/bug-patterns
 * @desc    Analyze bug patterns and trends over time
 * @access  Private
 * @query   ?projectId=abc&timeRange=3months&environment=prod
 */
router.get('/bug-patterns',
  [
    query('projectId').optional().isString().withMessage('Project ID must be a string'),
    query('timeRange').optional().isIn(['1month', '3months', '6months', '1year']).withMessage('Invalid time range'),
    query('environment').optional().isIn(['Deploy', 'Prod', 'SIT', 'UAT']).withMessage('Invalid environment')
  ],
  async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { projectId, timeRange = '3months', environment } = req.query;

      // Resolve project name if provided
      let projectName = null;
      if (projectId) {
        try {
          projectName = await projectResolver.resolveProjectName(projectId);
        } catch (resolveError) {
          logger.warn(`Failed to resolve project for projectId: ${projectId}`, resolveError);
        }
      }

      // Calculate date range
      const now = new Date();
      const ranges = {
        '1month': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        '3months': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        '6months': new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        '1year': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      };

      const timeRangeObj = {
        start: ranges[timeRange].toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      };

      const cacheKey = `bug-patterns-${projectName || 'all'}-${timeRange}-${environment || 'all'}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached bug patterns data');
        return res.json({
          ...cachedData,
          cached: true,
          duration: Date.now() - startTime
        });
      }

      logger.info('Analyzing bug patterns', {
        projectId,
        projectName,
        timeRange,
        environment,
        userId: req.user?.id
      });

      // Initialize task distribution service
      await taskDistributionService.initialize();

      // Analyze bug patterns
      const bugPatterns = await taskDistributionService.analyzeBugPatterns(timeRangeObj, {
        projectName,
        environment
      });

      const response = {
        patterns: bugPatterns,
        metadata: {
          projectId,
          projectName: projectName || 'All Projects',
          timeRange,
          environment: environment || 'All Environments',
          dateRange: timeRangeObj,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        },
        cached: false
      };

      // Cache the result
      metricsCache.set(cacheKey, response, 900); // 15 minutes

      res.json(response);

    } catch (error) {
      logger.error('Error in bug patterns endpoint:', {
        error: error.message,
        stack: error.stack,
        projectId: req.query.projectId,
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Bug pattern analysis failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      });
    }
  }
);

/**
 * @route   GET /api/metrics/validate-bug-fields
 * @desc    Validate bug custom field access and configuration
 * @access  Private
 */
router.get('/validate-bug-fields', async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    logger.info('Validating bug custom field access', {
      userId: req.user?.id
    });

    // Initialize Azure DevOps service
    await azureService.initialize();

    // Validate custom field access
    const validation = await azureService.validateCustomFieldAccess();

    const response = {
      validation,
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Error in bug field validation:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'Bug field validation failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    });
  }
});

// Helper function to generate CSV data
function generateTaskDistributionCSV(distributionData) {
  const headers = ['Type', 'Count', 'Percentage', 'Story Points'];
  const rows = [];

  // Add distribution data
  Object.entries(distributionData.distribution).forEach(([type, data]) => {
    rows.push([
      type.charAt(0).toUpperCase() + type.slice(1),
      data.count,
      `${data.percentage}%`,
      data.storyPoints || 0
    ]);
  });

  // Add bug classification data if available
  if (distributionData.bugClassification) {
    rows.push(['']); // Empty row
    rows.push(['Bug Classification']);
    rows.push(['Environment', 'Count', 'Percentage', '']);
    
    Object.entries(distributionData.bugClassification.environmentBreakdown || {}).forEach(([env, data]) => {
      rows.push([
        env,
        data.count,
        `${data.percentage}%`,
        ''
      ]);
    });
  }

  // Convert to CSV format
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * @route   GET /api/metrics/sprints
 * @desc    Get available sprints/iterations from Azure DevOps
 * @access  Private
 * @query   ?productId=abc&teamName=xyz
 */
router.get('/sprints',
  [
    query('productId').optional().isString().withMessage('Product ID must be a string'),
    query('teamName').optional().isString().withMessage('Team name must be a string')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          success: false
        });
      }

      const { productId, teamName } = req.query;
      const cacheKey = `sprints-${productId || 'all'}-${teamName || 'all'}`;

      // Check cache first
      const cachedData = metricsCache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Returning cached sprint data for key: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Fetching sprints from Azure DevOps', {
        productId: productId || 'all',
        teamName: teamName || 'auto-detect'
      });

      // Get project from productId or use default
      let project = productId || 'Product - Partner Management Platform';
      
      // Use project resolution service if available
      if (projectResolver && typeof projectResolver.resolveProject === 'function') {
        try {
          const resolvedProject = await projectResolver.resolveProject(productId);
          if (resolvedProject) {
            project = resolvedProject;
          }
        } catch (error) {
          logger.warn('Failed to resolve project using projectResolver:', error.message);
        }
      }

      // Generate mock sprint data function
      const generateMockSprints = () => [
        {
          id: 'current',
          name: 'Delivery 4',
          description: 'Current Active Sprint (Aug 25 - Sep 5)',
          status: 'active',
          startDate: '2025-08-25', // Matches screenshot
          endDate: '2025-09-05',   // Matches screenshot  
          path: 'Product\\Delivery 4'
        },
        {
          id: 'sprint-24',
          name: 'Sprint 24',
          description: 'Previous Sprint',
          status: 'completed',
          startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // -28 days
          endDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // -14 days
          path: 'Project\\Sprint 24'
        },
        {
          id: 'sprint-23',
          name: 'Sprint 23',
          description: 'Previous Sprint',
          status: 'completed',
          startDate: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // -42 days
          endDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // -28 days
          path: 'Project\\Sprint 23'
        },
        {
          id: 'all-sprints',
          name: 'All Sprints',
          description: 'All time view',
          status: 'all',
          startDate: null,
          endDate: null,
          path: null
        }
      ];

      // Get iterations from Azure DevOps with timeout
      let iterations;
      try {
        // Set a shorter timeout for the iterations call to avoid frontend timeouts
        const iterationPromise = azureService.getIterations(project, teamName);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Azure DevOps timeout')), 5000)
        );
        
        iterations = await Promise.race([iterationPromise, timeoutPromise]);
      } catch (error) {
        logger.warn('Failed to fetch iterations from Azure DevOps, using mock data:', error.message);
        
        // Return mock sprint data immediately when Azure DevOps fails
        const mockSprints = generateMockSprints();
        logger.info('Returning mock sprint data due to Azure DevOps error');
        return res.json({
          success: true,
          data: mockSprints,
          cached: false,
          mock: true,
          timestamp: new Date().toISOString()
        });
      }
      
      if (!iterations || !Array.isArray(iterations) || iterations.length === 0) {
        logger.warn('No iterations found', { project, teamName });
        
        // Return mock sprint data as fallback
        const mockSprints = generateMockSprints();
        logger.info('Returning mock sprint data due to no iterations found');
        
        return res.json({
          success: true,
          data: mockSprints,
          cached: false,
          mock: true,
          timestamp: new Date().toISOString()
        });
      }

      // Transform iterations to sprints format
      const now = new Date();
      const sprints = iterations
        .filter(iteration => iteration.attributes && iteration.attributes.startDate && iteration.attributes.finishDate)
        .map(iteration => {
          const startDate = new Date(iteration.attributes.startDate);
          const finishDate = new Date(iteration.attributes.finishDate);
          
          // Determine status based on dates
          let status = 'completed';
          if (startDate <= now && finishDate >= now) {
            status = 'active';
          } else if (startDate > now) {
            status = 'future';
          }

          return {
            id: iteration.identifier || iteration.name?.toLowerCase().replace(/\s+/g, '-'),
            name: iteration.name,
            description: status === 'active' ? 'Current Sprint' : 
                        status === 'future' ? 'Future Sprint' : 'Completed Sprint',
            status,
            startDate: iteration.attributes.startDate.split('T')[0], // Format as YYYY-MM-DD
            endDate: iteration.attributes.finishDate.split('T')[0],
            path: iteration.path
          };
        })
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // Sort by start date descending

      // Add special "current" sprint entry
      const currentSprint = sprints.find(s => s.status === 'active');
      if (currentSprint) {
        sprints.unshift({
          id: 'current',
          name: currentSprint.name,
          description: 'Current Active Sprint',
          status: 'active',
          startDate: currentSprint.startDate,
          endDate: currentSprint.endDate,
          path: currentSprint.path
        });
      }

      // Add "all sprints" option
      sprints.push({
        id: 'all-sprints',
        name: 'All Sprints',
        description: 'All time view',
        status: 'all',
        startDate: null,
        endDate: null,
        path: null
      });

      // Cache the result
      metricsCache.set(cacheKey, sprints);

      logger.info(`Successfully fetched ${sprints.length} sprints`, {
        project,
        teamName,
        activeSprintFound: !!currentSprint
      });

      res.json({
        success: true,
        data: sprints,
        cached: false,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error fetching sprints:', error);
      res.status(500).json({
        error: 'Failed to fetch sprints',
        message: error.message,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;