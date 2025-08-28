const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const NodeCache = require('node-cache');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const MetricsCalculatorService = require('../src/services/metricsCalculator');
const BugClassificationService = require('../src/services/bugClassificationService');
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

module.exports = router;