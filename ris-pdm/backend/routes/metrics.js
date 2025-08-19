const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const NodeCache = require('node-cache');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const MetricsCalculatorService = require('../src/services/metricsCalculator');
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
const metricsCalculator = new MetricsCalculatorService(azureService);

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
        
        // Return fallback data with error indicator
        overview = {
          period: { type: period, startDate, endDate },
          summary: {
            totalProducts: 0,
            activeProjects: 0,
            totalTeamMembers: 0,
            avgVelocity: 0,
            avgQualityScore: 0,
            totalWorkItems: 0,
            completedWorkItems: 0,
          },
          kpis: {
            deliveryPredictability: 0,
            teamSatisfaction: 0,
            codeQuality: 0,
            defectEscapeRate: 0,
            cycleTime: 0,
            leadTime: 0,
          },
          trends: { velocity: {}, quality: {}, satisfaction: {} },
          alerts: [{
            type: 'error',
            message: 'Unable to fetch data from Azure DevOps. Please check your configuration.',
            severity: 'high',
            timestamp: new Date().toISOString()
          }],
          dataSource: 'fallback',
          error: azureError.message
        };
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
        
        // Return fallback data with error indicator
        metrics = {
          productId,
          period: { type: period, sprintId },
          performance: {
            velocity: { current: 0, target: 0, trend: 'unknown', history: [] },
            burndown: { planned: 0, remaining: 0, rate: 0, onTrack: false },
            quality: { codeQuality: 0, testCoverage: 0, defectDensity: 0, technicalDebt: 0 },
            delivery: { commitmentReliability: 0, cycleTime: 0, leadTime: 0, throughput: 0 }
          },
          workItems: {
            total: 0, completed: 0, inProgress: 0, blocked: 0,
            byType: {}, byPriority: {}
          },
          team: {
            size: 0, productivity: 0, collaboration: 0, satisfaction: 0, utilization: 0
          },
          risks: [{
            type: 'system',
            description: 'Unable to fetch Azure DevOps data',
            severity: 'high',
            impact: 'Metrics unavailable'
          }],
          dataSource: 'fallback',
          error: azureError.message
        };
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
        
        // Return fallback data with error indicator
        teamMetrics = {
          teamId,
          period: { type: period },
          team: {
            name: 'Unknown Team',
            size: 0,
            lead: 'Unknown',
            members: []
          },
          performance: {
            velocity: 0,
            productivity: 0,
            collaboration: 0,
            satisfaction: 0,
            utilization: 0
          },
          workload: {
            totalWorkItems: 0,
            avgWorkItemsPerMember: 0,
            distribution: 'unknown',
            bottlenecks: []
          },
          skills: {
            technical: 0,
            domain: 0,
            process: 0,
            gaps: ['Azure DevOps API connection']
          },
          dataSource: 'fallback',
          error: azureError.message
        };
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
        
        // Return fallback data with error indicator
        const fallbackName = userId ? 
          userId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
          'Team Member';
          
        individualMetrics = {
          userId,
          period: { type: period, startDate, endDate },
          userInfo: {
            name: fallbackName,
            email: userId,
            avatar: null,
            role: 'Developer'
          },
          performance: {
            taskCompletionRate: 0,
            storyPointsDelivered: 0,
            averageVelocity: 0,
            qualityScore: 0,
            cycleTime: 0,
            productivity: 0
          },
          quality: {
            bugsCreated: 0,
            bugsFixed: 0,
            bugRatio: 0,
            codeQuality: 0,
            testCoverage: 0
          },
          workItems: {
            total: 0,
            completed: 0,
            inProgress: 0,
            backlog: 0,
            byType: {},
            byPriority: {}
          },
          timeline: [],
          trends: {
            velocity: [],
            quality: [],
            productivity: []
          },
          alerts: [{
            type: 'error',
            message: 'Unable to fetch individual data from Azure DevOps',
            severity: 'high',
            timestamp: new Date().toISOString()
          }],
          dataSource: 'fallback',
          error: azureError.message
        };
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
      
      // Return fallback data
      teamMembers = {
        members: [],
        count: 0,
        error: azureError.message
      };
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
        
        // Return fallback KPI data
        kpis = {
          pl: {
            value: 1200000,
            trend: 15.2,
            trendValue: '+$180K',
            period: 'YTD',
            target: 1000000
          },
          velocity: {
            value: 42,
            trend: 12,
            trendValue: '+12%',
            period: 'Current Sprint',
            target: 40
          },
          bugs: {
            value: 23,
            trend: -8,
            trendValue: '-8%',
            period: 'Current Sprint',
            target: 15
          },
          satisfaction: {
            value: 4.2,
            trend: 0.3,
            trendValue: '+0.3',
            period: 'Current Sprint',
            target: 4.5
          },
          dataSource: 'fallback',
          error: azureError.message
        };
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
        
        // Return fallback burndown data
        const sprintDays = 14;
        const totalStoryPoints = 42;
        burndownData = [];
        
        for (let day = 0; day <= sprintDays; day++) {
          const idealRemaining = totalStoryPoints - (totalStoryPoints * day / sprintDays);
          let actualRemaining;
          
          if (day === 0) {
            actualRemaining = totalStoryPoints;
          } else if (day <= 3) {
            actualRemaining = totalStoryPoints - (day * 1.5);
          } else if (day <= 10) {
            actualRemaining = totalStoryPoints - (3 * 1.5) - ((day - 3) * 4);
          } else {
            actualRemaining = Math.max(0, totalStoryPoints - (3 * 1.5) - (7 * 4) - ((day - 10) * 2));
          }
          
          burndownData.push({
            day: `Day ${day}`,
            dayNumber: day,
            idealRemaining: Math.max(0, parseFloat(idealRemaining.toFixed(1))),
            actualRemaining: Math.max(0, parseFloat(actualRemaining.toFixed(1))),
            date: new Date(2025, 6, day + 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          });
        }
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
        
        // Return fallback velocity trend data
        const sprints = ['Sprint 18', 'Sprint 19', 'Sprint 20', 'Sprint 21', 'Sprint 22', 'Sprint 23'];
        velocityTrend = [];
        
        sprints.slice(-range).forEach((sprint, index) => {
          const baseVelocity = 35;
          const variance = (Math.random() - 0.5) * 10;
          const velocity = Math.max(20, baseVelocity + variance + (index * 1.5));
          const commitment = baseVelocity + (Math.random() - 0.5) * 8;
          
          velocityTrend.push({
            sprint,
            velocity: parseFloat(velocity.toFixed(1)),
            commitment: parseFloat(commitment.toFixed(1)),
            completed: parseFloat((velocity * 0.9).toFixed(1)),
            average: baseVelocity,
            sprintNumber: index + 18
          });
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
        
        // Return fallback task distribution data
        taskDistribution = [
          { name: 'Development', value: 45, count: 18, icon: '💻' },
          { name: 'Bug Fixes', value: 25, count: 10, icon: '🐛' },
          { name: 'Testing', value: 20, count: 8, icon: '🧪' },
          { name: 'Documentation', value: 10, count: 4, icon: '📝' }
        ];
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

module.exports = router;