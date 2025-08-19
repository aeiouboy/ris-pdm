const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User validation
  userId: Joi.string().alphanum().min(3).max(50).required(),
  userEmail: Joi.string().email().required(),
  userName: Joi.string().min(2).max(100).required(),

  // Product validation
  productId: Joi.string().pattern(/^prod-[a-zA-Z0-9]+$/).required(),
  productName: Joi.string().min(3).max(200).required(),

  // Date validation
  date: Joi.date().iso().required(),
  dateOptional: Joi.date().iso().optional(),

  // Pagination
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(200).default(50),
    offset: Joi.number().integer().min(0).default(0),
  }),

  // Work item validation
  workItemId: Joi.number().integer().min(1).required(),
  workItemType: Joi.string().valid('Epic', 'Feature', 'User Story', 'Task', 'Bug').required(),
  workItemState: Joi.string().valid('New', 'Active', 'Resolved', 'Closed', 'Removed').required(),
  priority: Joi.number().integer().min(1).max(4).required(),

  // Metrics validation
  metricType: Joi.string().valid(
    'velocity',
    'burndown',
    'quality',
    'productivity',
    'satisfaction',
    'delivery'
  ).required(),

  period: Joi.string().valid('sprint', 'month', 'quarter', 'year').default('sprint'),

  // Azure DevOps specific
  iteration: Joi.string().min(3).max(100).optional(),
  areaPath: Joi.string().min(3).max(200).optional(),

  // Performance metrics
  performanceMetrics: Joi.object({
    velocity: Joi.number().min(0).max(1000).optional(),
    burndownRate: Joi.number().min(0).max(1).optional(),
    defectDensity: Joi.number().min(0).optional(),
    codeQuality: Joi.number().min(0).max(10).optional(),
    testCoverage: Joi.number().min(0).max(100).optional(),
    productivity: Joi.number().min(0).max(100).optional(),
    collaboration: Joi.number().min(0).max(100).optional(),
    satisfaction: Joi.number().min(0).max(10).optional(),
  }),
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorDetails,
        timestamp: new Date().toISOString(),
      });
    }

    // Replace the original property with the validated value
    req[property] = value;
    next();
  };
};

// Common validation combinations
const validations = {
  // Query parameter validations
  paginationQuery: validate(schemas.pagination, 'query'),
  
  // Product validations
  productIdParam: validate(Joi.object({
    productId: schemas.productId,
  }), 'params'),

  productQuery: validate(Joi.object({
    status: Joi.string().valid('active', 'inactive', 'archived').optional(),
    ...schemas.pagination.describe().keys,
  }), 'query'),

  // User validations
  userIdParam: validate(Joi.object({
    userId: schemas.userId,
  }), 'params'),

  userPerformanceQuery: validate(Joi.object({
    period: schemas.period,
    startDate: schemas.dateOptional,
    endDate: schemas.dateOptional,
  }), 'query'),

  // Work item validations
  workItemIdParam: validate(Joi.object({
    workItemId: schemas.workItemId,
  }), 'params'),

  workItemQuery: validate(Joi.object({
    assignedTo: schemas.userId.optional(),
    state: schemas.workItemState.optional(),
    workItemType: schemas.workItemType.optional(),
    iteration: schemas.iteration,
    area: schemas.areaPath,
    priority: schemas.priority.optional(),
    ...schemas.pagination.describe().keys,
  }), 'query'),

  // Metrics validations
  metricsQuery: validate(Joi.object({
    period: schemas.period,
    startDate: schemas.dateOptional,
    endDate: schemas.dateOptional,
    sprintId: Joi.string().optional(),
  }), 'query'),

  trendsQuery: validate(Joi.object({
    metric: schemas.metricType,
    period: schemas.period,
    range: Joi.number().integer().min(1).max(12).default(6),
  }), 'query'),

  // Profile update validation
  profileUpdateBody: validate(Joi.object({
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark').optional(),
      notifications: Joi.boolean().optional(),
      dashboardLayout: Joi.string().valid('default', 'compact', 'detailed').optional(),
      timeZone: Joi.string().optional(),
    }).optional(),
    skills: Joi.array().items(Joi.string().min(2).max(50)).optional(),
  }), 'body'),
};

// Custom validation functions
const customValidations = {
  // Validate date range
  validateDateRange: (startDate, endDate) => {
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      throw new Error('Start date must be before end date');
    }
  },

  // Validate sprint period
  validateSprintPeriod: (startDate, endDate) => {
    if (startDate && endDate) {
      const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) {
        throw new Error('Sprint period cannot exceed 30 days');
      }
    }
  },

  // Validate user permissions
  validateUserAccess: (requestingUserId, targetUserId, userRoles) => {
    const isOwnData = requestingUserId === targetUserId;
    const hasManagerRole = userRoles.includes('Manager') || userRoles.includes('Admin');
    
    if (!isOwnData && !hasManagerRole) {
      throw new Error('Insufficient permissions to access user data');
    }
  },
};

module.exports = {
  schemas,
  validate,
  validations,
  customValidations,
};