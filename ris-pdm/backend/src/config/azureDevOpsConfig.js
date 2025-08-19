/**
 * Azure DevOps Configuration
 * Centralized configuration for Azure DevOps API integration
 */

const azureDevOpsConfig = {
  // Core Azure DevOps settings
  organization: process.env.AZURE_DEVOPS_ORG,
  project: process.env.AZURE_DEVOPS_PROJECT,
  pat: process.env.AZURE_DEVOPS_PAT,
  apiVersion: process.env.AZURE_DEVOPS_API_VERSION || '7.0',
  
  // API endpoints configuration
  endpoints: {
    workItems: '/_apis/wit/workitems',
    wiql: '/_apis/wit/wiql',
    iterations: '/_apis/work/teamsettings/iterations',
    capacity: '/_apis/work/teamsettings/iterations/{iterationId}/capacities',
    teams: '/_apis/teams',
    analytics: '/_odata/v3.0-preview'
  },

  // Rate limiting configuration
  rateLimiting: {
    requestsPerMinute: parseInt(process.env.AZURE_RATE_LIMIT_RPM) || 60,
    burstLimit: parseInt(process.env.AZURE_BURST_LIMIT) || 100,
    retryAttempts: parseInt(process.env.AZURE_RETRY_ATTEMPTS) || 3,
    retryDelayMs: parseInt(process.env.AZURE_RETRY_DELAY_MS) || 1000
  },

  // Request batching configuration
  batching: {
    maxBatchSize: parseInt(process.env.AZURE_MAX_BATCH_SIZE) || 100,
    batchDelayMs: parseInt(process.env.AZURE_BATCH_DELAY_MS) || 100,
    maxConcurrentBatches: parseInt(process.env.AZURE_MAX_CONCURRENT_BATCHES) || 5
  },

  // Caching configuration (TTL in milliseconds)
  cache: {
    workItems: parseInt(process.env.AZURE_CACHE_WORK_ITEMS_TTL) || 5 * 60 * 1000, // 5 minutes
    iterations: parseInt(process.env.AZURE_CACHE_ITERATIONS_TTL) || 30 * 60 * 1000, // 30 minutes
    teamCapacity: parseInt(process.env.AZURE_CACHE_CAPACITY_TTL) || 15 * 60 * 1000, // 15 minutes
    teams: parseInt(process.env.AZURE_CACHE_TEAMS_TTL) || 60 * 60 * 1000, // 1 hour
    analytics: parseInt(process.env.AZURE_CACHE_ANALYTICS_TTL) || 10 * 60 * 1000 // 10 minutes
  },

  // Request timeout configuration
  timeouts: {
    default: parseInt(process.env.AZURE_REQUEST_TIMEOUT) || 30000, // 30 seconds
    longRunning: parseInt(process.env.AZURE_LONG_REQUEST_TIMEOUT) || 60000, // 60 seconds
    batch: parseInt(process.env.AZURE_BATCH_TIMEOUT) || 120000 // 2 minutes
  },

  // Default fields for work item queries
  defaultFields: [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.State',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'System.CreatedDate',
    'System.ChangedDate',
    'Microsoft.VSTS.Common.ClosedDate',
    'System.Tags',
    'System.AreaPath',
    'System.IterationPath',
    'Microsoft.VSTS.Common.Priority',
    'Microsoft.VSTS.Scheduling.RemainingWork',
    'Microsoft.VSTS.Scheduling.CompletedWork',
    'Microsoft.VSTS.Scheduling.OriginalEstimate',
    'System.Reason',
    'System.Parent',
    'System.Description'
  ],

  // Work item type mappings
  workItemTypes: {
    task: 'Task',
    bug: 'Bug',
    userStory: 'User Story',
    feature: 'Feature',
    epic: 'Epic',
    testCase: 'Test Case'
  },

  // State mappings (common across different work item types)
  states: {
    new: 'New',
    active: 'Active',
    inProgress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    removed: 'Removed',
    done: 'Done'
  },

  // Priority mappings
  priorities: {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4
  },

  // Query templates for common scenarios
  queryTemplates: {
    // Get all active work items for current sprint
    currentSprintWorkItems: `
      SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints]
      FROM WorkItems 
      WHERE [System.TeamProject] = @project 
      AND [System.IterationPath] UNDER @currentIteration
      AND [System.State] <> 'Removed'
      ORDER BY [System.ChangedDate] DESC
    `,

    // Get bugs created in the last sprint
    recentBugs: `
      SELECT [System.Id], [System.Title], [System.AssignedTo], [System.State], [Microsoft.VSTS.Common.Priority]
      FROM WorkItems 
      WHERE [System.TeamProject] = @project 
      AND [System.WorkItemType] = 'Bug'
      AND [System.CreatedDate] >= @sprintStartDate
      AND [System.State] <> 'Removed'
      ORDER BY [Microsoft.VSTS.Common.Priority], [System.CreatedDate] DESC
    `,

    // Get completed user stories for velocity calculation
    completedUserStories: `
      SELECT [System.Id], [System.Title], [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Common.ClosedDate]
      FROM WorkItems 
      WHERE [System.TeamProject] = @project 
      AND [System.WorkItemType] = 'User Story'
      AND [System.State] = 'Closed'
      AND [Microsoft.VSTS.Common.ClosedDate] >= @startDate
      AND [Microsoft.VSTS.Common.ClosedDate] <= @endDate
      ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
    `,

    // Get work items by assignee for individual performance
    workItemsByAssignee: `
      SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints]
      FROM WorkItems 
      WHERE [System.TeamProject] = @project 
      AND [System.AssignedTo] = @assignee
      AND [System.ChangedDate] >= @startDate
      AND [System.State] <> 'Removed'
      ORDER BY [System.ChangedDate] DESC
    `
  },

  // Performance monitoring thresholds
  performance: {
    maxResponseTimeMs: 5000,
    maxCacheSize: 1000,
    warnOnSlowQueries: true,
    logDetailedMetrics: process.env.NODE_ENV === 'development'
  },

  // Security settings
  security: {
    validateSSL: process.env.NODE_ENV === 'production',
    allowInsecureConnections: process.env.AZURE_ALLOW_INSECURE === 'true',
    maskPATInLogs: true,
    logSensitiveData: false
  },

  // Feature flags
  features: {
    enableAnalytics: process.env.AZURE_ENABLE_ANALYTICS === 'true',
    enableBatching: process.env.AZURE_ENABLE_BATCHING !== 'false',
    enableCaching: process.env.AZURE_ENABLE_CACHING !== 'false',
    enableRateLimiting: process.env.AZURE_ENABLE_RATE_LIMITING !== 'false',
    enableMetrics: process.env.AZURE_ENABLE_METRICS !== 'false'
  }
};

