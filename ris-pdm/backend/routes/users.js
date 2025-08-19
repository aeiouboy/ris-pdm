const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');

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

      // Mock individual performance data
      const performance = {
        userId,
        period: {
          type: period,
          startDate,
          endDate,
        },
        user: {
          id: userId,
          name: userId === req.user.id ? req.user.name : 'Team Member',
          email: userId === req.user.id ? req.user.email : 'team.member@company.com',
          role: 'Senior Developer',
          team: 'Core Platform Team',
          manager: 'John Doe',
        },
        metrics: {
          productivity: {
            workItemsCompleted: 23,
            storyPointsDelivered: 45,
            averageCycleTime: 3.2,
            commitmentReliability: 87.5,
          },
          quality: {
            codeReviewScore: 8.7,
            bugReports: 2,
            testCoverage: 92.3,
            codeComplexity: 'low',
          },
          collaboration: {
            peerRating: 8.9,
            mentorshipHours: 12,
            knowledgeSharing: 15,
            meetingParticipation: 85,
          },
          skills: {
            technical: 8.5,
            domain: 7.8,
            leadership: 6.9,
            communication: 8.2,
          },
        },
        goals: [
          {
            id: 'goal-1',
            title: 'Improve code review turnaround time',
            progress: 75,
            target: 'Complete within 24 hours',
            status: 'on-track',
          },
          {
            id: 'goal-2',
            title: 'Complete Azure certification',
            progress: 45,
            target: 'Pass exam by end of quarter',
            status: 'at-risk',
          },
        ],
        feedback: [
          {
            date: '2024-01-15',
            type: 'peer',
            rating: 9,
            comment: 'Excellent technical leadership in sprint planning',
            author: 'Anonymous',
          },
          {
            date: '2024-01-10',
            type: 'manager',
            rating: 8,
            comment: 'Strong performance on complex features',
            author: 'John Doe',
          },
        ],
        trends: {
          productivity: 'increasing',
          quality: 'stable',
          collaboration: 'increasing',
        },
      };

      res.json({
        data: performance,
        timestamp: new Date().toISOString(),
      });
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

      // Mock users data
      const mockUsers = [
        {
          id: 'user-1',
          name: 'Alice Johnson',
          email: 'alice.johnson@company.com',
          role: 'Senior Developer',
          team: 'Core Platform Team',
          status: 'active',
          manager: 'John Doe',
          joinDate: '2023-03-15',
          skills: ['React', 'Node.js', 'Azure'],
          currentSprint: 'Sprint 24.3',
        },
        {
          id: 'user-2',
          name: 'Bob Wilson',
          email: 'bob.wilson@company.com',
          role: 'Frontend Developer',
          team: 'Core Platform Team',
          status: 'active',
          manager: 'John Doe',
          joinDate: '2023-07-20',
          skills: ['React', 'TypeScript', 'CSS'],
          currentSprint: 'Sprint 24.3',
        },
        {
          id: 'user-3',
          name: 'Carol Davis',
          email: 'carol.davis@company.com',
          role: 'QA Engineer',
          team: 'Claims Processing Team',
          status: 'active',
          manager: 'Jane Smith',
          joinDate: '2023-01-10',
          skills: ['Testing', 'Automation', 'Selenium'],
          currentSprint: 'Sprint 24.3',
        },
      ];

      // Apply filters
      let filteredUsers = mockUsers.filter(user => user.status === status);

      if (team) {
        filteredUsers = filteredUsers.filter(user => 
          user.team.toLowerCase().includes(team.toLowerCase())
        );
      }

      if (role) {
        filteredUsers = filteredUsers.filter(user => 
          user.role.toLowerCase().includes(role.toLowerCase())
        );
      }

      // Apply pagination
      const total = filteredUsers.length;
      const users = filteredUsers.slice(offset, offset + parseInt(limit));

      res.json({
        data: users,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + users.length < total,
        },
        timestamp: new Date().toISOString(),
      });
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

      // Mock user data
      const user = {
        id: userId,
        name: userId === req.user.id ? req.user.name : 'Team Member',
        email: userId === req.user.id ? req.user.email : 'team.member@company.com',
        role: 'Senior Developer',
        team: 'Core Platform Team',
        status: 'active',
        manager: 'John Doe',
        joinDate: '2023-03-15',
        skills: ['React', 'Node.js', 'Azure', 'JavaScript', 'TypeScript'],
        certifications: ['Azure Developer Associate', 'Scrum Master'],
        currentProjects: ['RIS Core Platform', 'Claims Processing Module'],
        recentActivity: [
          {
            date: '2024-01-20',
            action: 'Completed feature: User Authentication',
            type: 'development',
          },
          {
            date: '2024-01-19',
            action: 'Code review: Payment Processing',
            type: 'review',
          },
        ],
      };

      res.json({
        data: user,
        timestamp: new Date().toISOString(),
      });
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