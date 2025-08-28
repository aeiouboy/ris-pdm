const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');
const AzureDevOpsService = require('../src/services/azureDevOpsService');

// Initialize Azure DevOps service
const azureDevOpsService = new AzureDevOpsService();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', async (req, res, next) => {
  try {
    logger.info(`Fetching profile for user ${req.user.email}`, {
      userId: req.user.id,
    });

    // In a real implementation, fetch additional user data from database
    const userProfile = {
      ...req.user,
      preferences: {
        theme: 'light',
        notifications: true,
        dashboardLayout: 'default',
        timeZone: 'UTC',
      },
      permissions: {
        canViewAllProducts: req.user.roles.includes('Admin') || req.user.roles.includes('Manager'),
        canEditProducts: req.user.roles.includes('Admin') || req.user.roles.includes('ProductManager'),
        canViewTeamMetrics: true,
        canExportData: req.user.roles.includes('Admin') || req.user.roles.includes('Manager'),
      },
      lastLogin: new Date().toISOString(),
    };

    res.json({
      data: userProfile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/users/:userId/performance
 * @desc    Get individual performance metrics
 * @access  Private
 */
router.get('/:userId/performance',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
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

      const { userId } = req.params;
      const { period = 'sprint', startDate, endDate } = req.query;

      // Check if user can access this data
      if (userId !== req.user.id && !req.user.roles.includes('Manager') && !req.user.roles.includes('Admin')) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED',
          message: 'You can only view your own performance data',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Fetching performance for user ${userId}`, {
        userId,
        period,
        startDate,
        endDate,
        requestedBy: req.user.id,
      });

      try {
        // Get user data from Azure DevOps team members
        const allTeamMembers = await azureDevOpsService.getTeamMembers();
        const user = allTeamMembers.find(member => 
          member.id === userId || member.email === userId
        );

        if (!user && userId !== req.user.id) {
          return res.status(404).json({
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            userId,
            timestamp: new Date().toISOString(),
          });
        }

        // Build query for user's work items
        const workItemsQuery = {
          assignedTo: user ? user.email : req.user.email,
        };

        // Add date filters if provided
        if (startDate && endDate) {
          workItemsQuery.customQuery = `
            SELECT [System.Id], [System.Title], [System.WorkItemType], 
                   [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints],
                   [System.CreatedDate], [System.ChangedDate], [Microsoft.VSTS.Common.ClosedDate]
            FROM WorkItems 
            WHERE [System.AssignedTo] = '${user ? user.email : req.user.email}'
            AND [System.ChangedDate] >= '${startDate}'
            AND [System.ChangedDate] <= '${endDate}'
            AND [System.State] <> 'Removed'
            ORDER BY [System.ChangedDate] DESC
          `;
        }

        // Get user's work items
        const workItemsResult = await azureDevOpsService.getWorkItems(workItemsQuery);
        const workItemIds = workItemsResult.workItems.map(wi => wi.id);
        
        let workItemDetails = { workItems: [] };
        if (workItemIds.length > 0) {
          workItemDetails = await azureDevOpsService.getWorkItemDetails(workItemIds);
        }

        // Calculate performance metrics from real work items
        const workItems = workItemDetails.workItems || [];
        const totalItems = workItems.length;
        const completedItems = workItems.filter(wi => 
          wi.state && (wi.state.toLowerCase().includes('done') || 
                      wi.state.toLowerCase().includes('closed') || 
                      wi.state.toLowerCase().includes('resolved'))
        ).length;

        const storyPointsDelivered = workItems
          .filter(wi => wi.state && 
            (wi.state.toLowerCase().includes('done') || 
             wi.state.toLowerCase().includes('closed') || 
             wi.state.toLowerCase().includes('resolved')))
          .reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);

        // Calculate average cycle time
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

        // Calculate commitment reliability (completed vs total assigned)
        const commitmentReliability = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

        const performance = {
          userId,
          period: {
            type: period,
            startDate,
            endDate,
          },
          user: {
            id: userId,
            name: user ? user.name : req.user.name,
            email: user ? user.email : req.user.email,
            role: user ? user.role : 'Developer',
            team: 'Azure DevOps Team',
            manager: 'Team Lead', // Would need additional API call to get manager
          },
          metrics: {
            productivity: {
              workItemsCompleted: completedItems,
              storyPointsDelivered: storyPointsDelivered,
              averageCycleTime: Math.round(avgCycleTime * 10) / 10,
              commitmentReliability: Math.round(commitmentReliability * 10) / 10,
            },
            quality: {
              bugReports: workItems.filter(wi => 
                wi.type && wi.type.toLowerCase().includes('bug')
              ).length,
              testCoverage: null, // Would need integration with code quality tools
              codeComplexity: 'unknown', // Would need integration with code analysis tools
            },
            collaboration: {
              workItemsCreated: workItems.filter(wi => 
                wi.createdBy === (user ? user.email : req.user.email)
              ).length,
              totalAssignments: totalItems,
            },
          },
          trends: {
            productivity: 'stable', // Would need historical data
            quality: 'stable',
            collaboration: 'stable',
          },
          source: 'Azure DevOps'
        };

        res.json({
          data: performance,
          timestamp: new Date().toISOString(),
        });

      } catch (azureError) {
        logger.error(`Error fetching performance data for user ${userId}:`, azureError);
        
        return res.status(500).json({
          error: 'Failed to fetch performance data',
          code: 'AZURE_DEVOPS_ERROR',
          message: azureError.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/users
 * @desc    Get all users (Manager/Admin only)
 * @access  Private (Manager, Admin)
 */
router.get('/',
  requireRoles(['Manager', 'Admin']),
  [
    query('team').optional().notEmpty().withMessage('Team filter cannot be empty'),
    query('role').optional().notEmpty().withMessage('Role filter cannot be empty'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
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

      const { team, role, status = 'active', limit = 50, offset = 0 } = req.query;

      logger.info(`Fetching users for manager ${req.user.email}`, {
        filters: { team, role, status, limit, offset },
        requestedBy: req.user.id,
      });

      try {
        // Get all team members from Azure DevOps
        const allTeamMembers = await azureDevOpsService.getTeamMembers();
        
        if (!allTeamMembers || allTeamMembers.length === 0) {
          return res.status(503).json({
            error: 'Azure DevOps service unavailable',
            code: 'AZURE_DEVOPS_UNAVAILABLE',
            message: 'Failed to fetch team members from Azure DevOps',
            timestamp: new Date().toISOString(),
          });
        }

        // Transform Azure DevOps team members to user format
        let users = allTeamMembers.map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role || 'Developer',
          team: 'Azure DevOps Team', // Could be enhanced with actual team data
          status: member.isActive ? 'active' : 'inactive',
          manager: 'Team Lead', // Would need additional API call to get manager
          joinDate: null, // Would need additional API call or HR integration
          skills: [], // Would need additional API call or profile data
          currentSprint: 'Current Sprint', // Could be enhanced with iteration data
          avatar: member.avatar,
          azureDevOpsUser: true,
        }));

        // Apply status filter
        users = users.filter(user => user.status === status);

        // Apply team filter
        if (team) {
          users = users.filter(user => 
            user.team.toLowerCase().includes(team.toLowerCase())
          );
        }

        // Apply role filter
        if (role) {
          users = users.filter(user => 
            user.role.toLowerCase().includes(role.toLowerCase())
          );
        }

        // Apply pagination
        const total = users.length;
        const paginatedUsers = users.slice(offset, offset + parseInt(limit));

        res.json({
          data: paginatedUsers,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: offset + paginatedUsers.length < total,
          },
          source: 'Azure DevOps',
          timestamp: new Date().toISOString(),
        });

      } catch (azureError) {
        logger.error('Error fetching team members from Azure DevOps:', azureError);
        
        return res.status(500).json({
          error: 'Failed to fetch users',
          code: 'AZURE_DEVOPS_ERROR',
          message: azureError.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID (Manager/Admin only or own profile)
 * @access  Private
 */
router.get('/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
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

      // Check if user can access this data
      if (userId !== req.user.id && !req.user.roles.includes('Manager') && !req.user.roles.includes('Admin')) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED',
          message: 'You can only view your own profile',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Fetching user ${userId}`, {
        userId,
        requestedBy: req.user.id,
      });

      try {
        // Get all team members from Azure DevOps
        const allTeamMembers = await azureDevOpsService.getTeamMembers();
        const azureUser = allTeamMembers.find(member => 
          member.id === userId || member.email === userId
        );

        if (!azureUser && userId !== req.user.id) {
          return res.status(404).json({
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            userId,
            timestamp: new Date().toISOString(),
          });
        }

        // Use Azure DevOps data or current user data
        const user = azureUser ? {
          id: azureUser.id,
          name: azureUser.name,
          email: azureUser.email,
          role: azureUser.role || 'Developer',
          team: 'Azure DevOps Team',
          status: azureUser.isActive ? 'active' : 'inactive',
          manager: 'Team Lead', // Would need additional API call
          joinDate: null, // Would need additional API call or HR integration
          skills: [], // Would need additional API call or profile data
          certifications: [], // Would need additional API call
          currentProjects: [], // Could be enhanced with project assignment data
          avatar: azureUser.avatar,
          azureDevOpsUser: true,
          recentActivity: [], // Could be enhanced with work item activity
        } : {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role || 'Developer',
          team: 'Azure DevOps Team',
          status: 'active',
          manager: 'Team Lead',
          joinDate: null,
          skills: [],
          certifications: [],
          currentProjects: [],
          recentActivity: [],
        };

        // Enhance with recent work item activity if possible
        try {
          const workItemsQuery = {
            assignedTo: user.email,
            maxResults: 10
          };
          const recentWorkItems = await azureDevOpsService.getWorkItems(workItemsQuery);
          
          if (recentWorkItems && recentWorkItems.workItems.length > 0) {
            const workItemIds = recentWorkItems.workItems.slice(0, 5).map(wi => wi.id);
            const workItemDetails = await azureDevOpsService.getWorkItemDetails(workItemIds);
            
            user.recentActivity = workItemDetails.workItems.map(wi => ({
              date: wi.changedDate,
              action: `Work item: ${wi.title}`,
              type: wi.type?.toLowerCase() || 'development',
              workItemId: wi.id,
              state: wi.state
            }));
          }
        } catch (activityError) {
          logger.warn(`Failed to get recent activity for user ${userId}:`, activityError.message);
          // Continue without recent activity
        }

        res.json({
          data: user,
          source: 'Azure DevOps',
          timestamp: new Date().toISOString(),
        });

      } catch (azureError) {
        logger.error(`Error fetching user ${userId} from Azure DevOps:`, azureError);
        
        return res.status(500).json({
          error: 'Failed to fetch user',
          code: 'AZURE_DEVOPS_ERROR',
          message: azureError.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/profile', async (req, res, next) => {
  try {
    const { preferences, skills } = req.body;

    logger.info(`Updating profile for user ${req.user.email}`, {
      userId: req.user.id,
      updates: { preferences: !!preferences, skills: !!skills },
    });

    // Mock update response
    const updatedProfile = {
      ...req.user,
      preferences: preferences || {
        theme: 'light',
        notifications: true,
        dashboardLayout: 'default',
        timeZone: 'UTC',
      },
      skills: skills || ['JavaScript', 'React', 'Node.js'],
      lastUpdated: new Date().toISOString(),
    };

    res.json({
      data: updatedProfile,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;