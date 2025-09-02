const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const { isProjectEnabled, getProjectConfig, getFrontendProjects } = require('../src/config/projectMapping');

// Initialize Azure DevOps service
const azureDevOpsService = new AzureDevOpsService();

/**
 * @route   GET /api/products
 * @desc    Get all products from Azure DevOps projects
 * @access  Private
 * @query   ?status=active&limit=10&offset=0
 */
router.get('/',
  [
    query('status').optional().isIn(['active', 'inactive', 'archived']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { status, limit = 50, offset = 0 } = req.query;

      logger.info(`Fetching products from Azure DevOps for user ${req.user.email}`, {
        filters: { status, limit, offset },
        userId: req.user.id,
      });

      // Fetch projects from Azure DevOps
      const projectsData = await azureDevOpsService.getProjects();
      
      if (!projectsData || !projectsData.projects) {
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          code: 'AZURE_DEVOPS_UNAVAILABLE',
          message: 'Failed to fetch projects from Azure DevOps',
          timestamp: new Date().toISOString(),
        });
      }

      let products = projectsData.projects
        .filter(project => {
          // Filter projects based on enabled configuration
          // Check if the project name is enabled in our configuration
          return isProjectEnabled(project.name);
        })
        .map(project => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          teamSize: project.teamSize,
          currentSprint: project.currentSprint,
          status: project.status,
          lead: project.lead,
          createdAt: project.createdAt || project.lastUpdateTime,
          azureDevOpsProject: true, // Flag to indicate this comes from Azure DevOps
          visibility: project.visibility,
          url: project.url,
          config: getProjectConfig(project.name) // Add project configuration for frontend
        }));

      // Apply status filter
      if (status) {
        products = products.filter(p => p.status === status);
      }

      // Apply pagination
      const total = products.length;
      const paginatedProducts = products.slice(offset, offset + parseInt(limit));

      // Enhance products with additional data if needed
      const enhancedProducts = await Promise.all(
        paginatedProducts.map(async (product) => {
          try {
            // Get team size if not already populated
            if (!product.teamSize) {
              const teamData = await azureDevOpsService.getProjectTeamMembers(product.name);
              product.teamSize = teamData?.count || 0;
            }

            // Get current sprint if not already populated
            if (!product.currentSprint) {
              const iterationsData = await azureDevOpsService.getIterations(product.name, 'current');
              const currentIteration = iterationsData?.iterations?.[0];
              product.currentSprint = currentIteration?.name || 'No active sprint';
            }

            return product;
          } catch (error) {
            logger.warn(`Failed to enhance product ${product.name}:`, error.message);
            return product; // Return product without enhancements
          }
        })
      );

      res.json({
        data: enhancedProducts,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + enhancedProducts.length < total,
        },
        source: 'Azure DevOps',
        organization: projectsData.organization,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching products from Azure DevOps:', error);
      
      // Return structured error instead of mock data
      return res.status(500).json({
        error: 'Failed to fetch products',
        code: 'AZURE_DEVOPS_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   GET /api/products/:productId
 * @desc    Get product by ID from Azure DevOps
 * @access  Private
 */
router.get('/:productId',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
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

      logger.info(`Fetching product ${productId} from Azure DevOps for user ${req.user.email}`, {
        productId,
        userId: req.user.id,
      });

      // Fetch all projects from Azure DevOps
      const projectsData = await azureDevOpsService.getProjects();
      
      if (!projectsData || !projectsData.projects) {
        return res.status(503).json({
          error: 'Azure DevOps service unavailable',
          code: 'AZURE_DEVOPS_UNAVAILABLE',
          message: 'Failed to fetch projects from Azure DevOps',
          timestamp: new Date().toISOString(),
        });
      }

      // Find product by ID
      const project = projectsData.projects.find(p => p.id === productId);

      if (!project) {
        return res.status(404).json({
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND',
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      // Check if the project is enabled in our configuration
      if (!isProjectEnabled(project.name)) {
        return res.status(403).json({
          error: 'Product access denied',
          code: 'PRODUCT_DISABLED',
          message: `Access to project '${project.name}' is currently disabled`,
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      // Transform to product format
      let product = {
        id: project.id,
        name: project.name,
        description: project.description || '',
        teamSize: project.teamSize,
        currentSprint: project.currentSprint,
        status: project.status,
        lead: project.lead,
        createdAt: project.createdAt || project.lastUpdateTime,
        azureDevOpsProject: true,
        visibility: project.visibility,
        url: project.url,
        config: getProjectConfig(project.name) // Add project configuration for frontend
      };

      try {
        // Enhance with additional data
        const [teamData, iterationsData] = await Promise.all([
          azureDevOpsService.getProjectTeamMembers(project.name),
          azureDevOpsService.getIterations(project.name, 'current'),
        ]);

        // Update with real data
        if (teamData && teamData.members) {
          product.teamSize = teamData.count;
          // Get team lead (first member or admin)
          const teamLead = teamData.members.find(member => 
            member.role && member.role.toLowerCase().includes('lead')
          ) || teamData.members[0];
          product.lead = teamLead?.name || 'No assigned lead';
        }

        if (iterationsData && iterationsData.iterations && iterationsData.iterations.length > 0) {
          product.currentSprint = iterationsData.iterations[0].name;
        } else {
          product.currentSprint = 'No active sprint';
        }
        
      } catch (enhancementError) {
        logger.warn(`Failed to enhance product ${productId}:`, enhancementError.message);
        // Continue with basic product data
      }

      res.json({
        data: product,
        source: 'Azure DevOps',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching product ${req.params.productId}:`, error);
      
      return res.status(500).json({
        error: 'Failed to fetch product',
        code: 'AZURE_DEVOPS_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   GET /api/products/:productId/metrics
 * @desc    Get product metrics from Azure DevOps
 * @access  Private
 * @query   ?sprintId=sprint-123&startDate=2024-01-01&endDate=2024-01-31
 */
router.get('/:productId/metrics',
  [
    param('productId').notEmpty().withMessage('Product ID is required'),
    query('sprintId').optional().notEmpty().withMessage('Sprint ID cannot be empty'),
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

      const { productId } = req.params;
      const { sprintId, startDate, endDate } = req.query;

      logger.info(`Fetching metrics for product ${productId} from Azure DevOps`, {
        productId,
        filters: { sprintId, startDate, endDate },
        userId: req.user.id,
      });

      // First, verify the product exists
      const projectsData = await azureDevOpsService.getProjects();
      const project = projectsData?.projects?.find(p => p.id === productId);
      
      if (!project) {
        return res.status(404).json({
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND',
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      // Check if the project is enabled in our configuration
      if (!isProjectEnabled(project.name)) {
        return res.status(403).json({
          error: 'Product metrics access denied',
          code: 'PRODUCT_DISABLED',
          message: `Metrics access to project '${project.name}' is currently disabled`,
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        // Get work items for the project to calculate metrics
        const workItemsQuery = {
          projectName: project.name,
          iterationPath: sprintId ? `${project.name}\\${sprintId}` : null,
        };

        // Add date filters if provided
        if (startDate && endDate) {
          workItemsQuery.customQuery = `
            SELECT [System.Id], [System.Title], [System.WorkItemType], 
                   [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints],
                   [System.CreatedDate], [System.ChangedDate]
            FROM WorkItems 
            WHERE [System.TeamProject] = '${project.name}'
            AND [System.ChangedDate] >= '${startDate}'
            AND [System.ChangedDate] <= '${endDate}'
            AND [System.State] <> 'Removed'
            ORDER BY [System.ChangedDate] DESC
          `;
        }

        const workItemsResult = await azureDevOpsService.getWorkItems(workItemsQuery);
        const workItemIds = workItemsResult.workItems.map(wi => wi.id);
        
        let workItemDetails = { workItems: [] };
        if (workItemIds.length > 0) {
          workItemDetails = await azureDevOpsService.getWorkItemDetails(workItemIds, null, project.name);
        }

        // Calculate metrics from real work items
        const workItems = workItemDetails.workItems || [];
        const totalItems = workItems.length;
        const completedItems = workItems.filter(wi => 
          wi.state && (wi.state.toLowerCase().includes('done') || 
                      wi.state.toLowerCase().includes('closed') || 
                      wi.state.toLowerCase().includes('resolved'))
        ).length;
        const inProgressItems = workItems.filter(wi => 
          wi.state && (wi.state.toLowerCase().includes('active') || 
                      wi.state.toLowerCase().includes('progress'))
        ).length;
        const newItems = workItems.filter(wi => 
          wi.state && wi.state.toLowerCase().includes('new')
        ).length;

        // Calculate velocity (story points completed)
        const completedStoryPoints = workItems
          .filter(wi => wi.state && 
            (wi.state.toLowerCase().includes('done') || 
             wi.state.toLowerCase().includes('closed') || 
             wi.state.toLowerCase().includes('resolved')))
          .reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);

        // Calculate average cycle time (simplified)
        const completedWithDates = workItems.filter(wi => 
          wi.closedDate && wi.createdDate
        );
        const avgCycleTime = completedWithDates.length > 0 
          ? completedWithDates.reduce((sum, wi) => {
              const created = new Date(wi.createdDate);
              const closed = new Date(wi.closedDate);
              return sum + ((closed - created) / (1000 * 60 * 60 * 24)); // days
            }, 0) / completedWithDates.length
          : 0;

        const metrics = {
          productId,
          projectName: project.name,
          period: {
            sprintId,
            startDate,
            endDate,
          },
          performance: {
            velocity: completedStoryPoints,
            burndownRate: totalItems > 0 ? (completedItems / totalItems) : 0,
            averageCycleTime: Math.round(avgCycleTime * 10) / 10,
            completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
          },
          workItems: {
            total: totalItems,
            completed: completedItems,
            inProgress: inProgressItems,
            new: newItems,
            blocked: 0, // Would need to check for blocked state
          },
          trends: {
            velocityTrend: 'stable', // Would need historical data
            qualityTrend: 'stable',
            completionTrend: 'stable',
          },
        };

        res.json({
          data: metrics,
          source: 'Azure DevOps',
          timestamp: new Date().toISOString(),
        });

      } catch (metricsError) {
        logger.error(`Error calculating metrics for product ${productId}:`, metricsError);
        
        return res.status(500).json({
          error: 'Failed to calculate metrics',
          code: 'METRICS_CALCULATION_ERROR',
          message: metricsError.message,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error) {
      logger.error(`Error fetching metrics for product ${productId}:`, error);
      
      return res.status(500).json({
        error: 'Failed to fetch product metrics',
        code: 'AZURE_DEVOPS_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   GET /api/products/config
 * @desc    Get project configuration and filtering status
 * @access  Private
 */
router.get('/config',
  async (req, res, next) => {
    try {
      const { getProjectStats, getEnabledProjects } = require('../src/config/projectMapping');
      
      logger.info(`Fetching project configuration for user ${req.user.email}`, {
        userId: req.user.id,
      });

      const stats = getProjectStats();
      const enabledProjects = getEnabledProjects();

      res.json({
        data: {
          stats,
          enabledProjects,
          configuration: 'PMP and DaaS projects only',
          lastUpdated: new Date().toISOString()
        },
        message: 'Currently showing only Partner Management Platform (PMP) and Data as a Service (DaaS) projects',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching project configuration:', error);
      
      return res.status(500).json({
        error: 'Failed to fetch project configuration',
        code: 'CONFIG_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   POST /api/products
 * @desc    Create new product (Admin only)
 * @access  Private (Admin)
 */
router.post('/',
  requireRoles(['Admin', 'ProductManager']),
  async (req, res, next) => {
    try {
      // Implementation for creating a new product
      res.status(501).json({
        error: 'Not implemented',
        code: 'NOT_IMPLEMENTED',
        message: 'Product creation endpoint not yet implemented',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;