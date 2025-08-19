/**
 * Azure DevOps Service Usage Examples
 * Demonstrates how to use the Azure DevOps service for various dashboard scenarios
 */

const { factory } = require('../services/azureDevOpsServiceFactory');
const { 
  calculateVelocity, 
  calculateBurndownData, 
  calculateTeamPerformance,
  calculateQualityMetrics,
  transformForCharts,
  calculateSprintMetrics 
} = require('../utils/dataTransformers');

/**
 * Example 1: Basic setup and work items retrieval
 */
async function basicUsageExample() {
  console.log('=== Basic Usage Example ===');
  
  try {
    // Create service instance
    const azureService = factory.create();
    
    // Get current sprint work items
    const workItemsResult = await azureService.getWorkItems({
      workItemTypes: ['Task', 'Bug', 'User Story'],
      states: ['Active', 'In Progress', 'Resolved', 'Closed']
    });
    
    console.log(`Retrieved ${workItemsResult.returnedCount} work items`);
    console.log('Sample work item:', workItemsResult.workItems[0]);
    
    // Get detailed information for first 5 work items
    if (workItemsResult.workItems.length > 0) {
      const workItemIds = workItemsResult.workItems.slice(0, 5).map(item => item.id);
      const detailsResult = await azureService.getWorkItemDetails(workItemIds);
      
      console.log(`Retrieved details for ${detailsResult.count} work items`);
      console.log('Sample detailed work item:', detailsResult.workItems[0]);
    }
    
  } catch (error) {
    console.error('Basic usage example failed:', error.message);
  }
}

/**
 * Example 2: Sprint performance dashboard
 */
