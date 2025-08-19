const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');

// Mock data for demonstration - replace with actual database/service calls
const mockProducts = [
  {
    id: 'prod-1',
    name: 'RIS Core Platform',
    description: 'Core insurance platform',
    teamSize: 12,
    currentSprint: 'Sprint 24.3',
    status: 'active',
    lead: 'John Doe',
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'prod-2',
    name: 'Claims Processing Module',
    description: 'Claims processing and management',
    teamSize: 8,
    currentSprint: 'Sprint 24.3',
    status: 'active',
    lead: 'Jane Smith',
    createdAt: '2024-02-01T00:00:00Z',
  },
];

/**
 * @route   GET /api/products
 * @desc    Get all products
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

      logger.info(`Fetching products for user ${req.user.email}`, {
        filters: { status, limit, offset },
        userId: req.user.id,
      });

      // Filter products based on query parameters
      let filteredProducts = [...mockProducts];

      if (status) {
        filteredProducts = filteredProducts.filter(p => p.status === status);
      }

      // Apply pagination
      const total = filteredProducts.length;
      const products = filteredProducts.slice(offset, offset + parseInt(limit));

      res.json({
        data: products,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + products.length < total,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/:productId
 * @desc    Get product by ID
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

      logger.info(`Fetching product ${productId} for user ${req.user.email}`, {
        productId,
        userId: req.user.id,
      });

      const product = mockProducts.find(p => p.id === productId);

      if (!product) {
        return res.status(404).json({
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND',
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        data: product,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/products/:productId/metrics
 * @desc    Get product metrics
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

      logger.info(`Fetching metrics for product ${productId}`, {
        productId,
        filters: { sprintId, startDate, endDate },
        userId: req.user.id,
      });

      // Check if product exists
      const product = mockProducts.find(p => p.id === productId);
      if (!product) {
        return res.status(404).json({
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND',
          productId,
          timestamp: new Date().toISOString(),
        });
      }

      // Mock metrics data - replace with actual service call
      const metrics = {
        productId,
        period: {
          sprintId,
          startDate,
          endDate,
        },
        performance: {
          velocity: 45.8,
          burndownRate: 0.85,
          defectDensity: 2.3,
          codeQuality: 8.7,
          testCoverage: 87.5,
        },
        workItems: {
          total: 120,
          completed: 98,
          inProgress: 15,
          blocked: 7,
        },
        teamMetrics: {
          productivity: 78.9,
          collaboration: 82.1,
          satisfaction: 7.8,
        },
        trends: {
          velocityTrend: 'increasing',
          qualityTrend: 'stable',
          satisfactionTrend: 'increasing',
        },
      };

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