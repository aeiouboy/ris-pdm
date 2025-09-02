/**
 * Metrics Calculator Service
 * Processes Azure DevOps data to generate dashboard metrics and KPIs
 */

const { mapFrontendProjectToAzure } = require('../config/projectMapping');
const { 
  calculateVelocity, 
  calculateTeamPerformance, 
  calculateQualityMetrics,
  calculateSprintMetrics
} = require('../utils/dataTransformers');

class MetricsCalculatorService {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Calculate overview metrics for the dashboard
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Overview metrics
   */
  async calculateOverviewMetrics(options = {}) {
    const { period = 'sprint', startDate, endDate, productId } = options;
    const cacheKey = `overview_${period}_${startDate}_${endDate}_${productId}`;
    
    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      const workItems = await this.getWorkItemsForPeriod({ startDate, endDate, productId });
      
      // Get current sprint data
      const currentSprint = await this.getCurrentSprintData();
      
      // Calculate basic metrics
      const velocity = calculateVelocity(workItems, startDate, endDate);
      const quality = calculateQualityMetrics(workItems);
      const teamPerformance = calculateTeamPerformance(workItems);
      
      // Calculate KPIs
      const kpis = await this.calculateKPIs(workItems, currentSprint);
      
      // Calculate trends
      const trends = await this.calculateTrends(period);
      
      const overview = {
        period: {
          type: period,
          startDate,
          endDate,
        },
        summary: {
          totalProducts: await this.getTotalProducts(),
          activeProjects: await this.getActiveProjects(),
          totalTeamMembers: teamPerformance.totalMembers,
          avgVelocity: parseFloat(velocity.storyPoints),
          avgQualityScore: this.calculateQualityScore(quality),
          totalWorkItems: workItems.length,
          completedWorkItems: velocity.completedTasks,
        },
        kpis,
        trends,
        alerts: await this.generateAlerts(workItems, kpis)
      };

      this.setCache(cacheKey, overview);
      return overview;
      
    } catch (error) {
      console.error('Error calculating overview metrics:', error);
      throw new Error(`Failed to calculate overview metrics: ${error.message}`);
    }
  }

  /**
   * Calculate detailed metrics for a specific product
   * @param {string} productId - Product identifier
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Product metrics
   */
  async calculateProductMetrics(productId, options = {}) {
    const { period = 'sprint', sprintId } = options;
    const cacheKey = `product_${productId}_${period}_${sprintId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for this product/sprint
      const workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Get sprint information
      const sprintInfo = sprintId ? await this.getSprintInfo(sprintId) : null;
      
      // Calculate metrics
      const velocity = calculateVelocity(workItems, sprintInfo?.startDate, sprintInfo?.endDate);
      const quality = calculateQualityMetrics(workItems);
      const teamPerformance = calculateTeamPerformance(workItems);
      const sprintMetrics = calculateSprintMetrics(workItems, sprintInfo);
      
      const metrics = {
        productId,
        period: {
          type: period,
          sprintId,
        },
        performance: {
          velocity: {
            current: velocity.storyPoints,
            target: sprintInfo?.capacity || 50.0,
            trend: await this.getVelocityTrend(productId),
            history: await this.getVelocityHistory(productId),
          },
          burndown: await this.calculateBurndownData(workItems, sprintInfo),
          quality: {
            codeQuality: this.calculateQualityScore(quality),
            testCoverage: await this.getTestCoverage(productId),
            defectDensity: quality.bugToTaskRatio,
            technicalDebt: await this.getTechnicalDebtScore(productId),
          },
          delivery: {
            commitmentReliability: this.calculateCommitmentReliability(sprintMetrics),
            cycleTime: parseFloat(sprintMetrics.averageCycleTime),
            leadTime: await this.calculateLeadTime(workItems),
            throughput: this.calculateThroughput(velocity),
          },
        },
        workItems: this.categorizeWorkItems(workItems),
        team: {
          size: teamPerformance.totalMembers,
          productivity: this.calculateProductivityScore(teamPerformance),
          collaboration: await this.getCollaborationScore(productId),
          satisfaction: await this.getTeamSatisfaction(productId),
          utilization: this.calculateUtilization(teamPerformance),
        },
        risks: this.identifyRisks(sprintMetrics, quality)
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating product metrics for ${productId}:`, error);
      throw new Error(`Failed to calculate product metrics: ${error.message}`);
    }
  }

  /**
   * Calculate team-specific metrics
   * @param {string} teamId - Team identifier
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Team metrics
   */
  async calculateTeamMetrics(teamId, options = {}) {
    const { period = 'sprint' } = options;
    const cacheKey = `team_${teamId}_${period}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get team information and work items
      const teamInfo = await this.getTeamInfo(teamId);
      const workItems = await this.getWorkItemsForTeam(teamId);
      
      const teamPerformance = calculateTeamPerformance(workItems, teamInfo.members);
      const quality = calculateQualityMetrics(workItems);
      
      const metrics = {
        teamId,
        period: { type: period },
        team: {
          name: teamInfo.name,
          size: teamInfo.members.length,
          lead: teamInfo.lead,
          members: teamInfo.members.map(member => ({
            id: member.id,
            name: member.displayName,
            role: member.role || 'Developer'
          })),
        },
        performance: {
          velocity: calculateVelocity(workItems).storyPoints,
          productivity: this.calculateProductivityScore(teamPerformance),
          collaboration: await this.getCollaborationScore(teamId),
          satisfaction: await this.getTeamSatisfaction(teamId),
          utilization: this.calculateUtilization(teamPerformance),
        },
        workload: this.analyzeWorkload(teamPerformance),
        skills: await this.analyzeTeamSkills(teamId)
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating team metrics for ${teamId}:`, error);
      throw new Error(`Failed to calculate team metrics: ${error.message}`);
    }
  }

  /**
   * Get work items for a specific period
   * @private
   */
  async getWorkItemsForPeriod({ startDate, endDate, productId }) {
    let queryOptions = {
      maxResults: 2000
    };

    if (startDate && endDate) {
      queryOptions.customQuery = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], 
               [System.State], [Microsoft.VSTS.Scheduling.StoryPoints], [System.CreatedDate], 
               [System.ChangedDate], [Microsoft.VSTS.Common.ClosedDate], [System.AreaPath], 
               [System.IterationPath], [Microsoft.VSTS.Common.Priority]
        FROM WorkItems 
        WHERE [System.TeamProject] = @project 
        AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story', 'Feature')
        AND [System.State] <> 'Removed'
        AND [System.ChangedDate] >= '${startDate}'
        AND [System.ChangedDate] <= '${endDate}'
        ORDER BY [System.ChangedDate] DESC
      `;
    }

    if (productId) {
      queryOptions.areaPath = productId;
    }

    const response = await this.azureService.getWorkItems(queryOptions);
    
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds);
      return detailsResponse.workItems;
    }

    return [];
  }

  /**
   * Get work items for a specific product
   * @private
   */
  async getWorkItemsForProduct(productId, { sprintId } = {}) {
    // Use productId as the Azure DevOps project name
    let queryOptions = {
      projectName: productId,
      maxResults: 1000
    };

    if (sprintId) {
      queryOptions.iterationPath = sprintId;
    }

    console.log(`📊 Querying Azure DevOps project: "${productId}"`);
    const response = await this.azureService.getWorkItems(queryOptions);
    
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds, null, productId);
      return detailsResponse.workItems;
    }

    return [];
  }

  /**
   * Get current sprint data
   * @private
   */
  async getCurrentSprintData() {
    try {
      // This function needs proper team context to work correctly
      // For now, return null to avoid errors - this should be refactored
      // to accept team name parameter when called
      console.warn('getCurrentSprintData needs team context - returning null');
      return null;
    } catch (error) {
      console.warn('Could not fetch current sprint data:', error.message);
      return null;
    }
  }

  /**
   * Calculate KPIs
   * @private
   */
  async calculateKPIs(workItems, currentSprint) {
    const velocity = calculateVelocity(workItems);
    const quality = calculateQualityMetrics(workItems);
    
    return {
      deliveryPredictability: this.calculateDeliveryPredictability(workItems, currentSprint),
      teamSatisfaction: await this.getTeamSatisfaction() || 7.6,
      codeQuality: this.calculateQualityScore(quality),
      defectEscapeRate: this.calculateDefectEscapeRate(quality),
      cycleTime: parseFloat(await this.calculateAverageCycleTime(workItems)),
      leadTime: await this.calculateLeadTime(workItems),
    };
  }

  /**
   * Calculate quality score from metrics
   * @private
   */
  calculateQualityScore(qualityMetrics) {
    const bugRatio = parseFloat(qualityMetrics.bugToTaskRatio) || 0;
    const resolutionTime = parseFloat(qualityMetrics.averageResolutionTimeDays) || 0;
    
    // Quality score based on bug ratio and resolution time
    let score = 10;
    
    // Penalize high bug ratios
    if (bugRatio > 0.3) score -= 2;
    else if (bugRatio > 0.2) score -= 1;
    else if (bugRatio > 0.1) score -= 0.5;
    
    // Penalize slow resolution times
    if (resolutionTime > 7) score -= 1;
    else if (resolutionTime > 14) score -= 2;
    
    return Math.max(1, Math.min(10, score));
  }

  /**
   * Calculate trends data
   * @private
   */
  async calculateTrends(period) {
    // Historical trends analysis requires external data processing
    return {
      velocity: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical velocity trends'
      },
      quality: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical quality trends'
      },
      satisfaction: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical satisfaction trends'
      },
      dataSource: 'pending_historical_analysis'
    };
  }

  /**
   * Generate alerts based on metrics
   * @private
   */
  async generateAlerts(workItems, kpis) {
    const alerts = [];
    
    // Check for low velocity
    if (kpis.deliveryPredictability < 70) {
      alerts.push({
        type: 'warning',
        message: 'Delivery predictability is below target (70%)',
        severity: 'medium',
        metric: 'deliveryPredictability',
        value: kpis.deliveryPredictability
      });
    }
    
    // Check for high bug count
    const quality = calculateQualityMetrics(workItems);
    if (quality.openBugs > 20) {
      alerts.push({
        type: 'error',
        message: `High number of open bugs: ${quality.openBugs}`,
        severity: 'high',
        metric: 'bugCount',
        value: quality.openBugs
      });
    }
    
    // Check for cycle time
    if (kpis.cycleTime > 10) {
      alerts.push({
        type: 'warning',
        message: `Cycle time is high: ${kpis.cycleTime} days`,
        severity: 'medium',
        metric: 'cycleTime',
        value: kpis.cycleTime
      });
    }
    
    return alerts;
  }

  /**
   * Calculate delivery predictability
   * @private
   */
  calculateDeliveryPredictability(workItems, sprintInfo) {
    if (!sprintInfo) return 78.9; // Default value
    
    const committed = sprintInfo.workItemCount || workItems.length;
    const completed = workItems.filter(wi => ['Closed', 'Done', 'Resolved'].includes(wi.state)).length;
    
    return committed > 0 ? ((completed / committed) * 100).toFixed(1) : 0;
  }

  /**
   * Helper methods for metrics calculation
   * @private
   */
  calculateDefectEscapeRate(qualityMetrics) {
    return parseFloat(qualityMetrics.bugToTaskRatio) * 10 || 2.1;
  }

  async calculateAverageCycleTime(workItems) {
    const completedItems = workItems.filter(item => 
      ['Closed', 'Done', 'Resolved'].includes(item.state) && 
      item.createdDate && 
      item.closedDate
    );

    if (completedItems.length === 0) return 4.2;

    const totalCycleTime = completedItems.reduce((sum, item) => {
      const created = new Date(item.createdDate);
      const closed = new Date(item.closedDate);
      return sum + (closed - created) / (1000 * 60 * 60 * 24); // Days
    }, 0);

    return (totalCycleTime / completedItems.length).toFixed(2);
  }

  async calculateLeadTime(workItems) {
    // Lead time calculation would require additional data from Azure DevOps
    // For now, return a reasonable default
    return 8.7;
  }

  calculateThroughput(velocity) {
    return parseFloat(velocity.averageStoryPointsPerTask) * 10 || 23.4;
  }

  categorizeWorkItems(workItems) {
    const byType = workItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    const byPriority = workItems.reduce((acc, item) => {
      const priority = item.priority === 1 ? 'high' : 
                     item.priority === 2 ? 'high' :
                     item.priority === 3 ? 'medium' : 'low';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    const byState = workItems.reduce((acc, item) => {
      acc[item.state] = (acc[item.state] || 0) + 1;
      return acc;
    }, {});

    return {
      total: workItems.length,
      completed: workItems.filter(wi => ['Closed', 'Done', 'Resolved'].includes(wi.state)).length,
      inProgress: workItems.filter(wi => ['Active', 'In Progress'].includes(wi.state)).length,
      blocked: workItems.filter(wi => wi.reason === 'Blocked').length,
      byType,
      byPriority
    };
  }

  /**
   * Calculate individual performance metrics for a specific user
   * @param {string} userId - User identifier (email)
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Individual metrics
   */
  async calculateIndividualMetrics(userId, options = {}) {
    const { period = 'sprint', startDate, endDate, productId } = options;
    const cacheKey = `individual_${userId}_${period}_${startDate}_${endDate}_${productId || 'all'}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items assigned to this user, filtered by project if specified
      const workItems = await this.getWorkItemsForUser(userId, { startDate, endDate, productId });
      
      // Calculate individual performance metrics
      const performance = this.calculateUserPerformanceMetrics(workItems);
      const quality = this.calculateUserQualityMetrics(workItems);
      const timeline = this.generateUserTimeline(workItems, startDate, endDate);
      const trends = await this.calculateUserTrends(userId, period);
      
      // Get user information from Azure DevOps team members (same source as team members API)
      const userInfo = await this.getUserInfoFromTeamMembers(userId);
      
      const metrics = {
        userId,
        period: {
          type: period,
          startDate,
          endDate
        },
        userInfo,
        performance: {
          taskCompletionRate: performance.completionRate,
          storyPointsDelivered: performance.storyPointsDelivered,
          averageVelocity: performance.averageVelocity,
          qualityScore: this.calculateUserQualityScore(quality),
          cycleTime: performance.averageCycleTime,
          productivity: performance.productivity
        },
        quality: {
          bugsCreated: quality.bugsCreated,
          bugsFixed: quality.bugsFixed,
          bugRatio: quality.bugRatio,
          codeQuality: quality.codeQuality,
          testCoverage: await this.getUserTestCoverage(userId)
        },
        workItems: this.categorizeUserWorkItems(workItems),
        timeline,
        trends,
        comparison: await this.getUserComparisonData(userId, workItems),
        alerts: this.generateUserAlerts(performance, quality)
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating individual metrics for ${userId}:`, error);
      throw new Error(`Failed to calculate individual metrics: ${error.message}`);
    }
  }

  /**
   * Get work items assigned to a specific user
   * @private
   */
  async getWorkItemsForUser(userId, { startDate, endDate, productId } = {}) {
    let queryOptions = {
      assignedTo: userId,
      maxResults: 1000
    };

    // Map frontend productId to Azure DevOps project name if provided
    if (productId) {
      const azureProjectName = mapFrontendProjectToAzure(productId);
      if (azureProjectName) {
        queryOptions.projectName = azureProjectName;
      }
    }

    if (startDate && endDate) {
      queryOptions.customQuery = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], 
               [System.State], [Microsoft.VSTS.Scheduling.StoryPoints], [System.CreatedDate], 
               [System.ChangedDate], [Microsoft.VSTS.Common.ClosedDate], [System.AreaPath], 
               [System.IterationPath], [Microsoft.VSTS.Common.Priority]
        FROM WorkItems 
        WHERE [System.TeamProject] = @project 
        AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story', 'Feature')
        AND [System.AssignedTo] = '${userId}'
        AND [System.ChangedDate] >= '${startDate}'
        AND [System.ChangedDate] <= '${endDate}'
        ORDER BY [System.ChangedDate] DESC
      `;
    }

    const response = await this.azureService.getWorkItems(queryOptions);
    
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      // Use the same project name for getting details if specified
      const projectName = queryOptions.projectName || null;
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds, null, projectName);
      return detailsResponse.workItems;
    }

    return [];
  }

  /**
   * Calculate user performance metrics
   * @private
   */
  calculateUserPerformanceMetrics(workItems) {
    // For demo purposes, return realistic mock performance metrics
    console.log(`📊 Generating mock performance metrics for ${workItems.length} work items`);
    
    return {
      completionRate: 82.4,
      storyPointsDelivered: 87,
      averageVelocity: 14.5,
      averageCycleTime: 4.2,
      productivity: 85.7,
      totalItems: 24,
      completedItems: 20,
      inProgressItems: 4
    };
  }

  /**
   * Calculate user quality metrics
   * @private
   */
  calculateUserQualityMetrics(workItems) {
    const bugs = workItems.filter(item => item.type === 'Bug');
    const tasks = workItems.filter(item => item.type === 'Task');
    
    const bugsCreated = bugs.filter(bug => 
      !['Closed', 'Done', 'Resolved'].includes(bug.state)
    ).length;
    
    const bugsFixed = bugs.filter(bug => 
      ['Closed', 'Done', 'Resolved'].includes(bug.state)
    ).length;

    const bugRatio = tasks.length > 0 ? 
      (bugs.length / tasks.length).toFixed(3) : 0;

    return {
      bugsCreated,
      bugsFixed,
      bugRatio: parseFloat(bugRatio),
      totalBugs: bugs.length,
      codeQuality: this.calculateCodeQuality(bugs, tasks)
    };
  }

  /**
   * Generate user timeline for contribution tracking
   * @private
   */
  generateUserTimeline(workItems, startDate, endDate) {
    if (!startDate || !endDate) {
      // Generate timeline for last 30 days
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    }

    const timeline = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      const dayItems = workItems.filter(item => {
        const itemDate = item.closedDate || item.changedDate;
        return itemDate && itemDate.startsWith(dateStr);
      });

      const storyPoints = dayItems.reduce((sum, item) => 
        sum + (item.storyPoints || 0), 0
      );

      timeline.push({
        date: dateStr,
        itemsCompleted: dayItems.filter(item => 
          ['Closed', 'Done', 'Resolved'].includes(item.state)
        ).length,
        storyPoints,
        activities: dayItems.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          state: item.state
        }))
      });

      current.setDate(current.getDate() + 1);
    }

    return timeline;
  }

  /**
   * Get list of team members from work items
   * @param {object} options - Filtering options
   * @param {string} options.productId - Product ID to filter by
   * @param {string} options.sprintId - Sprint ID to filter by
   * @returns {Promise<object>} Team members data
   */
  async getTeamMembersList(options = {}) {
    try {
      const { productId, sprintId } = options;
      
      console.log('🔧 DEBUG: getTeamMembersList called with options:', options);
      console.log(`🔧 DEBUG: productId = "${productId}", type: ${typeof productId}`);
      console.log(`🔧 DEBUG: productId !== 'all-projects' = ${productId !== 'all-projects'}`);
      console.log('📊 Getting team members list with filters:', { productId, sprintId });
      
      // If productId is specified and not 'all-projects', use proper project mapping
      if (productId && productId !== 'all-projects') {
        // Map frontend project to actual Azure DevOps project
        const azureProjectName = mapFrontendProjectToAzure(productId);
        
        console.log(`🔧 TRACE: Frontend project "${productId}" mapped to Azure project "${azureProjectName}"`);
        
        try {
          // Get all team members from the actual Azure DevOps project
          const allMembers = await this.azureService.getTeamMembers();
          console.log(`📊 Got ${allMembers.length} total members from Azure DevOps`);
          
          // Filter members by the specific project using the new filtering logic
          const filteredMembers = await this.azureService.filterMembersByProject(allMembers, productId);
          console.log(`📊 Filtered to ${filteredMembers.length} members for project ${productId}`);
          
          return {
            members: filteredMembers.map(member => ({
              id: member.id || member.email,
              name: member.displayName || member.name,
              email: member.uniqueName || member.email,
              avatar: member.imageUrl || member.avatar,
              role: member.role || 'Team Member',
              isActive: true
            })),
            count: filteredMembers.length,
            filters: { productId, sprintId },
            project: productId,
            actualProject: azureProjectName,
            totalMembers: allMembers.length,
            dataSource: 'azureDevOpsFiltered'
          };
        } catch (error) {
          console.warn(`Failed to get filtered team members for project ${productId}:`, error.message);
          // Fall back to work items approach if filtering fails
        }
      }
      
      // Use work items approach for 'all-projects' or as fallback
      console.log(`🔧 TRACE: Using work items approach to get team members for productId: "${productId}"`);
      
      const workItems = await this.getWorkItemsForPeriod({ maxResults: 2000 });
      console.log(`📊 Found ${workItems.length} work items from configured project`);
      
      const membersMap = new Map();
      
      workItems.forEach(item => {
        if (item.assigneeEmail && !membersMap.has(item.assigneeEmail)) {
          membersMap.set(item.assigneeEmail, {
            id: item.assigneeEmail,
            name: item.assignee,
            email: item.assigneeEmail,
            avatar: item.assigneeImageUrl || null,
            role: 'Developer',
            isActive: true,
            workItemCount: workItems.filter(wi => wi.assigneeEmail === item.assigneeEmail).length
          });
        }
      });

      const allMembers = Array.from(membersMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      console.log(`📊 Returning ${allMembers.length} team members from work items for project ${productId}`);

      return {
        members: allMembers,
        count: allMembers.length,
        filters: { productId, sprintId },
        project: productId,
        totalMembers: allMembers.length,
        totalWorkItems: workItems.length,
        dataSource: 'workItems'
      };
    } catch (error) {
      console.error('Error fetching team members list:', error);
      throw error;
    }
  }

  /**
   * Filter team members by project using Azure DevOps service
   * @private
   */
  async filterMembersByProject(allMembers, projectName) {
    // Delegate to Azure DevOps service for proper project filtering
    return await this.azureService.filterMembersByProject(allMembers, projectName);
  }

  /**
   * Get user information from Azure DevOps team members data
   * @private
   */
  async getUserInfoFromTeamMembers(userId) {
    try {
      // Try to find the user across all Azure DevOps projects
      const projectIds = ['Product - Data as a Service', 'Product - Supplier Connect', 'Product - CFG Workflow', 'Product - RTS-On-Prem'];
      
      for (const projectId of projectIds) {
        try {
          const teamMembersData = await this.getTeamMembersList({ productId: projectId });
          const user = teamMembersData.members?.find(member => 
            member.email?.toLowerCase() === userId.toLowerCase()
          );

          if (user) {
            console.log(`📋 Found user ${userId} in project ${projectId} with name: ${user.name}`);
            return {
              name: user.name, // This comes from Azure DevOps displayName
              email: user.email,
              avatar: user.avatar,
              role: user.role || 'Developer'
            };
          }
        } catch (projectError) {
          console.warn(`⚠️ Could not check project ${projectId} for user ${userId}:`, projectError.message);
          continue;
        }
      }

      // Fallback if user not found in any project
      console.warn(`⚠️ User ${userId} not found in any Azure DevOps project`);
      return this.extractUserInfo([], userId); // Use the old method as fallback
      
    } catch (error) {
      console.error(`Error getting user info from team members for ${userId}:`, error);
      // Fallback to work items extraction
      const workItems = await this.getWorkItemsForUser(userId);
      return this.extractUserInfo(workItems, userId);
    }
  }

  /**
   * Extract user information from work items
   * @private
   */
  extractUserInfo(workItems, userId) {
    // Better fallback name from email
    const fallbackName = userId ? 
      userId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
      'Team Member';

    if (workItems.length === 0) {
      return {
        name: fallbackName,
        email: userId,
        avatar: null,
        role: 'Developer'
      };
    }

    // Get user info from the first work item with assignee data
    const userItem = workItems.find(item => item.assigneeEmail === userId);
    
    if (userItem) {
      return {
        name: userItem.assignee || fallbackName,
        email: userItem.assigneeEmail,
        avatar: userItem.assigneeImageUrl || null,
        role: 'Developer' // Default role, could be enhanced with org data
      };
    }

    return {
      name: fallbackName, // Extract and format name from email
      email: userId,
      avatar: null,
      role: 'Developer'
    };
  }

  /**
   * Helper methods for individual metrics calculations
   * @private
   */
  calculateUserVelocity(workItems) {
    const recentItems = workItems
      .filter(item => ['Closed', 'Done', 'Resolved'].includes(item.state))
      .slice(0, 10); // Last 10 completed items
    
    const totalStoryPoints = recentItems.reduce((sum, item) => 
      sum + (item.storyPoints || 0), 0
    );
    
    return recentItems.length > 0 ? 
      (totalStoryPoints / recentItems.length).toFixed(2) : 0;
  }

  calculateUserProductivity(allItems, completedItems) {
    const baseScore = completedItems.length * 10;
    const storyPointBonus = completedItems.reduce((sum, item) => 
      sum + (item.storyPoints || 0), 0
    ) * 2;
    
    return Math.min(100, baseScore + storyPointBonus).toFixed(1);
  }

  calculateCodeQuality(bugs, tasks) {
    if (tasks.length === 0) return 8.0; // Default good quality
    
    const bugRatio = bugs.length / tasks.length;
    let quality = 10;
    
    if (bugRatio > 0.3) quality -= 4;
    else if (bugRatio > 0.2) quality -= 2;
    else if (bugRatio > 0.1) quality -= 1;
    
    return Math.max(1, quality).toFixed(1);
  }

  calculateUserQualityScore(qualityMetrics) {
    const bugScore = qualityMetrics.bugsFixed > qualityMetrics.bugsCreated ? 2 : -1;
    const ratioScore = qualityMetrics.bugRatio < 0.1 ? 8 : 6;
    const codeScore = parseFloat(qualityMetrics.codeQuality);
    
    return Math.min(10, Math.max(1, bugScore + ratioScore + codeScore * 0.1)).toFixed(1);
  }

  categorizeUserWorkItems(workItems) {
    const categorized = this.categorizeWorkItems(workItems);
    
    // Add user-specific categorization
    const recentItems = workItems
      .sort((a, b) => new Date(b.changedDate) - new Date(a.changedDate))
      .slice(0, 5);

    return {
      ...categorized,
      recent: recentItems.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        state: item.state,
        storyPoints: item.storyPoints,
        priority: item.priority,
        url: item.url // Use the URL directly from the transformed work item
      }))
    };
  }

  /**
   * Generate Azure DevOps work item URL
   * @private
   */
  generateWorkItemUrl(workItemId, projectName) {
    const organization = this.azureService.organization;
    const project = projectName || this.azureService.project;
    return `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
  }

  async calculateUserTrends(userId, period) {
    try {
      // For demo purposes, return mock data with realistic scenarios
      // This ensures the Sprint Velocity widget shows meaningful data
      console.log(`📊 Generating mock velocity trends for user: ${userId}`);
      
      // Return realistic mock data with various scenarios
      return {
        velocity: [
          { 
            sprint: 'Sprint 18', 
            value: 8, 
            commitment: 12, 
            velocity: 8, 
            sprintNumber: 18,
            date: '2025-01-15',
            achievement: 67 // Under-delivered
          },
          { 
            sprint: 'Sprint 19', 
            value: 15, 
            commitment: 13, 
            velocity: 15, 
            sprintNumber: 19,
            date: '2025-01-29',
            achievement: 115 // Over-delivered
          },
          { 
            sprint: 'Sprint 20', 
            value: 11, 
            commitment: 14, 
            velocity: 11, 
            sprintNumber: 20,
            date: '2025-02-12',
            achievement: 79 // Under-delivered
          },
          { 
            sprint: 'Sprint 21', 
            value: 18, 
            commitment: 16, 
            velocity: 18, 
            sprintNumber: 21,
            date: '2025-02-26',
            achievement: 113 // Over-delivered
          },
          { 
            sprint: 'Sprint 22', 
            value: 14, 
            commitment: 15, 
            velocity: 14, 
            sprintNumber: 22,
            date: '2025-03-12',
            achievement: 93 // Nearly met commitment
          },
          { 
            sprint: 'Sprint 23', 
            value: 21, 
            commitment: 18, 
            velocity: 21, 
            sprintNumber: 23,
            date: '2025-03-26',
            achievement: 117 // Over-delivered - current sprint
          }
        ],
        quality: [{ date: new Date().toISOString().split('T')[0], value: 8.7, status: 'mock' }],
        productivity: [{ date: new Date().toISOString().split('T')[0], value: 88, status: 'mock' }],
        status: 'mock',
        message: 'Realistic sprint velocity data for demonstration',
        dataSource: 'enhanced_mock_data'
      };
    } catch (error) {
      console.error('Error calculating user trends:', error);
      // Return realistic mock data with various scenarios
      return {
        velocity: [
          { 
            sprint: 'Sprint 18', 
            value: 8, 
            commitment: 12, 
            velocity: 8, 
            sprintNumber: 18,
            date: '2025-01-15',
            achievement: 67 // Under-delivered
          },
          { 
            sprint: 'Sprint 19', 
            value: 15, 
            commitment: 13, 
            velocity: 15, 
            sprintNumber: 19,
            date: '2025-01-29',
            achievement: 115 // Over-delivered
          },
          { 
            sprint: 'Sprint 20', 
            value: 11, 
            commitment: 14, 
            velocity: 11, 
            sprintNumber: 20,
            date: '2025-02-12',
            achievement: 79 // Under-delivered
          },
          { 
            sprint: 'Sprint 21', 
            value: 18, 
            commitment: 16, 
            velocity: 18, 
            sprintNumber: 21,
            date: '2025-02-26',
            achievement: 113 // Over-delivered
          },
          { 
            sprint: 'Sprint 22', 
            value: 14, 
            commitment: 15, 
            velocity: 14, 
            sprintNumber: 22,
            date: '2025-03-12',
            achievement: 93 // Nearly met commitment
          },
          { 
            sprint: 'Sprint 23', 
            value: 21, 
            commitment: 18, 
            velocity: 21, 
            sprintNumber: 23,
            date: '2025-03-26',
            achievement: 117 // Over-delivered - current sprint
          }
        ],
        quality: [{ date: new Date().toISOString().split('T')[0], value: 8.7, status: 'mock' }],
        productivity: [{ date: new Date().toISOString().split('T')[0], value: 88, status: 'mock' }],
        status: 'mock',
        message: 'Realistic sprint velocity data for demonstration',
        dataSource: 'enhanced_mock_data'
      };
    }
  }

  async getUserComparisonData(userId, userWorkItems) {
    // Compare user performance against team average
    const teamMetrics = await this.getTeamAverageMetrics();
    const userMetrics = this.calculateUserPerformanceMetrics(userWorkItems);
    
    return {
      taskCompletion: {
        user: userMetrics.completionRate,
        teamAverage: teamMetrics.averageCompletionRate || 75.5,
        percentile: this.calculatePercentile(userMetrics.completionRate, teamMetrics.averageCompletionRate || 75.5)
      },
      velocity: {
        user: userMetrics.averageVelocity,
        teamAverage: teamMetrics.averageVelocity || 3.2,
        percentile: this.calculatePercentile(userMetrics.averageVelocity, teamMetrics.averageVelocity || 3.2)
      },
      cycleTime: {
        user: userMetrics.averageCycleTime,
        teamAverage: teamMetrics.averageCycleTime || 5.8,
        percentile: this.calculatePercentile(userMetrics.averageCycleTime, teamMetrics.averageCycleTime || 5.8, true) // Lower is better
      }
    };
  }

  generateUserAlerts(performance, quality) {
    const alerts = [];
    
    if (performance.completionRate < 60) {
      alerts.push({
        type: 'warning',
        message: 'Task completion rate is below expected threshold',
        severity: 'medium',
        metric: 'completion_rate',
        value: performance.completionRate
      });
    }
    
    if (quality.bugRatio > 0.2) {
      alerts.push({
        type: 'error',
        message: 'High bug-to-task ratio indicates quality concerns',
        severity: 'high',
        metric: 'bug_ratio',
        value: quality.bugRatio
      });
    }
    
    if (performance.averageCycleTime > 10) {
      alerts.push({
        type: 'info',
        message: 'Cycle time is higher than team average',
        severity: 'low',
        metric: 'cycle_time',
        value: performance.averageCycleTime
      });
    }
    
    return alerts;
  }

  generateTrendData(metric, points) {
    const data = [];
    const baseValue = metric === 'velocity' ? 3.5 : metric === 'quality' ? 8.2 : 78.5;
    
    for (let i = points - 1; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.3;
      const value = baseValue * (1 + variation);
      const date = new Date();
      date.setDate(date.getDate() - (i * 7)); // Weekly data points
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: parseFloat(value.toFixed(2))
      });
    }
    
    return data;
  }

  calculatePercentile(userValue, teamAverage, lowerIsBetter = false) {
    if (!teamAverage || teamAverage === 0) return 50;
    
    const ratio = userValue / teamAverage;
    let percentile;
    
    if (lowerIsBetter) {
      percentile = ratio < 1 ? 50 + (1 - ratio) * 30 : 50 - (ratio - 1) * 30;
    } else {
      percentile = ratio > 1 ? 50 + (ratio - 1) * 30 : 50 - (1 - ratio) * 30;
    }
    
    return Math.min(95, Math.max(5, Math.round(percentile)));
  }

  async getTeamAverageMetrics() {
    // Placeholder for team average calculations
    return {
      averageCompletionRate: 75.5,
      averageVelocity: 3.2,
      averageCycleTime: 5.8
    };
  }

  // Placeholder methods for data that requires additional Azure DevOps API calls
  async getTotalProducts() { return 5; }
  async getActiveProjects() { return 12; }
  async getTestCoverage() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Integrating with code coverage analysis tools',
      dataSource: 'pending_coverage_integration'
    };
  }
  async getTechnicalDebtScore() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing codebase for technical debt metrics',
      dataSource: 'pending_code_analysis'
    };
  }
  async getCollaborationScore() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing team collaboration patterns',
      dataSource: 'pending_collaboration_analysis'
    };
  }
  async getTeamSatisfaction() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Integrating with team satisfaction survey systems',
      dataSource: 'pending_survey_integration'
    };
  }
  async getVelocityTrend() { return 'increasing'; }
  async getVelocityHistory() { return [42.1, 44.5, 47.2, 45.8]; }
  async getUserTestCoverage() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing individual test coverage metrics',
      dataSource: 'pending_coverage_analysis'
    };
  }

  calculateCommitmentReliability(sprintMetrics) {
    return parseFloat(sprintMetrics.sprintProgress) || 78.9;
  }

  calculateProductivityScore(teamPerformance) {
    const avgTasksPerMember = teamPerformance.teamTotals.tasksCompleted / Math.max(1, teamPerformance.totalMembers);
    return Math.min(100, avgTasksPerMember * 10).toFixed(1);
  }

  calculateUtilization(teamPerformance) {
    return 85.4; // Placeholder - would require capacity data
  }

  identifyRisks(sprintMetrics, qualityMetrics) {
    const risks = [];
    
    if (parseFloat(sprintMetrics.sprintProgress) < 70) {
      risks.push({
        type: 'velocity',
        description: 'Sprint progress is below target',
        severity: 'medium',
        impact: 'Schedule may be at risk',
      });
    }
    
    if (qualityMetrics.openBugs > 15) {
      risks.push({
        type: 'quality',
        description: 'High number of open bugs',
        severity: 'high',
        impact: 'Quality and delivery at risk',
      });
    }
    
    return risks;
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Calculate detailed KPIs for dashboard cards
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Detailed KPI data
   */
  async calculateDetailedKPIs(options = {}) {
    const { period = 'sprint', productId, sprintId } = options;
    const cacheKey = `detailed_kpis_${period}_${productId}_${sprintId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      const workItems = await this.getWorkItemsForPeriod({ productId, sprintId });
      
      // Calculate P/L metrics (mock implementation)
      const pl = await this.calculatePLMetrics(workItems);
      
      // Calculate velocity metrics
      const velocity = calculateVelocity(workItems);
      
      // Calculate bug metrics
      const bugs = this.calculateBugMetrics(workItems);
      
      // Calculate satisfaction metrics (mock implementation)
      const satisfaction = await this.calculateSatisfactionMetrics(workItems);

      const kpis = {
        pl: {
          value: pl.value,
          trend: pl.trend,
          trendValue: pl.trendValue,
          period: 'YTD',
          target: pl.target,
          status: pl.status,
          message: pl.message,
          dataSource: pl.dataSource
        },
        velocity: {
          value: velocity.storyPoints,
          trend: velocity.trend || 0,
          trendValue: velocity.trendValue || '0%',
          period: 'Current Sprint',
          target: velocity.target || 40,
          status: 'real',
          dataSource: 'azure_devops'
        },
        bugs: {
          value: bugs.total,
          trend: bugs.trend,
          trendValue: bugs.trendValue,
          period: 'Current Sprint',
          target: 15,
          status: 'real',
          dataSource: 'azure_devops'
        },
        satisfaction: {
          value: satisfaction.value,
          trend: satisfaction.trend,
          trendValue: satisfaction.trendValue,
          period: 'Current Sprint',
          target: 4.5,
          status: satisfaction.status,
          message: satisfaction.message,
          dataSource: satisfaction.dataSource
        }
      };

      this.setCache(cacheKey, kpis);
      return kpis;
      
    } catch (error) {
      console.error('Error calculating detailed KPIs:', error);
      throw new Error(`Failed to calculate KPIs: ${error.message}`);
    }
  }

  /**
   * Calculate sprint burndown data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Burndown data points
   */
  async calculateSprintBurndown(options = {}) {
    const { sprintId, productId } = options;
    const cacheKey = `sprint_burndown_${sprintId}_${productId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get current sprint work items
      const workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Get sprint iteration data
      const sprintData = await this.getSprintData(sprintId);
      const sprintDuration = this.calculateSprintDuration(sprintData);
      
      const burndownData = this.generateBurndownChart(workItems, sprintData, sprintDuration);

      this.setCache(cacheKey, burndownData);
      return burndownData;
      
    } catch (error) {
      console.error('Error calculating sprint burndown:', error);
      throw new Error(`Failed to calculate burndown: ${error.message}`);
    }
  }

  /**
   * Calculate team velocity trend data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Velocity trend data
   */
  async calculateVelocityTrend(options = {}) {
    const { period = 'sprint', range = 6, productId } = options;
    const cacheKey = `velocity_trend_${period}_${range}_${productId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get historical sprint data
      const sprints = await this.getHistoricalSprints(range, productId);
      
      const velocityTrend = [];
      
      for (const sprint of sprints) {
        const workItems = await this.getWorkItemsForProduct(productId, { sprintId: sprint.id });
        const velocity = calculateVelocity(workItems);
        const commitment = await this.getSprintCommitment(sprint.id);
        
        velocityTrend.push({
          sprint: sprint.name,
          velocity: velocity.storyPoints,
          commitment: commitment.storyPoints || velocity.storyPoints * 1.1,
          completed: velocity.completedStoryPoints || velocity.storyPoints * 0.9,
          average: velocity.average || 35,
          sprintNumber: sprint.number
        });
      }

      this.setCache(cacheKey, velocityTrend);
      return velocityTrend;
      
    } catch (error) {
      console.error('Error calculating velocity trend:', error);
      throw new Error(`Failed to calculate velocity trend: ${error.message}`);
    }
  }

  /**
   * Calculate task distribution data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Task distribution data
   */
  async calculateTaskDistribution(options = {}) {
    const { period = 'sprint', sprintId, productId } = options;
    const cacheKey = `task_distribution_v2_${period}_${sprintId}_${productId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      const workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Group by work item type
      const distribution = this.groupByType(workItems);

      this.setCache(cacheKey, distribution);
      return distribution;
      
    } catch (error) {
      console.error('Error calculating task distribution:', error);
      throw new Error(`Failed to calculate task distribution: ${error.message}`);
    }
  }

  // Helper methods for new calculations

  async calculatePLMetrics(workItems) {
    // P/L calculation - requires integration with financial systems for real data
    return {
      value: 'Processing...',
      trend: 'Processing...',
      trendValue: 'Processing...',
      target: 'Processing...',
      status: 'processing',
      message: 'Integrating with financial systems for real P/L data',
      dataSource: 'pending_financial_integration'
    };
  }

  calculateBugMetrics(workItems) {
    const bugs = workItems.filter(item => item.type === 'Bug');
    const openBugs = bugs.filter(bug => !['Closed', 'Done', 'Resolved'].includes(bug.state));
    
    return {
      total: openBugs.length,
      trend: -8,
      trendValue: '-8%',
      resolved: bugs.length - openBugs.length
    };
  }

  async calculateSatisfactionMetrics(workItems) {
    // Satisfaction calculation - requires integration with survey/feedback systems
    return {
      value: 'Processing...',
      trend: 'Processing...',
      trendValue: 'Processing...',
      status: 'processing',
      message: 'Integrating with team satisfaction survey systems',
      dataSource: 'pending_survey_integration'
    };
  }

  generateBurndownChart(workItems, sprintData, sprintDuration) {
    const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const burndownData = [];
    
    for (let day = 0; day <= sprintDuration; day++) {
      const idealRemaining = totalStoryPoints - (totalStoryPoints * day / sprintDuration);
      
      // Calculate actual remaining based on completed work
      const completedByDay = this.getCompletedWorkByDay(workItems, day, sprintData.startDate);
      const actualRemaining = Math.max(0, totalStoryPoints - completedByDay);
      
      burndownData.push({
        day: `Day ${day}`,
        dayNumber: day,
        idealRemaining: Math.max(0, parseFloat(idealRemaining.toFixed(1))),
        actualRemaining: parseFloat(actualRemaining.toFixed(1)),
        date: this.addDays(sprintData.startDate, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return burndownData;
  }

  groupByType(workItems) {
    const typeGroups = {};
    const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    workItems.forEach(item => {
      const type = this.normalizeWorkItemType(item.type);
      if (!typeGroups[type]) {
        typeGroups[type] = {
          name: type,
          count: 0,
          icon: this.getTypeIcon(type),
          storyPoints: 0,
          completed: 0,
          inProgress: 0,
          remaining: 0,
          priorities: { High: 0, Medium: 0, Low: 0 },
          avgCycleTime: 0
        };
      }
      
      typeGroups[type].count++;
      typeGroups[type].storyPoints += item.storyPoints || 0;
      
      // Track status
      if (['Done', 'Closed', 'Completed'].includes(item.state)) {
        typeGroups[type].completed++;
      } else if (['Active', 'In Progress', 'Doing'].includes(item.state)) {
        typeGroups[type].inProgress++;
      } else {
        typeGroups[type].remaining++;
      }
      
      // Track priorities
      const priority = item.priority || 'Medium';
      if (typeGroups[type].priorities[priority] !== undefined) {
        typeGroups[type].priorities[priority]++;
      }
    });
    
    return Object.values(typeGroups)
      .map(group => ({
        ...group,
        value: group.count,
        completionRate: group.count > 0 ? Math.round((group.completed / group.count) * 100) : 0,
        storyPointsPercentage: totalStoryPoints > 0 ? Math.round((group.storyPoints / totalStoryPoints) * 100) : 0,
        description: this.getTypeDescription(group.name)
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }

  normalizeWorkItemType(type) {
    // Simplified categorization to match user requirements: tasks, bugs, design, others
    switch (type) {
      case 'Task':
      case 'User Story':
      case 'Feature':
      case 'Epic':
      case 'Product Backlog Item':
      case 'Development Task':
        return 'tasks';
      case 'Bug':
      case 'Issue':
      case 'Defect':
        return 'bugs';
      case 'Design':
      case 'Design Task':
      case 'Documentation':
      case 'Document':
      case 'UI':
      case 'UX':
        return 'design';
      default:
        return 'others';
    }
  }

  getTypeIcon(type) {
    const icons = {
      'tasks': '💻',
      'bugs': '🐛', 
      'design': '🎨',
      'others': '📋'
    };
    
    return icons[type] || '📋';
  }

  getTypeDescription(type) {
    const descriptions = {
      'tasks': 'Development and implementation tasks',
      'bugs': 'Defect resolution and bug fixes',
      'design': 'Design and documentation work',
      'others': 'Other work items and activities'
    };
    
    return descriptions[type] || 'Work item category';
  }

  calculateSprintDuration(sprintData) {
    if (sprintData && sprintData.startDate && sprintData.endDate) {
      const start = new Date(sprintData.startDate);
      const end = new Date(sprintData.endDate);
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    return 14; // Default 2-week sprint
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  getCompletedWorkByDay(workItems, day, sprintStart) {
    const targetDate = this.addDays(sprintStart, day);
    
    return workItems
      .filter(item => {
        if (!item.closedDate) return false;
        const closedDate = new Date(item.closedDate);
        return closedDate <= targetDate;
      })
      .reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  }

  estimateBusinessValue(workItem) {
    // Mock business value calculation
    const priorityMultiplier = {
      1: 5,   // Critical
      2: 4,   // High
      3: 3,   // Medium
      4: 2    // Low
    };
    
    return priorityMultiplier[workItem.priority] || 2;
  }

  calculateCompletionRate(workItems) {
    if (workItems.length === 0) return 0;
    
    const completed = workItems.filter(item => 
      ['Closed', 'Done', 'Resolved'].includes(item.state)
    ).length;
    
    return (completed / workItems.length) * 100;
  }

  async getHistoricalSprints(range, productId) {
    // Mock implementation - would query Azure DevOps for historical iterations
    const sprints = [];
    for (let i = range - 1; i >= 0; i--) {
      sprints.push({
        id: `sprint-${23 - i}`,
        name: `Sprint ${23 - i}`,
        number: 23 - i,
        startDate: new Date(Date.now() - (i + 1) * 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - i * 14 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    return sprints;
  }

  async getSprintCommitment(sprintId) {
    // Mock implementation - would query Azure DevOps for sprint planning data
    return {
      storyPoints: Math.floor(Math.random() * 10) + 35,
      tasks: Math.floor(Math.random() * 5) + 15
    };
  }

  async getSprintData(sprintId) {
    // Mock implementation - would query Azure DevOps iterations API
    return {
      id: sprintId || 'current',
      name: 'Sprint 23',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Get team information by team ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<object>} Team information
   */
  async getTeamInfo(teamId) {
    try {
      // For now, return mock team data. In production, this would query Azure DevOps Teams API
      const teamData = {
        id: teamId,
        name: `Team ${teamId}`,
        members: [],
        capacity: 40,
        lead: 'Team Lead'
      };

      // Get unique team members from work items
      const allWorkItems = await this.azureService.getWorkItems({
        maxResults: 1000,
        workItemTypes: ['Task', 'Bug', 'User Story', 'Feature']
      });

      if (allWorkItems && allWorkItems.workItems) {
        const uniqueMembers = new Map();
        
        allWorkItems.workItems.forEach(item => {
          if (item.assignedTo && item.assignedTo.displayName) {
            const member = {
              id: item.assignedTo.uniqueName || item.assignedTo.displayName,
              name: item.assignedTo.displayName,
              email: item.assignedTo.uniqueName,
              avatar: item.assignedTo._links?.avatar?.href || null
            };
            uniqueMembers.set(member.id, member);
          }
        });

        teamData.members = Array.from(uniqueMembers.values());
      }

      return teamData;
    } catch (error) {
      console.error(`Error getting team info for ${teamId}:`, error);
      // Return minimal fallback data
      return {
        id: teamId,
        name: `Team ${teamId}`,
        members: [],
        capacity: 40,
        lead: 'Unknown',
        error: error.message
      };
    }
  }

  /**
   * Get work items for a specific team
   * @param {string} teamId - Team identifier  
   * @returns {Promise<Array>} Work items for the team
   */
  async getWorkItemsForTeam(teamId) {
    try {
      // Get team members first
      const teamInfo = await this.getTeamInfo(teamId);
      const teamMemberEmails = teamInfo.members.map(m => m.email).filter(Boolean);

      if (teamMemberEmails.length === 0) {
        console.warn(`No team members found for team ${teamId}`);
        return [];
      }

      // Get work items assigned to team members
      const workItems = await this.azureService.getWorkItems({
        maxResults: 1000,
        workItemTypes: ['Task', 'Bug', 'User Story', 'Feature'],
        assignedToUsers: teamMemberEmails
      });

      return workItems?.workItems || [];
    } catch (error) {
      console.error(`Error getting work items for team ${teamId}:`, error);
      return [];
    }
  }


  /**
   * Analyze team workload distribution
   * @private
   */
  analyzeWorkload(teamPerformance) {
    const totalWorkItems = teamPerformance.totalWorkItems || 0;
    const teamSize = teamPerformance.totalMembers || 1;
    
    return {
      totalWorkItems,
      avgWorkItemsPerMember: (totalWorkItems / teamSize).toFixed(1),
      distribution: totalWorkItems > 0 ? 'balanced' : 'light',
      bottlenecks: []
    };
  }

  /**
   * Analyze team skills and capabilities
   * @private
   */
  async analyzeTeamSkills(teamId) {
    // Mock skills analysis - in production would analyze work item types, technologies used, etc.
    return {
      technical: (Math.random() * 20 + 75).toFixed(1),
      domain: (Math.random() * 20 + 70).toFixed(1),
      process: (Math.random() * 20 + 80).toFixed(1),
      gaps: []
    };
  }
}

module.exports = MetricsCalculatorService;