async function sprintDashboardExample() {
  console.log('\n=== Sprint Dashboard Example ===');
  
  try {
    const azureService = factory.create();
    
    // Get current iterations
    const iterationsResult = await azureService.getIterations('your-team-name', 'current');
    
    if (iterationsResult.iterations.length === 0) {
      console.log('No current iterations found');
      return;
    }
    
    const currentIteration = iterationsResult.iterations[0];
    console.log(`Current iteration: ${currentIteration.name}`);
    
    // Get work items for current iteration
    const workItemsResult = await azureService.getWorkItems({
      iterationPath: currentIteration.path,
      workItemTypes: ['Task', 'Bug', 'User Story']
    });
    
    if (workItemsResult.workItems.length > 0) {
      // Get detailed work item information
      const workItemIds = workItemsResult.workItems.map(item => item.id);
      const detailsResult = await azureService.getWorkItemDetails(workItemIds);
      const workItems = detailsResult.workItems;
      
      // Calculate sprint metrics
      const sprintMetrics = calculateSprintMetrics(workItems, {
        name: currentIteration.name,
        startDate: currentIteration.attributes?.startDate,
        endDate: currentIteration.attributes?.finishDate
      });
      
      console.log('Sprint Metrics:', sprintMetrics);
      
      // Calculate burndown data
      if (currentIteration.attributes?.startDate && currentIteration.attributes?.finishDate) {
        const burndownData = calculateBurndownData(
          workItems,
          currentIteration.attributes.startDate,
          currentIteration.attributes.finishDate
        );
        
        console.log('Burndown Data:', {
          totalStoryPoints: burndownData.totalStoryPoints,
          completionPercentage: burndownData.completionPercentage,
          daysInSprint: burndownData.ideal.length - 1
        });
      }
      
      // Calculate team performance
      const teamPerformance = calculateTeamPerformance(workItems);
      console.log('Team Performance:', {
        totalMembers: teamPerformance.totalMembers,
        teamTotals: teamPerformance.teamTotals,
        topPerformers: teamPerformance.teamMembers
          .sort((a, b) => b.storyPointsDelivered - a.storyPointsDelivered)
          .slice(0, 3)
          .map(member => ({ name: member.name, storyPoints: member.storyPointsDelivered }))
      });
      
      // Get team capacity
      try {
        const capacityResult = await azureService.getTeamCapacity('your-team-name', currentIteration.id);
        console.log('Team Capacity:', {
          totalCapacity: capacityResult.totalCapacity,
          memberCount: capacityResult.memberCount
        });
      } catch (error) {
        console.warn('Could not retrieve team capacity:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Sprint dashboard example failed:', error.message);
  }
}

/**
 * Example 3: Quality metrics analysis
 */
async function qualityMetricsExample() {
  console.log('\n=== Quality Metrics Example ===');
  
  try {
    const azureService = factory.create();
    
    // Get work items from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const customQuery = `
      SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], [System.State], 
             [Microsoft.VSTS.Scheduling.StoryPoints], [System.CreatedDate], [System.ChangedDate],
             [Microsoft.VSTS.Common.ClosedDate], [Microsoft.VSTS.Common.Priority]
      FROM WorkItems 
      WHERE [System.TeamProject] = @project 
      AND [System.CreatedDate] >= '${thirtyDaysAgo.toISOString()}'
      AND [System.State] <> 'Removed'
      ORDER BY [System.CreatedDate] DESC
    `;
    
    const workItemsResult = await azureService.getWorkItems({ customQuery });
    
    if (workItemsResult.workItems.length > 0) {
      const workItemIds = workItemsResult.workItems.map(item => item.id);
      const detailsResult = await azureService.getWorkItemDetails(workItemIds);
      const workItems = detailsResult.workItems;
      
      // Calculate quality metrics
      const qualityMetrics = calculateQualityMetrics(workItems);
      console.log('Quality Metrics:', qualityMetrics);
      
      // Transform data for charts
      const chartData = {
        byType: transformForCharts(workItems, 'type'),
        byState: transformForCharts(workItems, 'state'),
        byPriority: transformForCharts(workItems, 'priority')
      };
      
      console.log('Chart Data:', {
        workItemTypes: chartData.byType.chartData,
        stateDistribution: chartData.byState.chartData,
        priorityDistribution: chartData.byPriority.chartData
      });
    }
    
  } catch (error) {
    console.error('Quality metrics example failed:', error.message);
  }
}

/**
 * Example 4: Individual performance tracking
 */
async function individualPerformanceExample() {
  console.log('\n=== Individual Performance Example ===');
  
  try {
    const azureService = factory.create();
    
    // Get work items assigned to specific user
    const assignedToUser = 'user@company.com'; // Replace with actual user email
    
    const workItemsResult = await azureService.getWorkItems({
      assignedTo: assignedToUser,
      workItemTypes: ['Task', 'Bug', 'User Story']
    });
    
    if (workItemsResult.workItems.length > 0) {
      const workItemIds = workItemsResult.workItems.map(item => item.id);
      const detailsResult = await azureService.getWorkItemDetails(workItemIds);
      const workItems = detailsResult.workItems;
      
      // Calculate individual performance
      const teamMembers = [{ email: assignedToUser, name: 'Sample User' }];
      const performance = calculateTeamPerformance(workItems, teamMembers);
      const userPerformance = performance.teamMembers[0];
      
      console.log('Individual Performance:', {
        name: userPerformance.name,
        tasksCompleted: userPerformance.tasksCompleted,
        storyPointsDelivered: userPerformance.storyPointsDelivered,
        averageCycleTime: userPerformance.averageCycleTime,
        bugsFixed: userPerformance.bugsFixed,
        bugsCreated: userPerformance.bugsCreated
      });
      
      // Velocity over time (last 30 days)
      const velocity = calculateVelocity(
        workItems,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString()
      );
      
      console.log('30-day Velocity:', velocity);
    }
    
  } catch (error) {
    console.error('Individual performance example failed:', error.message);
  }
}

/**
 * Example 5: Batch processing and caching demonstration
 */
async function batchProcessingExample() {
  console.log('\n=== Batch Processing Example ===');
  
  try {
    const azureService = factory.create();
    
    // First call - will hit API
    console.time('First call (API)');
    const result1 = await azureService.getWorkItems({
      workItemTypes: ['Task', 'User Story'],
      maxResults: 50
    });
    console.timeEnd('First call (API)');
    console.log(`First call returned ${result1.returnedCount} items`);
    
    // Second call - should use cache
    console.time('Second call (Cache)');
    const result2 = await azureService.getWorkItems({
      workItemTypes: ['Task', 'User Story'],
      maxResults: 50
    });
    console.timeEnd('Second call (Cache)');
    console.log(`Second call returned ${result2.returnedCount} items`);
    
    // Batch get details for multiple work items
    if (result1.workItems.length > 10) {
      const workItemIds = result1.workItems.slice(0, 150).map(item => item.id); // Large batch
      
      console.time('Batch details retrieval');
      const detailsResult = await azureService.getWorkItemDetails(workItemIds);
      console.timeEnd('Batch details retrieval');
      console.log(`Retrieved details for ${detailsResult.count} items in batches`);
    }
    
    // Show service health
    const health = azureService.getServiceHealth();
    console.log('Service Health:', health);
    
  } catch (error) {
    console.error('Batch processing example failed:', error.message);
  }
}

/**
 * Example 6: Error handling and resilience
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  try {
    // Create service with invalid configuration
    const invalidService = factory.create({
      organization: 'invalid-org',
      project: 'invalid-project',
      pat: 'invalid-pat'
    }, 'invalid-instance');
    
    // This should fail gracefully
    await invalidService.getWorkItems();
    
  } catch (error) {
    console.log('Expected error caught:', error.message);
  }
  
  try {
    const azureService = factory.create();
    
    // Invalid work item IDs
    await azureService.getWorkItemDetails([999999, 999998]);
    
  } catch (error) {
    console.log('Invalid work item IDs error:', error.message);
  }
  
  try {
    const azureService = factory.create();
    
    // Invalid team capacity request
    await azureService.getTeamCapacity('nonexistent-team', 'invalid-iteration-id');
    
  } catch (error) {
    console.log('Invalid team capacity error:', error.message);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('Azure DevOps Service Usage Examples');
  console.log('====================================');
  
  // Check configuration first
  const { validateConfig } = require('../config/azureDevOpsConfig');
  const validation = validateConfig();
  
  if (!validation.isValid) {
    console.error('Configuration validation failed:', validation.errors);
    console.log('Please set up your environment variables in .env file');
    return;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings);
  }
  
  await basicUsageExample();
  await sprintDashboardExample();
  await qualityMetricsExample();
  await individualPerformanceExample();
  await batchProcessingExample();
  await errorHandlingExample();
  
  console.log('\n=== Examples completed ===');
}

// Export examples for individual testing
module.exports = {
  basicUsageExample,
  sprintDashboardExample,
  qualityMetricsExample,
  individualPerformanceExample,
  batchProcessingExample,
  errorHandlingExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}