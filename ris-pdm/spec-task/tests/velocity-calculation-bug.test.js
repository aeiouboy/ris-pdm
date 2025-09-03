/**
 * TDD Test Case: Critical Velocity Calculation Bug
 * 
 * This test reproduces the velocity calculation bug described in the specification:
 * - Location: backend/src/services/metricsCalculator.js:1364
 * - Issue: Shows total committed story points instead of completed story points
 * - Impact: Misleading velocity metrics affecting sprint planning
 */

const MetricsCalculatorService = require('../../backend/src/services/metricsCalculator');

// Mock Azure DevOps service for testing
const createMockAzureDevOpsService = () => ({
  initialize: jest.fn().mockResolvedValue(true),
  getWorkItems: jest.fn(),
  getWorkItemDetails: jest.fn(),
  getCurrentIteration: jest.fn(),
  getTeamMembers: jest.fn(),
  filterMembersByProject: jest.fn()
});

describe('❌ FAILING TEST: Critical Velocity Calculation Bug', () => {
  let metricsCalculator;
  let mockAzureService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAzureService = createMockAzureDevOpsService();
    metricsCalculator = new MetricsCalculatorService(mockAzureService);
  });

  test('should show completed story points, not total committed - BUG REPRODUCTION', async () => {
    // Given: Sprint with mixed work item states (real-world scenario)
    const mockWorkItems = [
      { id: 1, storyPoints: 8, state: 'Done', type: 'User Story', closedDate: '2024-01-05T10:00:00Z' },        // ✅ Completed
      { id: 2, storyPoints: 5, state: 'Done', type: 'User Story', closedDate: '2024-01-06T14:00:00Z' },        // ✅ Completed  
      { id: 3, storyPoints: 3, state: 'In Progress', type: 'User Story' }, // ❌ Not completed
      { id: 4, storyPoints: 2, state: 'To Do', type: 'User Story' }        // ❌ Not completed
    ];

    // Mock the method that contains the bug
    jest.spyOn(metricsCalculator, 'getWorkItemsForProduct').mockResolvedValue(mockWorkItems);

    // When: Detailed KPI calculation is performed (this calls the buggy code)
    const kpis = await metricsCalculator.calculateDetailedKPIs({
      productId: 'test-product',
      sprintId: 'current'
    });

    // Then: Velocity should show only COMPLETED story points
    const expectedCompletedPoints = 8 + 5; // = 13 (only Done items)
    const incorrectTotalCommitted = 8 + 5 + 3 + 2; // = 18 (all items - this is the bug)

    console.log(`
🔍 Velocity Calculation Bug Analysis:
📊 Expected (Completed): ${expectedCompletedPoints} story points
❌ Current Bug Shows: ${kpis.velocity.value} story points  
💼 Impact: ${kpis.velocity.value > expectedCompletedPoints ? 'OVERREPORTING' : 'CORRECT'} by ${Math.abs(kpis.velocity.value - expectedCompletedPoints)} points
🎯 Business Impact: ${((Math.abs(kpis.velocity.value - expectedCompletedPoints) / expectedCompletedPoints) * 100).toFixed(1)}% velocity error
    `);

    // This test will FAIL because of the bug on line 1364:
    // "value: totalCommittedStoryPoints" should be "value: velocity.storyPoints"
    expect(kpis.velocity.value).toBe(expectedCompletedPoints);
    expect(kpis.velocity.value).not.toBe(incorrectTotalCommitted);
  });

  test('edge case: all work items completed should match total committed', async () => {
    // Given: All work items are completed
    const mockWorkItems = [
      { id: 1, storyPoints: 8, state: 'Done', type: 'User Story', closedDate: '2024-01-03T09:00:00Z' },
      { id: 2, storyPoints: 5, state: 'Closed', type: 'User Story', closedDate: '2024-01-04T11:00:00Z' },
      { id: 3, storyPoints: 3, state: 'Resolved', type: 'User Story', closedDate: '2024-01-05T15:00:00Z' }
    ];

    jest.spyOn(metricsCalculator, 'getWorkItemsForProduct').mockResolvedValue(mockWorkItems);

    const kpis = await metricsCalculator.calculateDetailedKPIs({
      productId: 'test-product',
      sprintId: 'current'
    });

    const totalPoints = 8 + 5 + 3; // = 16
    
    // In this case, the bug might accidentally show correct result
    // But for wrong reasons (showing committed instead of completed)
    expect(kpis.velocity.value).toBe(totalPoints);
  });

  test('edge case: no completed work items should show zero velocity', async () => {
    // Given: No work items are completed
    const mockWorkItems = [
      { id: 1, storyPoints: 8, state: 'To Do', type: 'User Story' },
      { id: 2, storyPoints: 5, state: 'In Progress', type: 'User Story' },
      { id: 3, storyPoints: 3, state: 'New', type: 'User Story' }
    ];

    jest.spyOn(metricsCalculator, 'getWorkItemsForProduct').mockResolvedValue(mockWorkItems);

    const kpis = await metricsCalculator.calculateDetailedKPIs({
      productId: 'test-product',
      sprintId: 'current'
    });

    // Should be 0 since no items are completed
    // But the bug will show 16 (total committed)
    expect(kpis.velocity.value).toBe(0);
    expect(kpis.velocity.value).not.toBe(16);
  });

  test('business impact analysis: realistic sprint scenario', async () => {
    // Given: Realistic sprint with varying completion rates
    const mockWorkItems = [
      // High priority items - completed
      { id: 1, storyPoints: 13, state: 'Done', type: 'Feature', priority: 1, closedDate: '2024-01-08T16:00:00Z' },
      { id: 2, storyPoints: 8, state: 'Done', type: 'User Story', priority: 1, closedDate: '2024-01-09T12:00:00Z' },
      
      // Medium priority - mixed completion
      { id: 3, storyPoints: 5, state: 'Done', type: 'User Story', priority: 2, closedDate: '2024-01-10T10:00:00Z' },
      { id: 4, storyPoints: 5, state: 'In Progress', type: 'User Story', priority: 2 },
      
      // Lower priority - not completed
      { id: 5, storyPoints: 8, state: 'To Do', type: 'User Story', priority: 3 },
      { id: 6, storyPoints: 3, state: 'To Do', type: 'Bug', priority: 3 }
    ];

    jest.spyOn(metricsCalculator, 'getWorkItemsForProduct').mockResolvedValue(mockWorkItems);

    const kpis = await metricsCalculator.calculateDetailedKPIs({
      productId: 'sprint-analysis',
      sprintId: 'sprint-23'
    });

    const actualCompleted = 13 + 8 + 5; // 26 story points
    const totalCommitted = 13 + 8 + 5 + 5 + 8 + 3; // 42 story points
    const completionRate = (actualCompleted / totalCommitted) * 100; // 61.9%

    console.log(`
📈 Sprint Performance Analysis:
✅ Actually Completed: ${actualCompleted} story points
📋 Total Committed: ${totalCommitted} story points
📊 Real Completion Rate: ${completionRate.toFixed(1)}%
❌ Bug Impact: Shows ${((totalCommitted / actualCompleted - 1) * 100).toFixed(1)}% inflated velocity
    `);

    // This demonstrates how the bug affects sprint planning
    expect(kpis.velocity.value).toBe(actualCompleted);
  });
});