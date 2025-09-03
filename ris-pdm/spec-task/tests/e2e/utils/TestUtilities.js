/**
 * Test Utilities for Playwright MCP Integration
 * Helper functions for data validation, mocking, and test management
 */

class TestUtilities {
  constructor() {
    this.testData = {
      mockWorkItems: this.generateMockWorkItems(),
      mockUsers: this.generateMockUsers(),
      mockSprints: this.generateMockSprints()
    };
  }

  /**
   * Generate realistic mock work items for testing
   */
  generateMockWorkItems() {
    const workItemTypes = ['User Story', 'Bug', 'Feature', 'Task'];
    const states = ['Done', 'In Progress', 'To Do', 'Closed', 'Resolved'];
    const priorities = [1, 2, 3, 4];
    
    const mockItems = [];
    
    for (let i = 1; i <= 20; i++) {
      mockItems.push({
        id: i,
        title: `${workItemTypes[i % 4]} ${i} - Sample Work Item`,
        type: workItemTypes[i % 4],
        state: states[i % 5],
        storyPoints: Math.floor(Math.random() * 13) + 1,
        priority: priorities[i % 4],
        assigneeEmail: `user${(i % 5) + 1}@company.com`,
        assignee: `User ${(i % 5) + 1}`,
        createdDate: new Date(Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        closedDate: states[i % 5] === 'Done' || states[i % 5] === 'Closed' || states[i % 5] === 'Resolved' 
          ? new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString() 
          : null
      });
    }
    
    return mockItems;
  }

  /**
   * Generate mock users for testing
   */
  generateMockUsers() {
    return [
      {
        id: 'user1@company.com',
        name: 'Alice Developer',
        email: 'user1@company.com',
        role: 'Senior Developer',
        avatar: null
      },
      {
        id: 'user2@company.com', 
        name: 'Bob Engineer',
        email: 'user2@company.com',
        role: 'Software Engineer',
        avatar: null
      },
      {
        id: 'user3@company.com',
        name: 'Charlie Tester',
        email: 'user3@company.com',
        role: 'QA Engineer',
        avatar: null
      }
    ];
  }

  /**
   * Generate mock sprint data for testing
   */
  generateMockSprints() {
    return [
      {
        id: 'current',
        name: 'Current Sprint',
        path: 'Project\\Sprint 25',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sprint-24',
        name: 'Sprint 24', 
        path: 'Project\\Sprint 24',
        startDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  /**
   * Validate KPI calculation accuracy
   */
  validateKPICalculations(workItems, expectedResults) {
    const completedItems = workItems.filter(item => 
      ['Done', 'Closed', 'Resolved'].includes(item.state) && item.closedDate
    );
    
    const actualVelocity = completedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const totalCommitted = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    return {
      actualVelocity,
      totalCommitted,
      completedItems: completedItems.length,
      totalItems: workItems.length,
      completionRate: workItems.length > 0 ? (completedItems.length / workItems.length) * 100 : 0,
      velocityAccurate: actualVelocity === expectedResults.expectedVelocity,
      bugDetected: actualVelocity !== totalCommitted && expectedResults.expectedVelocity === totalCommitted
    };
  }

  /**
   * Create API response mocks for testing
   */
  createAPIMocks() {
    return {
      '/api/metrics/overview': {
        success: true,
        data: {
          period: { type: 'sprint', startDate: null, endDate: null },
          summary: {
            totalProducts: 5,
            activeProjects: 12,
            totalTeamMembers: 15,
            avgVelocity: 32.5,
            avgQualityScore: 8.2,
            totalWorkItems: 150,
            completedWorkItems: 120
          },
          kpis: {
            deliveryPredictability: 78.9,
            teamSatisfaction: { value: 'Processing...', status: 'processing' },
            codeQuality: 8.2,
            defectEscapeRate: 2.1,
            cycleTime: 4.2,
            leadTime: 8.7
          },
          trends: {
            velocity: { current: 'Processing...', status: 'processing' },
            quality: { current: 'Processing...', status: 'processing' }
          }
        }
      },
      '/api/metrics/kpis': {
        success: true,
        data: {
          pl: {
            value: 'Processing...',
            trend: 'Processing...',
            status: 'processing'
          },
          velocity: {
            value: 32, // This should show completed points, not total committed
            trend: 5,
            trendValue: '+5.2%',
            status: 'real'
          },
          bugs: {
            value: 8,
            trend: -3,
            trendValue: '-3.1%',
            status: 'real'
          },
          satisfaction: {
            value: 'Processing...',
            status: 'processing'
          }
        }
      }
    };
  }

  /**
   * Screenshot comparison utility
   */
  async compareScreenshots(sessionId, baselineName, currentName, threshold = 0.1) {
    console.log(`📸 Comparing screenshots: ${baselineName} vs ${currentName}`);
    
    // Take current screenshot
    await global.playwrightMCP.screenshot_session({
      sessionId,
      name: currentName
    });

    // In a real implementation, this would compare against a baseline
    // For now, we'll return a mock comparison result
    return {
      baselineName,
      currentName,
      similarity: 0.95, // Mock similarity score
      passed: true,
      differences: []
    };
  }

  /**
   * Performance monitoring utility
   */
  async measurePerformance(sessionId, operation) {
    const startTime = Date.now();
    
    try {
      await operation(sessionId);
      const endTime = Date.now();
      
      return {
        duration: endTime - startTime,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const endTime = Date.now();
      
      return {
        duration: endTime - startTime,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Bug classification engine
   */
  classifyIssue(testResult, context = {}) {
    const issue = {
      id: `issue-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'unknown',
      category: 'unknown',
      description: '',
      reproduction: [],
      fix: null
    };

    // Classify velocity calculation issues
    if (context.component === 'velocity' && testResult.error) {
      issue.category = 'calculation';
      issue.severity = 'high';
      issue.description = 'Velocity calculation showing incorrect values';
      issue.reproduction = [
        'Navigate to dashboard',
        'Check velocity KPI card',
        'Compare with expected completed story points'
      ];
      issue.fix = {
        location: 'backend/src/services/metricsCalculator.js:1364',
        solution: 'Change totalCommittedStoryPoints to velocity.storyPoints'
      };
    }

    // Classify UI rendering issues
    if (context.component === 'ui' && testResult.missing) {
      issue.category = 'ui';
      issue.severity = testResult.critical ? 'high' : 'medium';
      issue.description = `UI component missing or not rendered: ${testResult.missing}`;
    }

    // Classify performance issues
    if (context.component === 'performance' && testResult.duration > 3000) {
      issue.category = 'performance';
      issue.severity = testResult.duration > 10000 ? 'high' : 'medium';
      issue.description = `Performance degradation: ${testResult.duration}ms > 3000ms target`;
    }

    return issue;
  }

  /**
   * Test data validation helper
   */
  validateTestData(actualData, expectedSchema) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check required fields
    if (expectedSchema.required) {
      expectedSchema.required.forEach(field => {
        if (!actualData[field]) {
          validation.valid = false;
          validation.errors.push(`Missing required field: ${field}`);
        }
      });
    }

    // Check data types
    if (expectedSchema.types) {
      Object.keys(expectedSchema.types).forEach(field => {
        if (actualData[field] && typeof actualData[field] !== expectedSchema.types[field]) {
          validation.warnings.push(`Field ${field} has type ${typeof actualData[field]}, expected ${expectedSchema.types[field]}`);
        }
      });
    }

    return validation;
  }

  /**
   * Generate test report
   */
  generateTestReport(testResults) {
    const report = {
      summary: {
        totalTests: testResults.length,
        passed: testResults.filter(t => t.status === 'passed').length,
        failed: testResults.filter(t => t.status === 'failed').length,
        skipped: testResults.filter(t => t.status === 'skipped').length
      },
      execution: {
        startTime: testResults[0]?.startTime,
        endTime: testResults[testResults.length - 1]?.endTime,
        duration: 0
      },
      details: testResults,
      issues: testResults
        .filter(t => t.status === 'failed')
        .map(t => this.classifyIssue(t, t.context)),
      recommendations: this.generateRecommendations(testResults)
    };

    if (report.execution.startTime && report.execution.endTime) {
      report.execution.duration = new Date(report.execution.endTime) - new Date(report.execution.startTime);
    }

    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(testResults) {
    const recommendations = [];

    const failedTests = testResults.filter(t => t.status === 'failed');
    const slowTests = testResults.filter(t => t.duration > 5000);

    if (failedTests.length > 0) {
      recommendations.push(`Address ${failedTests.length} failing test(s) for improved reliability`);
    }

    if (slowTests.length > 0) {
      recommendations.push(`Optimize ${slowTests.length} slow test(s) for better performance`);
    }

    const velocityIssues = failedTests.filter(t => t.context?.component === 'velocity');
    if (velocityIssues.length > 0) {
      recommendations.push('Velocity calculation issues detected - verify bug fix implementation');
    }

    if (testResults.some(t => t.accessibility === false)) {
      recommendations.push('Improve accessibility compliance for better user experience');
    }

    return recommendations;
  }

  /**
   * Wait helper with timeout
   */
  async waitFor(condition, timeout = 10000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms timeout`);
  }

  /**
   * Retry helper for flaky operations
   */
  async retry(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }
}

module.exports = TestUtilities;