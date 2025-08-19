const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');

/**
 * @route   GET /api/workitems
 * @desc    Get work items from Azure DevOps
 * @access  Private
 * @query   ?assignedTo=userId&state=Active&workItemType=Feature&limit=50&offset=0
 */
router.get('/',
  [
    query('assignedTo').optional().notEmpty().withMessage('Assigned to cannot be empty'),
    query('state').optional().isIn(['New', 'Active', 'Resolved', 'Closed', 'Removed']).withMessage('Invalid state'),
    query('workItemType').optional().isIn(['Epic', 'Feature', 'User Story', 'Task', 'Bug']).withMessage('Invalid work item type'),
    query('iteration').optional().notEmpty().withMessage('Iteration cannot be empty'),
    query('area').optional().notEmpty().withMessage('Area cannot be empty'),
    query('priority').optional().isIn(['1', '2', '3', '4']).withMessage('Invalid priority'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
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

      const {
        assignedTo,
        state,
        workItemType,
        iteration,
        area,
        priority,
        limit = 50,
        offset = 0,
      } = req.query;

      logger.info(`Fetching work items for user ${req.user.email}`, {
        filters: { assignedTo, state, workItemType, iteration, area, priority, limit, offset },
        userId: req.user.id,
      });

      // Mock work items data - replace with actual Azure DevOps API calls
      const mockWorkItems = [
        {
          id: 12345,
          title: 'Implement user authentication service',
          type: 'Feature',
          state: 'Active',
          assignedTo: {
            id: 'user-1',
            name: 'Alice Johnson',
            email: 'alice.johnson@company.com',
          },
          createdBy: {
            id: 'user-manager',
            name: 'John Doe',
            email: 'john.doe@company.com',
          },
          priority: 2,
          severity: 'Medium',
          storyPoints: 8,
          effort: 13,
          businessValue: 50,
          tags: ['authentication', 'security', 'backend'],
          iteration: 'Sprint 24.3',
          area: 'RIS Core Platform\\Security',
          createdDate: '2024-01-15T10:30:00Z',
          changedDate: '2024-01-20T14:45:00Z',
          description: 'Implement OAuth 2.0 authentication service with Azure AD integration',
          acceptanceCriteria: [
            'Users can login with Azure AD credentials',
            'JWT tokens are issued upon successful authentication',
            'Token refresh mechanism is implemented',
          ],
          links: [
            {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: 'https://dev.azure.com/org/project/_apis/wit/workItems/12300',
              title: 'Authentication Epic',
            },
          ],
          comments: [
            {
              id: 1,
              text: 'Started implementation of OAuth flow',
              createdBy: 'Alice Johnson',
              createdDate: '2024-01-18T09:15:00Z',
            },
          ],
        },
        {
          id: 12346,
          title: 'Fix login redirect issue',
          type: 'Bug',
          state: 'New',
          assignedTo: {
            id: 'user-2',
            name: 'Bob Wilson',
            email: 'bob.wilson@company.com',
          },
          createdBy: {
            id: 'user-qa',
            name: 'Carol Davis',
            email: 'carol.davis@company.com',
          },
          priority: 1,
          severity: 'High',
          storyPoints: 3,
          effort: 5,
          businessValue: 20,
          tags: ['bug', 'authentication', 'frontend'],
          iteration: 'Sprint 24.3',
          area: 'RIS Core Platform\\UI',
          createdDate: '2024-01-20T16:20:00Z',
          changedDate: '2024-01-20T16:20:00Z',
          description: 'Users are not redirected to the correct page after login',
          reproducationSteps: [
            'Navigate to login page',
            'Enter valid credentials',
            'Click login button',
            'Observe incorrect redirect',
          ],
          links: [],
          comments: [],
        },
        {
          id: 12347,
          title: 'Update claims processing workflow',
          type: 'User Story',
          state: 'Active',
          assignedTo: {
            id: 'user-3',
            name: 'David Chen',
            email: 'david.chen@company.com',
          },
          createdBy: {
            id: 'user-po',
            name: 'Emma Product Owner',
            email: 'emma.po@company.com',
          },
          priority: 2,
          severity: 'Medium',
          storyPoints: 5,
          effort: 8,
          businessValue: 30,
          tags: ['claims', 'workflow', 'process'],
          iteration: 'Sprint 24.3',
          area: 'Claims Processing\\Workflow',
          createdDate: '2024-01-12T11:00:00Z',
          changedDate: '2024-01-19T13:30:00Z',
          description: 'As a claims processor, I want an updated workflow to handle complex claims more efficiently',
          acceptanceCriteria: [
            'New workflow handles multi-step approvals',
            'Automated routing based on claim type',
            'Email notifications for status changes',
          ],
          links: [],
          comments: [
            {
              id: 1,
              text: 'Working on workflow design document',
              createdBy: 'David Chen',
              createdDate: '2024-01-19T13:30:00Z',
            },
          ],
        },
      ];

      // Apply filters
      let filteredWorkItems = [...mockWorkItems];

      if (assignedTo) {
        filteredWorkItems = filteredWorkItems.filter(item => 
          item.assignedTo && item.assignedTo.id === assignedTo
        );
      }

      if (state) {
        filteredWorkItems = filteredWorkItems.filter(item => item.state === state);
      }

      if (workItemType) {
        filteredWorkItems = filteredWorkItems.filter(item => item.type === workItemType);
      }

      if (iteration) {
        filteredWorkItems = filteredWorkItems.filter(item => 
          item.iteration && item.iteration.includes(iteration)
        );
      }

      if (area) {
        filteredWorkItems = filteredWorkItems.filter(item => 
          item.area && item.area.includes(area)
        );
      }

      if (priority) {
        filteredWorkItems = filteredWorkItems.filter(item => 
          item.priority === parseInt(priority)
        );
      }

      // Apply pagination
      const total = filteredWorkItems.length;
      const workItems = filteredWorkItems.slice(offset, offset + parseInt(limit));

      res.json({
        data: workItems,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + workItems.length < total,
        },
        filters: {
          assignedTo,
          state,
          workItemType,
          iteration,
          area,
          priority,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/workitems/:workItemId
 * @desc    Get specific work item by ID
 * @access  Private
 */
router.get('/:workItemId',
  [
    param('workItemId').isInt({ min: 1 }).withMessage('Work item ID must be a positive integer'),
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

      const { workItemId } = req.params;

      logger.info(`Fetching work item ${workItemId} for user ${req.user.email}`, {
        workItemId,
        userId: req.user.id,
      });

      // Mock detailed work item - replace with Azure DevOps API call
      const workItem = {
        id: parseInt(workItemId),
        title: 'Implement user authentication service',
        type: 'Feature',
        state: 'Active',
        assignedTo: {
          id: 'user-1',
          name: 'Alice Johnson',
          email: 'alice.johnson@company.com',
          avatar: 'https://avatar.example.com/alice.jpg',
        },
        createdBy: {
          id: 'user-manager',
          name: 'John Doe',
          email: 'john.doe@company.com',
        },
        priority: 2,
        severity: 'Medium',
        storyPoints: 8,
        effort: 13,
        businessValue: 50,
        tags: ['authentication', 'security', 'backend'],
        iteration: 'Sprint 24.3',
        area: 'RIS Core Platform\\Security',
        createdDate: '2024-01-15T10:30:00Z',
        changedDate: '2024-01-20T14:45:00Z',
        description: 'Implement OAuth 2.0 authentication service with Azure AD integration for secure user login and token management.',
        acceptanceCriteria: [
          'Users can login with Azure AD credentials',
          'JWT tokens are issued upon successful authentication',
          'Token refresh mechanism is implemented',
          'Logout functionality clears tokens',
          'Error handling for failed authentication',
        ],
        tasks: [
          {
            id: 12348,
            title: 'Setup Azure AD app registration',
            state: 'Closed',
            assignedTo: 'Alice Johnson',
            estimatedHours: 2,
          },
          {
            id: 12349,
            title: 'Implement OAuth 2.0 flow',
            state: 'Active',
            assignedTo: 'Alice Johnson',
            estimatedHours: 8,
          },
          {
            id: 12350,
            title: 'Add JWT token management',
            state: 'New',
            assignedTo: 'Alice Johnson',
            estimatedHours: 3,
          },
        ],
        history: [
          {
            date: '2024-01-20T14:45:00Z',
            user: 'Alice Johnson',
            field: 'State',
            oldValue: 'New',
            newValue: 'Active',
          },
          {
            date: '2024-01-18T09:15:00Z',
            user: 'Alice Johnson',
            field: 'Assigned To',
            oldValue: 'Unassigned',
            newValue: 'Alice Johnson',
          },
        ],
        attachments: [
          {
            id: 'att-1',
            name: 'authentication-flow.png',
            size: 125680,
            uploadedBy: 'John Doe',
            uploadedDate: '2024-01-15T11:00:00Z',
            url: 'https://dev.azure.com/org/project/_apis/wit/attachments/att-1',
          },
        ],
        links: [
          {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            workItemId: 12300,
            title: 'Authentication Epic',
            type: 'Epic',
          },
          {
            rel: 'System.LinkTypes.Related',
            workItemId: 12346,
            title: 'Fix login redirect issue',
            type: 'Bug',
          },
        ],
        comments: [
          {
            id: 1,
            text: 'Started implementation of OAuth flow. Azure AD app registration is complete.',
            createdBy: {
              name: 'Alice Johnson',
              email: 'alice.johnson@company.com',
            },
            createdDate: '2024-01-18T09:15:00Z',
          },
          {
            id: 2,
            text: 'Please ensure error handling covers all Azure AD error scenarios.',
            createdBy: {
              name: 'John Doe',
              email: 'john.doe@company.com',
            },
            createdDate: '2024-01-19T14:20:00Z',
          },
        ],
      };

      if (parseInt(workItemId) !== 12345) {
        return res.status(404).json({
          error: 'Work item not found',
          code: 'WORK_ITEM_NOT_FOUND',
          workItemId: parseInt(workItemId),
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        data: workItem,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/workitems/iterations
 * @desc    Get available iterations/sprints
 * @access  Private
 */
router.get('/meta/iterations', async (req, res, next) => {
  try {
    logger.info(`Fetching iterations for user ${req.user.email}`, {
      userId: req.user.id,
    });

    // Mock iterations data
    const iterations = [
      {
        id: 'iter-243',
        name: 'Sprint 24.3',
        path: '\\RIS\\2024\\Sprint 24.3',
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-01-28T23:59:59Z',
        state: 'current',
        workItemCount: 23,
      },
      {
        id: 'iter-242',
        name: 'Sprint 24.2',
        path: '\\RIS\\2024\\Sprint 24.2',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-14T23:59:59Z',
        state: 'closed',
        workItemCount: 28,
      },
      {
        id: 'iter-244',
        name: 'Sprint 24.4',
        path: '\\RIS\\2024\\Sprint 24.4',
        startDate: '2024-01-29T00:00:00Z',
        endDate: '2024-02-11T23:59:59Z',
        state: 'future',
        workItemCount: 15,
      },
    ];

    res.json({
      data: iterations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/workitems/areas
 * @desc    Get available area paths
 * @access  Private
 */
router.get('/meta/areas', async (req, res, next) => {
  try {
    logger.info(`Fetching area paths for user ${req.user.email}`, {
      userId: req.user.id,
    });

    // Mock area paths data
    const areas = [
      {
        id: 'area-1',
        name: 'RIS Core Platform',
        path: '\\RIS Core Platform',
        hasChildren: true,
        children: [
          {
            id: 'area-1-1',
            name: 'Security',
            path: '\\RIS Core Platform\\Security',
            hasChildren: false,
          },
          {
            id: 'area-1-2',
            name: 'UI',
            path: '\\RIS Core Platform\\UI',
            hasChildren: false,
          },
          {
            id: 'area-1-3',
            name: 'API',
            path: '\\RIS Core Platform\\API',
            hasChildren: false,
          },
        ],
      },
      {
        id: 'area-2',
        name: 'Claims Processing',
        path: '\\Claims Processing',
        hasChildren: true,
        children: [
          {
            id: 'area-2-1',
            name: 'Workflow',
            path: '\\Claims Processing\\Workflow',
            hasChildren: false,
          },
          {
            id: 'area-2-2',
            name: 'Reporting',
            path: '\\Claims Processing\\Reporting',
            hasChildren: false,
          },
        ],
      },
    ];

    res.json({
      data: areas,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/workitems/:workItemId
 * @desc    Update work item (limited fields)
 * @access  Private
 */
router.put('/:workItemId',
  [
    param('workItemId').isInt({ min: 1 }).withMessage('Work item ID must be a positive integer'),
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

      const { workItemId } = req.params;
      const updates = req.body;

      logger.info(`Updating work item ${workItemId} for user ${req.user.email}`, {
        workItemId,
        updates: Object.keys(updates),
        userId: req.user.id,
      });

      // In a real implementation, validate updates and call Azure DevOps API
      res.status(501).json({
        error: 'Not implemented',
        code: 'NOT_IMPLEMENTED',
        message: 'Work item updates not yet implemented',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;