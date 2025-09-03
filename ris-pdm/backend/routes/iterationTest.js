/**
 * Iteration Testing API Routes
 * Test endpoints for the new multi-project iteration support
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const AzureDevOpsService = require('../src/services/azureDevOpsService');

// Initialize Azure DevOps service
const azureService = new AzureDevOpsService();

/**
 * Test iteration resolution for both DaaS and PMP projects
 */
router.get('/test-iteration/:projectId/:iterationRequest?', async (req, res) => {
  try {
    const { projectId, iterationRequest = 'current' } = req.params;
    
    logger.info(`🧪 Testing iteration resolution: ${projectId} → ${iterationRequest}`);
    
    // Test the new intelligent iteration resolution
    const resolution = await azureService.resolveIterationIntelligent(projectId, iterationRequest);
    
    // Also get examples for this project
    const examples = azureService.iterationMapper.getIterationExamples(projectId);
    const validation = azureService.iterationMapper.validateIterationName(projectId, iterationRequest);
    
    const response = {
      timestamp: new Date().toISOString(),
      test: {
        projectId,
        requestedIteration: iterationRequest
      },
      resolution,
      validation,
      examples,
      supportedProjects: azureService.iterationMapper.getSupportedProjects()
    };
    
    if (resolution.success) {
      logger.info(`✅ Test successful: ${iterationRequest} → ${resolution.resolvedIteration}`);
      res.json(response);
    } else {
      logger.warn(`⚠️ Test failed: ${resolution.error}`);
      res.status(404).json(response);
    }
    
  } catch (error) {
    logger.error('Error testing iteration resolution:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get all supported iteration patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const supportedProjects = azureService.iterationMapper.getSupportedProjects();
    
    res.json({
      timestamp: new Date().toISOString(),
      supportedProjects,
      testEndpoints: {
        daasCurrentSprint: '/api/iteration-test/test-iteration/Product - Data as a Service/current',
        daasSpecific: '/api/iteration-test/test-iteration/Product - Data as a Service/DaaS 12',
        pmpCurrentSprint: '/api/iteration-test/test-iteration/Product - Partner Management Platform/current',
        pmpSpecific: '/api/iteration-test/test-iteration/Product - Partner Management Platform/Delivery 4'
      }
    });
    
  } catch (error) {
    logger.error('Error getting iteration patterns:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test validation for iteration names
 */
router.post('/validate', async (req, res) => {
  try {
    const { projectId, iterationName } = req.body;
    
    if (!projectId || !iterationName) {
      return res.status(400).json({
        error: 'projectId and iterationName are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const validation = azureService.iterationMapper.validateIterationName(projectId, iterationName);
    
    res.json({
      timestamp: new Date().toISOString(),
      validation,
      input: { projectId, iterationName }
    });
    
  } catch (error) {
    logger.error('Error validating iteration name:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;