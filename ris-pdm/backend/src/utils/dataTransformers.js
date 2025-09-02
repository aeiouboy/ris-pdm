/**
 * Data Transformation Utilities
 * Helper functions for transforming Azure DevOps data into dashboard-friendly formats
 */

/**
 * Calculate velocity metrics from work items
 * @param {Array} workItems - Array of work items
 * @param {string} startDate - Start date for calculation
 * @param {string} endDate - End date for calculation
 * @returns {object} Velocity metrics
 */
function calculateVelocity(workItems, startDate = null, endDate = null) {
  const completedItems = workItems.filter(item => 
    ['Closed', 'Done', 'Resolved'].includes(item.state) &&
    item.closedDate &&
    (!startDate || new Date(item.closedDate) >= new Date(startDate)) &&
    (!endDate || new Date(item.closedDate) <= new Date(endDate))
  );

  const totalStoryPoints = completedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const totalTasks = completedItems.length;

  return {
    storyPoints: totalStoryPoints,
    completedTasks: totalTasks,
    averageStoryPointsPerTask: totalTasks > 0 ? (totalStoryPoints / totalTasks).toFixed(2) : 0,
    completedItems
  };
}

/**
 * Calculate burndown data for sprint visualization
 * @param {Array} workItems - Array of work items
 * @param {string} sprintStartDate - Sprint start date
 * @param {string} sprintEndDate - Sprint end date
 * @returns {object} Burndown data
 */
