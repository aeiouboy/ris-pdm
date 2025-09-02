/**
 * Authentication Routes
 * 
 * Express.js routes for handling OAuth 2.0 authentication flow.
 * Provides endpoints for Azure DevOps OAuth integration.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const AzureOAuthService = require('../services/azureOAuthService');
const logger = require('../../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Initialize OAuth service
let oauthService = null;

/**
 * Initialize OAuth service with configuration
 * @param {Object} config - OAuth configuration
 */
function initializeOAuthService(config = {}) {
  oauthService = new AzureOAuthService(config);
  logger.info('OAuth service initialized', {
    isConfigured: oauthService.isConfigured(),
    scopes: oauthService.scopes
  });
  return oauthService;
}

/**
 * Middleware to ensure OAuth service is initialized
 */
const ensureOAuthService = (req, res, next) => {
  if (!oauthService) {
    oauthService = new AzureOAuthService();
  }
  next();
};

/**
 * GET /auth/status
 * Get OAuth service status and configuration
 */
router.get('/status', ensureOAuthService, (req, res) => {
  try {
    const status = oauthService.healthCheck();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error getting OAuth status:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /auth/oauth/authorize
 * Generate OAuth authorization URL
 */
router.get('/oauth/authorize', 
  ensureOAuthService,
  authLimiter,
  [
    query('state').optional().isString().trim()
  ],
  (req, res) => {
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

      if (!oauthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'OAuth not configured',
          message: 'OAuth 2.0 authentication is not configured. Please set environment variables.',
          timestamp: new Date().toISOString()
        });
      }

      const { state } = req.query;
      const authUrl = oauthService.getAuthorizationUrl(state);

      logger.info('OAuth authorization URL generated', {
        clientId: oauthService.clientId,
        sourceIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: authUrl,
          state: state,
          scopes: oauthService.scopes
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error generating OAuth authorization URL:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /auth/oauth/token
 * Exchange authorization code for access token
 */
router.post('/oauth/token',
  ensureOAuthService,
  authLimiter,
  [
    body('code').isString().notEmpty().withMessage('Authorization code is required'),
    body('state').optional().isString().trim()
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

      if (!oauthService.isConfigured()) {
        return res.status(501).json({
          success: false,
          error: 'OAuth not configured',
          message: 'OAuth 2.0 authentication is not configured.',
          timestamp: new Date().toISOString()
        });
      }

      const { code, state } = req.body;

      logger.info('OAuth token exchange requested', {
        sourceIp: req.ip,
        userAgent: req.get('User-Agent'),
        hasState: !!state
      });

      const tokenResponse = await oauthService.exchangeCodeForToken(code, state);

      // Don't log the actual tokens for security
      logger.info('OAuth token exchange successful', {
        expiresIn: tokenResponse.expiresIn,
        tokenType: tokenResponse.tokenType,
        scope: tokenResponse.scope
      });

      res.json({
        success: true,
        data: {
          tokenType: tokenResponse.tokenType,
          expiresIn: tokenResponse.expiresIn,
          scope: tokenResponse.scope
        },
        message: 'Authentication successful',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('OAuth token exchange failed:', error.message);
      
      res.status(400).json({
        success: false,
        error: 'Token exchange failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /auth/logout
 * Clear authentication tokens
 */
router.post('/logout',
  ensureOAuthService,
  (req, res) => {
    try {
      oauthService.clearTokens();

      logger.info('User logged out', {
        sourceIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Logout successful',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Logout error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Export router and initialization function
module.exports = {
  router,
  initializeOAuthService
};