/**
 * Validate Azure DevOps configuration
 * @returns {object} Validation result
 */
function validateConfig() {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!azureDevOpsConfig.organization) {
    errors.push('AZURE_DEVOPS_ORG environment variable is required');
  }

  if (!azureDevOpsConfig.project) {
    errors.push('AZURE_DEVOPS_PROJECT environment variable is required');
  }

  if (!azureDevOpsConfig.pat) {
    errors.push('AZURE_DEVOPS_PAT environment variable is required');
  }

  // Check PAT format (should be base64-like string)
  if (azureDevOpsConfig.pat && azureDevOpsConfig.pat.length < 50) {
    warnings.push('PAT token appears to be too short, please verify it is correct');
  }

  // Check rate limiting configuration
  if (azureDevOpsConfig.rateLimiting.requestsPerMinute > 300) {
    warnings.push('Rate limit is set very high, this may cause API throttling');
  }

  // Check cache TTL values
  if (azureDevOpsConfig.cache.workItems < 60000) {
    warnings.push('Work items cache TTL is very low, this may impact performance');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get configuration for specific environment
 * @param {string} environment - Environment name (development, staging, production)
 * @returns {object} Environment-specific configuration
 */
function getEnvironmentConfig(environment = process.env.NODE_ENV || 'development') {
  const envConfig = { ...azureDevOpsConfig };

  switch (environment) {
    case 'development':
      envConfig.performance.logDetailedMetrics = true;
      envConfig.cache.workItems = 30000; // 30 seconds for faster development
      envConfig.rateLimiting.requestsPerMinute = 30; // Lower rate limit for dev
      break;

    case 'staging':
      envConfig.performance.logDetailedMetrics = true;
      envConfig.cache.workItems = 2 * 60 * 1000; // 2 minutes
      break;

    case 'production':
      envConfig.security.validateSSL = true;
      envConfig.security.logSensitiveData = false;
      envConfig.performance.logDetailedMetrics = false;
      break;
  }

  return envConfig;
}

/**
 * Get default query options
 * @returns {object} Default query options
 */
function getDefaultQueryOptions() {
  return {
    workItemTypes: ['Task', 'Bug', 'User Story', 'Feature'],
    maxResults: 1000,
    includeDescription: false,
    includeHistory: false,
    expandFields: false
  };
}

/**
 * Build authentication headers
 * @param {string} pat - Personal Access Token
 * @returns {object} Authentication headers
 */
function buildAuthHeaders(pat = azureDevOpsConfig.pat) {
  return {
    'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RIS-Performance-Dashboard/1.0'
  };
}

module.exports = {
  azureDevOpsConfig,
  validateConfig,
  getEnvironmentConfig,
  getDefaultQueryOptions,
  buildAuthHeaders
};