function calculateBurndownData(workItems, sprintStartDate, sprintEndDate) {
  const sprintStart = new Date(sprintStartDate);
  const sprintEnd = new Date(sprintEndDate);
  const totalDays = Math.ceil((sprintEnd - sprintStart) / (1000 * 60 * 60 * 24));
  
  const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const idealBurndown = [];
  const actualBurndown = [];

  // Calculate ideal burndown (linear)
  for (let day = 0; day <= totalDays; day++) {
    const remaining = totalStoryPoints - (totalStoryPoints * day / totalDays);
    idealBurndown.push({
      day,
      date: new Date(sprintStart.getTime() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remaining: Math.max(0, remaining)
    });
  }

  // Calculate actual burndown based on completed work items
  let remainingPoints = totalStoryPoints;
  for (let day = 0; day <= totalDays; day++) {
    const currentDate = new Date(sprintStart.getTime() + day * 24 * 60 * 60 * 1000);
    const completedToday = workItems.filter(item => {
      if (!item.closedDate) return false;
      const closedDate = new Date(item.closedDate);
      return closedDate.toDateString() === currentDate.toDateString();
    });

    const pointsCompletedToday = completedToday.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    remainingPoints -= pointsCompletedToday;

    actualBurndown.push({
      day,
      date: currentDate.toISOString().split('T')[0],
      remaining: Math.max(0, remainingPoints),
      completed: pointsCompletedToday
    });
  }

  return {
    ideal: idealBurndown,
    actual: actualBurndown,
    totalStoryPoints,
    completionPercentage: totalStoryPoints > 0 ? ((totalStoryPoints - remainingPoints) / totalStoryPoints * 100).toFixed(2) : 0
  };
}

/**
 * Calculate team performance metrics
 * @param {Array} workItems - Array of work items
 * @param {Array} teamMembers - Array of team member information
 * @returns {object} Team performance data
 */
function calculateTeamPerformance(workItems, teamMembers = []) {
  const performanceByMember = {};
  
  // Initialize performance data for each team member
  teamMembers.forEach(member => {
    performanceByMember[member.email] = {
      name: member.name || member.email,
      email: member.email,
      tasksCompleted: 0,
      storyPointsDelivered: 0,
      bugsCreated: 0,
      bugsFixed: 0,
      averageCycleTime: 0,
      workItems: []
    };
  });

  // Process work items
  workItems.forEach(item => {
    if (!item.assigneeEmail) return;

    if (!performanceByMember[item.assigneeEmail]) {
      performanceByMember[item.assigneeEmail] = {
        name: item.assignee,
        email: item.assigneeEmail,
        tasksCompleted: 0,
        storyPointsDelivered: 0,
        bugsCreated: 0,
        bugsFixed: 0,
        averageCycleTime: 0,
        workItems: []
      };
    }

    const memberData = performanceByMember[item.assigneeEmail];
    memberData.workItems.push(item);

    // Count completed tasks
    if (['Closed', 'Done', 'Resolved'].includes(item.state)) {
      memberData.tasksCompleted++;
      memberData.storyPointsDelivered += item.storyPoints || 0;
    }

    // Count bugs
    if (item.type === 'Bug') {
      if (['Closed', 'Done', 'Resolved'].includes(item.state)) {
        memberData.bugsFixed++;
      } else {
        memberData.bugsCreated++;
      }
    }
  });

  // Calculate cycle times
  Object.values(performanceByMember).forEach(member => {
    const completedItems = member.workItems.filter(item => 
      ['Closed', 'Done', 'Resolved'].includes(item.state) && 
      item.createdDate && 
      item.closedDate
    );

    if (completedItems.length > 0) {
      const totalCycleTime = completedItems.reduce((sum, item) => {
        const created = new Date(item.createdDate);
        const closed = new Date(item.closedDate);
        return sum + (closed - created) / (1000 * 60 * 60 * 24); // Days
      }, 0);

      member.averageCycleTime = (totalCycleTime / completedItems.length).toFixed(2);
    }
  });

  return {
    teamMembers: Object.values(performanceByMember),
    totalMembers: Object.keys(performanceByMember).length,
    teamTotals: {
      tasksCompleted: Object.values(performanceByMember).reduce((sum, m) => sum + m.tasksCompleted, 0),
      storyPointsDelivered: Object.values(performanceByMember).reduce((sum, m) => sum + m.storyPointsDelivered, 0),
      bugsCreated: Object.values(performanceByMember).reduce((sum, m) => sum + m.bugsCreated, 0),
      bugsFixed: Object.values(performanceByMember).reduce((sum, m) => sum + m.bugsFixed, 0)
    }
  };
}

/**
 * Calculate quality metrics from work items
 * @param {Array} workItems - Array of work items
 * @returns {object} Quality metrics
 */
function calculateQualityMetrics(workItems) {
  const bugs = workItems.filter(item => item.type === 'Bug');
  const tasks = workItems.filter(item => item.type === 'Task');
  const userStories = workItems.filter(item => item.type === 'User Story');

  const bugsByPriority = bugs.reduce((acc, bug) => {
    const priority = bug.priority || 4;
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  const bugsByState = bugs.reduce((acc, bug) => {
    acc[bug.state] = (acc[bug.state] || 0) + 1;
    return acc;
  }, {});

  const openBugs = bugs.filter(bug => !['Closed', 'Done', 'Resolved'].includes(bug.state));
  const closedBugs = bugs.filter(bug => ['Closed', 'Done', 'Resolved'].includes(bug.state));

  // Calculate average resolution time for closed bugs
  const bugResolutionTimes = closedBugs
    .filter(bug => bug.createdDate && bug.closedDate)
    .map(bug => {
      const created = new Date(bug.createdDate);
      const closed = new Date(bug.closedDate);
      return (closed - created) / (1000 * 60 * 60 * 24); // Days
    });

  const averageResolutionTime = bugResolutionTimes.length > 0 
    ? (bugResolutionTimes.reduce((sum, time) => sum + time, 0) / bugResolutionTimes.length).toFixed(2)
    : 0;

  return {
    totalBugs: bugs.length,
    openBugs: openBugs.length,
    closedBugs: closedBugs.length,
    bugsByPriority,
    bugsByState,
    averageResolutionTimeDays: averageResolutionTime,
    bugToTaskRatio: tasks.length > 0 ? (bugs.length / tasks.length).toFixed(3) : 0,
    bugToStoryRatio: userStories.length > 0 ? (bugs.length / userStories.length).toFixed(3) : 0,
    criticalBugs: bugs.filter(bug => bug.priority === 1).length,
    highPriorityBugs: bugs.filter(bug => bug.priority === 2).length
  };
}

/**
 * Transform work items for chart visualization
 * @param {Array} workItems - Array of work items
 * @param {string} groupBy - Grouping criteria ('type', 'state', 'assignee', 'priority')
 * @returns {object} Chart data
 */
function transformForCharts(workItems, groupBy = 'type') {
  const grouped = workItems.reduce((acc, item) => {
    let key;
    switch (groupBy) {
      case 'type':
        key = item.type;
        break;
      case 'state':
        key = item.state;
        break;
      case 'assignee':
        key = item.assignee || 'Unassigned';
        break;
      case 'priority':
        key = `Priority ${item.priority || 4}`;
        break;
      default:
        key = item.type;
    }

    if (!acc[key]) {
      acc[key] = {
        count: 0,
        storyPoints: 0,
        items: []
      };
    }

    acc[key].count++;
    acc[key].storyPoints += item.storyPoints || 0;
    acc[key].items.push(item);

    return acc;
  }, {});

  const chartData = Object.entries(grouped).map(([key, data]) => ({
    name: key,
    count: data.count,
    storyPoints: data.storyPoints,
    percentage: ((data.count / workItems.length) * 100).toFixed(1)
  }));

  return {
    chartData,
    totalItems: workItems.length,
    groupBy
  };
}

/**
 * Calculate sprint metrics summary
 * @param {Array} workItems - Array of work items
 * @param {object} sprintInfo - Sprint information
 * @returns {object} Sprint metrics
 */
function calculateSprintMetrics(workItems, sprintInfo = {}) {
  const velocity = calculateVelocity(workItems, sprintInfo.startDate, sprintInfo.endDate);
  const quality = calculateQualityMetrics(workItems);
  
  const committedPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const completedPoints = velocity.storyPoints;
  
  const sprintProgress = committedPoints > 0 ? 
    ((completedPoints / committedPoints) * 100).toFixed(1) : 0;

  return {
    sprintName: sprintInfo.name || 'Current Sprint',
    startDate: sprintInfo.startDate,
    endDate: sprintInfo.endDate,
    committedPoints,
    completedPoints,
    remainingPoints: Math.max(0, committedPoints - completedPoints),
    sprintProgress: parseFloat(sprintProgress),
    velocity: velocity.storyPoints,
    completedTasks: velocity.completedTasks,
    totalTasks: workItems.length,
    taskCompletionRate: workItems.length > 0 ? 
      ((velocity.completedTasks / workItems.length) * 100).toFixed(1) : 0,
    bugCount: quality.totalBugs,
    openBugCount: quality.openBugs,
    averageCycleTime: calculateAverageCycleTime(workItems)
  };
}

/**
 * Calculate average cycle time for work items
 * @param {Array} workItems - Array of work items
 * @returns {number} Average cycle time in days
 */
function calculateAverageCycleTime(workItems) {
  const completedItems = workItems.filter(item => 
    ['Closed', 'Done', 'Resolved'].includes(item.state) && 
    item.createdDate && 
    item.closedDate
  );

  if (completedItems.length === 0) return 0;

  const totalCycleTime = completedItems.reduce((sum, item) => {
    const created = new Date(item.createdDate);
    const closed = new Date(item.closedDate);
    return sum + (closed - created) / (1000 * 60 * 60 * 24); // Days
  }, 0);

  return (totalCycleTime / completedItems.length).toFixed(2);
}

/**
 * Generate date range for time series data
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {string} interval - Interval ('day', 'week', 'month')
 * @returns {Array} Array of date strings
 */
function generateDateRange(startDate, endDate, interval = 'day') {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    
    switch (interval) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return dates;
}

module.exports = {
  calculateVelocity,
  calculateBurndownData,
  calculateTeamPerformance,
  calculateQualityMetrics,
  transformForCharts,
  calculateSprintMetrics,
  calculateAverageCycleTime,
  generateDateRange
};