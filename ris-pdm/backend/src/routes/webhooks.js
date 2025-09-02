/**
 * Azure DevOps Webhook Routes
 * 
 * Express.js routes for handling incoming webhooks from Azure DevOps.
 * Provides endpoints for work item events and webhook management.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AzureDevOpsWebhookService = require('../services/azureDevOpsWebhookService');
const logger = require('../../utils/logger');

const router = express.Router();

// Rate limiting for webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for requests from Azure DevOps IP ranges
    // In production, implement proper Azure DevOps IP validation
    return process.env.NODE_ENV === 'development';
  }
});

// Initialize webhook service
let webhookService = null;

/**
 * Initialize webhook service with dependencies
 * @param {Object} dependencies - Service dependencies
 */
function initializeWebhookService(dependencies) {
  webhookService = new AzureDevOpsWebhookService({
    cacheService: dependencies.cacheService,
    webSocketService: dependencies.webSocketService,
    azureDevOpsService: dependencies.azureDevOpsService,
    logger: logger.child({ component: 'WebhookRoutes' })
  });
  
  logger.info('Webhook service initialized');
  return webhookService;
}

/**
 * Middleware to ensure webhook service is initialized
 */
const ensureWebhookService = (req, res, next) => {
  if (!webhookService) {
    return res.status(500).json({
      success: false,
      error: 'Webhook service not initialized',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * Middleware for raw body parsing (required for signature validation)
 */
const rawBodyParser = express.raw({ 
  type: 'application/json',
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

/**
 * POST /webhooks/azure/workitems
 * Handle Azure DevOps work item webhooks
 */
router.post('/azure/workitems', 
  webhookLimiter,
  rawBodyParser,
  ensureWebhookService,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Parse JSON body
      let payload;
      try {
        payload = JSON.parse(req.rawBody || req.body);
      } catch (error) {
        logger.error('Failed to parse webhook payload:', error.message);
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON payload',
          timestamp: new Date().toISOString()
        });
      }
      
      // Get signature from headers
      const signature = req.get('X-Hub-Signature-256') || req.get('X-Hub-Signature');
      
      // Log incoming webhook
      logger.info('Received Azure DevOps webhook', {
        eventType: payload.eventType,
        workItemId: payload.resource?.id,
        sourceIp: req.ip,
        userAgent: req.get('User-Agent'),
        hasSignature: !!signature
      });
      
      // Process webhook
      const result = await webhookService.processWebhook(payload, signature);
      
      const processingTime = Date.now() - startTime;
      
      // Log result
      if (result.success) {
        logger.info('Webhook processed successfully', {
          eventType: result.eventType,
          eventId: result.eventId,
          processingTime: `${processingTime}ms`
        });
      } else {
        logger.error('Webhook processing failed', {
          eventType: result.eventType,
          error: result.error,
          processingTime: `${processingTime}ms`
        });
      }
      
      // Return response
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json({
        ...result,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Webhook endpoint error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /webhooks/azure/status
 * Get webhook service status and statistics
 */
router.get('/azure/status', ensureWebhookService, (req, res) => {
  try {
    const statistics = webhookService.getStatistics();
    
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting webhook status:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /webhooks/azure/metrics
 * Get comprehensive webhook metrics and performance data
 */
router.get('/azure/metrics', ensureWebhookService, (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const detailedMetrics = webhookService.getDetailedMetrics(timeframe);
    
    res.json({
      success: true,
      data: {
        timeframe,
        ...detailedMetrics,
        systemHealth: {
          status: detailedMetrics.successRate >= 95 ? 'healthy' : 
                  detailedMetrics.successRate >= 90 ? 'warning' : 'critical',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting webhook metrics:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhooks/azure/test
 * Test webhook endpoint with sample data
 */
router.post('/azure/test',
  webhookLimiter,
  ensureWebhookService,
  [
    body('eventType').isString().notEmpty().withMessage('Event type is required'),
    body('resource').isObject().withMessage('Resource object is required'),
    body('resource.id').isNumeric().withMessage('Work item ID is required')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          timestamp: new Date().toISOString()
        });
      }
      
      const testPayload = {
        ...req.body,
        subscriptionId: 'test-subscription',
        notificationId: Date.now(),
        id: `test-${Date.now()}`,
        eventType: req.body.eventType,
        publisherId: 'tfs',
        scope: 'all',
        message: {
          text: 'Test webhook event',
          html: '<p>Test webhook event</p>',
          markdown: '**Test webhook event**'
        },
        detailedMessage: {
          text: `Test ${req.body.eventType} event for work item ${req.body.resource.id}`,
          html: `<p>Test ${req.body.eventType} event for work item ${req.body.resource.id}</p>`,
          markdown: `**Test ${req.body.eventType} event for work item ${req.body.resource.id}**`
        },
        createdDate: new Date().toISOString(),
        resource: {
          ...req.body.resource,
          fields: {
            'System.Id': req.body.resource.id,
            'System.Title': req.body.resource.fields?.['System.Title'] || 'Test Work Item',
            'System.WorkItemType': req.body.resource.fields?.['System.WorkItemType'] || 'Task',
            'System.State': req.body.resource.fields?.['System.State'] || 'New',
            'System.ChangedDate': new Date().toISOString(),
            'System.ChangedBy': {
              displayName: 'Test User',
              uniqueName: 'test.user@company.com'
            },
            ...req.body.resource.fields
          }
        }
      };
      
      logger.info('Processing test webhook event', {
        eventType: testPayload.eventType,
        workItemId: testPayload.resource.id,
        sourceIp: req.ip
      });
      
      const result = await webhookService.processWebhook(testPayload);
      
      res.json({
        success: true,
        message: 'Test webhook processed',
        result,
        testPayload: {
          eventType: testPayload.eventType,
          workItemId: testPayload.resource.id,
          title: testPayload.resource.fields['System.Title']
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Test webhook error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Test webhook failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * DELETE /webhooks/azure/queue
 * Clear webhook event queue
 */
router.delete('/azure/queue', ensureWebhookService, (req, res) => {
  try {
    webhookService.clearQueue();
    
    res.json({
      success: true,
      message: 'Webhook queue cleared',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error clearing webhook queue:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear webhook queue',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /webhooks/azure/stats
 * Reset webhook statistics
 */
router.delete('/azure/stats', ensureWebhookService, (req, res) => {
  try {
    webhookService.resetStatistics();
    
    res.json({
      success: true,
      message: 'Webhook statistics reset',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error resetting webhook statistics:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to reset webhook statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /webhooks/azure/alerts
 * Get webhook monitoring alerts and thresholds
 */
router.get('/azure/alerts', ensureWebhookService, (req, res) => {
  try {
    const alerts = webhookService.getAlertStatus();
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting webhook alerts:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook alerts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhooks/azure/alerts/configure
 * Configure webhook monitoring alerts and thresholds
 */
router.post('/azure/alerts/configure', ensureWebhookService, [
  body('successRateThreshold').optional().isNumeric().withMessage('Success rate threshold must be a number'),
  body('processingTimeThreshold').optional().isNumeric().withMessage('Processing time threshold must be a number'),
  body('errorRateThreshold').optional().isNumeric().withMessage('Error rate threshold must be a number'),
  body('queueSizeThreshold').optional().isNumeric().withMessage('Queue size threshold must be a number')
], (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }
    
    const result = webhookService.configureAlerts(req.body);
    
    res.json({
      success: true,
      message: 'Alert configuration updated',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error configuring webhook alerts:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to configure webhook alerts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /webhooks/azure/config
 * Get webhook configuration and setup instructions
 */
router.get('/azure/config', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const webhookUrl = `${baseUrl}/webhooks/azure/workitems`;
  
  res.json({
    success: true,
    data: {
      webhookUrl,
      supportedEvents: [
        'workitem.created',
        'workitem.updated', 
        'workitem.deleted',
        'workitem.restored',
        'workitem.commented'
      ],
      configuration: {
        signatureValidation: process.env.AZURE_DEVOPS_WEBHOOK_SECRET ? 'enabled' : 'disabled',
        rateLimiting: {
          windowMs: '1 minute',
          maxRequests: 100
        }
      },
      setupInstructions: {
        step1: 'Go to Azure DevOps Project Settings > Service hooks',
        step2: 'Create a new service hook subscription',
        step3: 'Select "Web Hooks" as the service',
        step4: `Set URL to: ${webhookUrl}`,
        step5: 'Configure events: Work item created, updated, deleted, restored, commented',
        step6: 'Set secret token if signature validation is enabled',
        step7: 'Test the webhook to ensure it works'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Export router and initialization function
module.exports = {
  router,
  initializeWebhookService
};