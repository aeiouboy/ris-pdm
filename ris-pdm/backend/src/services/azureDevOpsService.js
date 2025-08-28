/**
 * Azure DevOps API Integration Service
 * Handles authentication, API calls, and data transformation for Azure DevOps
 * Implements caching, rate limiting, and error handling
 */

require('dotenv').config();
const https = require('https');
const { performance } = require('perf_hooks');
const { mapFrontendProjectToAzure } = require('../config/projectMapping');
const logger = require('../../utils/logger');
// Using built-in fetch from Node.js 18+
const fetch = globalThis.fetch;
const cacheService = require('./cacheService');

class AzureDevOpsService {
  constructor(config = {}) {
    this.organization = config.organization || process.env.AZURE_DEVOPS_ORG;
    this.project = config.project || process.env.AZURE_DEVOPS_PROJECT;
    this.pat = config.pat || process.env.AZURE_DEVOPS_PAT;
    this.apiVersion = config.apiVersion || '7.0';
    this.baseUrl = `https://dev.azure.com/${this.organization}`;
    
    // Rate limiting configuration - Azure DevOps allows much more than 60/minute
    // Typical limits are around 200-300/minute for REST APIs
    this.rateLimiter = {
      requestsPerMinute: parseInt(process.env.AZURE_DEVOPS_RATE_LIMIT) || 180, // More generous limit
      requestQueue: [],
      requestTimes: []
    };
    
    // Request batching configuration
    this.batchConfig = {
      maxBatchSize: 100,
      batchDelayMs: 100,
      pendingBatches: new Map()
    };
    
    // Enhanced caching with Redis support
    this.cacheService = cacheService;
    this.cacheTTL = {
      workItems: 300,      // 5 minutes (seconds)
      workItemDetails: 900, // 15 minutes (seconds)
      iterations: 1800,    // 30 minutes (seconds)
      teamCapacity: 900,   // 15 minutes (seconds)
      metrics: 300,        // 5 minutes (seconds)
      teamMembers: 1800,   // 30 minutes (seconds)
    };
    
    this.validateConfig();
    this.setupAuth();
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    if (!this.organization || !this.project || !this.pat) {
      const error = new Error(
        'Azure DevOps configuration incomplete. Required: AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT'
      );
      logger.error('Azure DevOps configuration validation failed:', error.message);
      throw error;
    }
    
    logger.info('Azure DevOps configuration validated successfully');
  }

  /**
   * Setup authentication headers
   */
  setupAuth() {
    this.authHeaders = {
      'Authorization': `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Make authenticated request to Azure DevOps API with rate limiting
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise<object>} API response
   */
  async makeRequest(endpoint, options = {}) {
    const startTime = performance.now();
    
    try {
      await this.enforceRateLimit();
      
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          ...this.authHeaders,
          ...options.headers
        },
        timeout: options.timeout || 30000
      };

      if (options.body) {
        requestOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      const response = await fetch(url, requestOptions);
      
      const duration = performance.now() - startTime;
      logger.debug(`Azure DevOps API call: ${options.method || 'GET'} ${endpoint} - ${response.status} (${duration.toFixed(2)}ms)`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure DevOps API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.recordRequestTime();
      
      return data;
    } catch (error) {
      logger.error(`Azure DevOps API request failed: ${endpoint}`, error);
      throw new Error(`Failed to fetch from Azure DevOps: ${error.message}`);
    }
  }

  /**
   * Enforce rate limiting (60 requests per minute)
   */
  async enforceRateLimit() {
    const now = Date.now();
    const minuteAgo = now - 60000;
    
    // Clean old request times
    this.rateLimiter.requestTimes = this.rateLimiter.requestTimes.filter(time => time > minuteAgo);
    
    if (this.rateLimiter.requestTimes.length >= this.rateLimiter.requestsPerMinute) {
      const oldestRequest = this.rateLimiter.requestTimes[0];
      const waitTime = 60000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        logger.debug(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Record request time for rate limiting
   */
  recordRequestTime() {
    this.rateLimiter.requestTimes.push(Date.now());
  }

  /**
   * Get cached data using enhanced cache service
   * @param {string} namespace - Cache namespace
   * @param {string} identifier - Cache identifier
   * @param {object} params - Cache parameters
   * @returns {object|null} Cached data or null
   */
  async getFromCache(namespace, identifier, params = {}) {
    const key = this.cacheService.generateKey(namespace, identifier, params);
    return await this.cacheService.get(key);
  }

  /**
   * Store data in enhanced cache service
   * @param {string} namespace - Cache namespace
   * @param {string} identifier - Cache identifier
   * @param {object} params - Cache parameters
   * @param {object} data - Data to cache
   * @param {number} ttl - Time to live in seconds
   */
  async setCache(namespace, identifier, params = {}, data, ttl) {
    const key = this.cacheService.generateKey(namespace, identifier, params);
    return await this.cacheService.set(key, data, { ttl });
  }

  /**
   * Query work items using WIQL (Work Item Query Language)
   * @param {object} queryOptions - Query options
   * @returns {Promise<object>} Work items query result
   */
  async getWorkItems(queryOptions = {}) {
    const {
      workItemTypes = ['Task', 'Bug', 'User Story', 'Feature'],
      states = null, // If null, excludes only 'Removed'
      iterationPath = null,
      areaPath = null,
      assignedTo = null,
      customQuery = null,
      maxResults = 1000,
      projectName = null // New parameter for project-specific queries
    } = queryOptions;

    // Check enhanced cache
    const cached = await this.getFromCache('workItems', 'query', queryOptions);
    if (cached) {
      logger.debug('Returning cached work items');
      return cached;
    }

    try {
      let wiqlQuery;
      
      if (customQuery) {
        wiqlQuery = customQuery;
      } else {
        const typeFilter = `[System.WorkItemType] IN (${workItemTypes.map(type => `'${type}'`).join(', ')})`;
        const stateFilter = states ? 
          `[System.State] IN (${states.map(state => `'${state}'`).join(', ')})` :
          `[System.State] <> 'Removed'`;
        const iterationFilter = iterationPath ? `AND [System.IterationPath] UNDER '${iterationPath}'` : '';
        const areaFilter = areaPath ? `AND [System.AreaPath] UNDER '${areaPath}'` : '';
        const assigneeFilter = assignedTo ? `AND [System.AssignedTo] = '${assignedTo}'` : '';
        
        // Use specific project if provided, otherwise use default
        const targetProject = projectName || this.project;
        
        wiqlQuery = `
          SELECT [System.Id], [System.Title], [System.WorkItemType], 
                 [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints],
                 [System.CreatedDate], [System.ChangedDate], [System.AreaPath], 
                 [System.IterationPath], [Microsoft.VSTS.Common.Priority]
          FROM WorkItems 
          WHERE [System.TeamProject] = '${targetProject}'
          AND ${typeFilter}
          AND ${stateFilter}
          ${iterationFilter}
          ${areaFilter}
          ${assigneeFilter}
          ORDER BY [System.ChangedDate] DESC
        `.trim();
      }

      // Use specific project if provided, otherwise use default
      const targetProject = projectName || this.project;
      const endpoint = `/${encodeURIComponent(targetProject)}/_apis/wit/wiql?api-version=${this.apiVersion}`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: { query: wiqlQuery }
      });

      // Limit results to prevent overwhelming responses
      const workItems = response.workItems.slice(0, maxResults);
      
      const result = {
        workItems,
        query: wiqlQuery,
        totalCount: response.workItems.length,
        returnedCount: workItems.length
      };

      // Cache the result
      await this.setCache('workItems', 'query', queryOptions, result, this.cacheTTL.workItems);
      return result;
      
    } catch (error) {
      logger.error('Error fetching work items:', error);
      throw new Error(`Failed to fetch work items: ${error.message}`);
    }
  }

  /**
   * Get detailed work item information for specific IDs
   * @param {Array<number>} workItemIds - Array of work item IDs
   * @param {Array<string>} fields - Optional specific fields to retrieve
   * @param {string} projectName - Project name for work item context
   * @returns {Promise<object>} Detailed work item data
   */
  async getWorkItemDetails(workItemIds, fields = null, projectName = null) {
    if (!Array.isArray(workItemIds) || workItemIds.length === 0) {
      throw new Error('Work item IDs must be a non-empty array');
    }

    // Check enhanced cache
    const cacheParams = { 
      ids: workItemIds.sort().join(','), 
      fields: fields?.join(',') || 'all' 
    };
    const cached = await this.getFromCache('workItemDetails', 'batch', cacheParams);
    if (cached) {
      logger.debug('Returning cached work item details');
      return cached;
    }

    try {
      // Use predefined comprehensive field list if none specified
      const defaultFields = [
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
        'System.Description',
        // Add custom fields that exist in this Azure DevOps instance
        'Bug types' // Direct field name as shown in user's screenshot
      ];

      const fieldsToRequest = fields || defaultFields;
      
      // Handle batch requests for large numbers of work items
      const batches = this.createBatches(workItemIds, this.batchConfig.maxBatchSize);
      const allResults = [];

      for (const batch of batches) {
        const ids = batch.join(',');
        const targetProject = projectName || this.project;
        // Use $expand=all to get all fields including custom fields, don't specify individual fields
        const endpoint = `/${encodeURIComponent(targetProject)}/_apis/wit/workitems?ids=${ids}&$expand=all&api-version=${this.apiVersion}`;
        
        const batchResult = await this.makeRequest(endpoint);
        allResults.push(...batchResult.value);
        
        // Add small delay between batches to be respectful to the API
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, this.batchConfig.batchDelayMs));
        }
      }

      // Transform the data to our standardized format with project context
      const targetProject = projectName || this.project;
      const transformedResults = allResults.map(item => this.transformWorkItem(item, targetProject));
      
      const result = {
        workItems: transformedResults,
        count: transformedResults.length,
        fields: fieldsToRequest
      };

      // Cache the result
      await this.setCache('workItemDetails', 'batch', cacheParams, result, this.cacheTTL.workItemDetails);
      return result;
      
    } catch (error) {
      logger.error('Error fetching work item details:', error);
      throw new Error(`Failed to fetch work item details: ${error.message}`);
    }
  }

  /**
   * Get sprint/iteration data for a team
   * @param {string} teamName - Team name (optional, uses project default if not provided)
   * @param {string} timeframe - Time frame for iterations ('current', 'past', 'future', or 'all')
   * @returns {Promise<object>} Iterations data
   */
  async getIterations(teamName = null, timeframe = 'current') {
    // Try different team name formats for Azure DevOps
    const possibleTeamNames = teamName ? [teamName] : [
      this.project,
      `${this.project} Team`,
      this.project.split(' - ').pop(), // Last part after dash
      this.project.replace('Product - ', '') // Remove Product prefix
    ];
    
    for (const team of possibleTeamNames) {
      // Check enhanced cache
      const cached = await this.getFromCache('iterations', team, { timeframe });
      if (cached) {
        logger.debug('Returning cached iterations');
        return cached;
      }

      try {
        let endpoint;
        if (timeframe === 'current') {
          endpoint = `/${encodeURIComponent(this.project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=${this.apiVersion}`;
        } else if (timeframe === 'all') {
          endpoint = `/${encodeURIComponent(this.project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=${this.apiVersion}`;
        } else {
          endpoint = `/${encodeURIComponent(this.project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?$timeframe=${timeframe}&api-version=${this.apiVersion}`;
        }

        const response = await this.makeRequest(endpoint);
      
        // Enrich iterations with additional data
        const enrichedIterations = await Promise.all(
          response.value.map(async (iteration) => {
            try {
              // Get iteration work items
              const iterationWorkItems = await this.getWorkItems({
                iterationPath: iteration.path
              });
              
              return {
                ...iteration,
                workItemCount: iterationWorkItems.totalCount,
                workItems: iterationWorkItems.workItems.slice(0, 10) // Limit for performance
              };
            } catch (error) {
              logger.warn(`Failed to enrich iteration ${iteration.name}:`, error.message);
              return iteration;
            }
          })
        );

        const result = {
          iterations: enrichedIterations,
          count: enrichedIterations.length,
          team,
          timeframe
        };

        // Cache the result
        await this.setCache('iterations', team, { timeframe }, result, this.cacheTTL.iterations);
        return result;
        
      } catch (error) {
        // Try next team name
        logger.warn(`Team '${team}' not found, trying next option:`, error.message);
        continue;
      }
    }
    
    // If no team worked, return empty result
    return {
      iterations: [],
      count: 0,
      team: possibleTeamNames[0],
      timeframe,
      error: 'No valid team found for this project'
    };
  }

  /**
   * Get team capacity for a specific iteration
   * @param {string} teamName - Team name
   * @param {string} iterationId - Iteration ID
   * @returns {Promise<object>} Team capacity data
   */
  async getTeamCapacity(teamName, iterationId) {
    if (!teamName || !iterationId) {
      throw new Error('Team name and iteration ID are required');
    }

    // Check enhanced cache
    const cached = await this.getFromCache('teamCapacity', teamName, { iterationId });
    if (cached) {
      logger.debug('Returning cached team capacity');
      return cached;
    }

    try {
      const endpoint = `/${encodeURIComponent(this.project)}/${encodeURIComponent(teamName)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/capacities?api-version=${this.apiVersion}`;
      const response = await this.makeRequest(endpoint);
      
      // Calculate total capacity and utilization
      const capacityData = response.value.map(member => ({
        ...member,
        totalCapacity: member.activities.reduce((sum, activity) => sum + (activity.capacityPerDay || 0), 0),
        utilizationPercentage: this.calculateUtilization(member)
      }));

      const totalTeamCapacity = capacityData.reduce((sum, member) => sum + member.totalCapacity, 0);
      
      const result = {
        teamCapacity: capacityData,
        totalCapacity: totalTeamCapacity,
        teamName,
        iterationId,
        memberCount: capacityData.length
      };

      // Cache the result
      await this.setCache('teamCapacity', teamName, { iterationId }, result, this.cacheTTL.teamCapacity);
      return result;
      
    } catch (error) {
      logger.error('Error fetching team capacity:', error);
      throw new Error(`Failed to fetch team capacity: ${error.message}`);
    }
  }

  /**
   * Calculate utilization percentage for a team member
   * @param {object} member - Team member capacity data
   * @returns {number} Utilization percentage
   */
  calculateUtilization(member) {
    if (!member.activities || member.activities.length === 0) {
      return 0;
    }
    
    const totalCapacity = member.activities.reduce((sum, activity) => sum + (activity.capacityPerDay || 0), 0);
    const totalAssigned = member.activities.reduce((sum, activity) => sum + (activity.assignedWork || 0), 0);
    
    return totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
  }

  /**
   * Transform Azure DevOps work item to standardized format
   * @param {object} azureWorkItem - Raw Azure DevOps work item
   * @returns {object} Transformed work item
   */
  transformWorkItem(azureWorkItem, projectName = null) {
    const fields = azureWorkItem.fields || {};
    const project = projectName || this.project;
    
    // Extract custom fields for bug classification
    const customFields = {};
    
    // Look for Bug Types field with possible names that exist in this instance
    const possibleBugTypeFields = [
      'bug types', // Direct field name - lowercase as specified by user
      'Bug types', // Direct field name - title case
      'Bug Types', // Direct field name - title case
      'Custom.BugType',
      'Custom.BugTypes', 
      'Custom.bug types',
      'Microsoft.VSTS.Common.BugType',
      'System.BugType',
      'WEF.BugType',
      'WEF.Bug_Type',
      'Custom.Bug_Type'
    ];
    
    // Case-insensitive search for bug types field
    let bugTypeFieldFound = null;
    for (const fieldName of possibleBugTypeFields) {
      if (fields[fieldName]) {
        customFields.bugTypes = fields[fieldName];
        bugTypeFieldFound = fieldName;
        break;
      }
    }
    
    // If not found with exact match, try case-insensitive search
    if (!bugTypeFieldFound) {
      const fieldKeys = Object.keys(fields);
      for (const actualFieldName of fieldKeys) {
        if (actualFieldName.toLowerCase() === 'bug types' || 
            actualFieldName.toLowerCase().includes('bug') && actualFieldName.toLowerCase().includes('type')) {
          customFields.bugTypes = fields[actualFieldName];
          bugTypeFieldFound = actualFieldName;
          break;
        }
      }
    }

    // Extract other custom fields that might be useful
    Object.keys(fields).forEach(fieldKey => {
      if (fieldKey.startsWith('Custom.') || 
          fieldKey.startsWith('WEF_') || 
          fieldKey.includes('Bug') || 
          fieldKey.includes('Issue') || 
          fieldKey.includes('Type')) {
        customFields[fieldKey] = fields[fieldKey];
      }
    });
    
    return {
      id: fields['System.Id'],
      title: fields['System.Title'],
      type: fields['System.WorkItemType'],
      assignee: fields['System.AssignedTo']?.displayName || 'Unassigned',
      assigneeEmail: fields['System.AssignedTo']?.uniqueName,
      assigneeImageUrl: fields['System.AssignedTo']?.imageUrl,
      state: fields['System.State'],
      storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
      priority: fields['Microsoft.VSTS.Common.Priority'] || 4,
      createdDate: fields['System.CreatedDate'],
      changedDate: fields['System.ChangedDate'],
      closedDate: fields['Microsoft.VSTS.Common.ClosedDate'],
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').filter(tag => tag.trim()) : [],
      areaPath: fields['System.AreaPath'],
      iterationPath: fields['System.IterationPath'],
      remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0,
      completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0,
      originalEstimate: fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0,
      reason: fields['System.Reason'],
      parentId: fields['System.Parent'],
      description: fields['System.Description'],
      project: project, // Add project context
      url: azureWorkItem._links?.html?.href || `https://dev.azure.com/${this.organization}/${encodeURIComponent(project)}/_workitems/edit/${fields['System.Id']}`,
      
      // Add custom fields for bug classification
      customFields: customFields,
      bugType: customFields.bugTypes, // Direct access for bug classification
      
      // Raw fields for advanced classification
      fields: fields
    };
  }

  /**
   * Create batches from array of items
   * @param {Array} items - Items to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array<Array>} Array of batches
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get service health and statistics
   * @returns {object} Service health information
   */
  getServiceHealth() {
    return {
      cacheSize: this.cache.size,
      rateLimiter: {
        requestsInLastMinute: this.rateLimiter.requestTimes.filter(
          time => time > Date.now() - 60000
        ).length,
        maxRequestsPerMinute: this.rateLimiter.requestsPerMinute
      },
      configuration: {
        organization: this.organization,
        project: this.project,
        apiVersion: this.apiVersion,
        hasValidPAT: !!this.pat
      }
    };
  }

  /**
   * Clear cache (useful for testing or forcing fresh data)
   */
  async clearCache() {
    // Clear Redis cache with pattern matching
    await this.cacheService.clearPattern('ris:cache:*');
    logger.info('Azure DevOps service cache cleared');
  }

  /**
   * Initialize the service with cache setup
   */
  async initialize() {
    try {
      await this.cacheService.initialize();
      logger.info('Azure DevOps service initialized with enhanced caching');
      return true;
    } catch (error) {
      logger.warn('Azure DevOps service initialized without Redis cache:', error.message);
      return false;
    }
  }

  /**
   * Get all projects from the Azure DevOps organization
   * @returns {Promise<object>} Projects data
   */
  async getProjects() {
    // Check enhanced cache
    const cached = await this.getFromCache('projects', 'all', {});
    if (cached) {
      logger.debug('Returning cached projects');
      return cached;
    }

    try {
      const endpoint = `/_apis/projects?api-version=${this.apiVersion}`;
      const response = await this.makeRequest(endpoint);
      
      // Transform projects to our standardized format
      const transformedProjects = response.value.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description || '',
        state: project.state,
        visibility: project.visibility,
        lastUpdateTime: project.lastUpdateTime,
        url: project.url,
        capabilities: project.capabilities || {},
        // Map to product format expected by frontend
        teamSize: null, // Will be populated when we fetch team members
        currentSprint: null, // Will be populated when we fetch iterations
        status: project.state === 'wellFormed' ? 'active' : 'inactive',
        lead: null, // Will be populated when we fetch team members
        createdAt: project.lastUpdateTime
      }));

      const result = {
        projects: transformedProjects,
        count: transformedProjects.length,
        organization: this.organization
      };

      // Cache the result with 1-hour TTL as specified in requirements
      await this.setCache('projects', 'all', {}, result, 3600);
      return result;
      
    } catch (error) {
      logger.error('Error fetching projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  /**
   * Get team members from a specific Azure DevOps project
   * @param {string} projectName - The Azure DevOps project name
   * @returns {Promise<object>} Team members data
   */
  async getProjectTeamMembers(projectName = null) {
    const targetProject = projectName || this.project;
    
    logger.debug(`Getting team members for Azure DevOps project: "${targetProject}"`);

    try {
      // Get all teams in the specific project - using correct API format
      const teamsEndpoint = `/_apis/projects/${encodeURIComponent(targetProject)}/teams?api-version=${this.apiVersion}`;
      logger.debug(`Getting teams from: ${teamsEndpoint}`);
      const teamsResponse = await this.makeRequest(teamsEndpoint);
      logger.debug('Teams API response:', teamsResponse);
      logger.debug(`Found ${teamsResponse.value?.length || 0} teams in project ${targetProject}`);
      
      const allMembers = new Map();
      
      // Get members from each team in the project
      for (const team of teamsResponse.value || []) {
        logger.debug(`Getting members for team: ${team.name} (${team.id})`);
        const membersEndpoint = `/_apis/projects/${encodeURIComponent(targetProject)}/teams/${team.id}/members?api-version=${this.apiVersion}`;
        const membersResponse = await this.makeRequest(membersEndpoint);
        logger.debug(`Members API response for team ${team.name}:`, membersResponse);
        logger.debug(`Found ${membersResponse.value?.length || 0} members in team ${team.name}`);
        
        for (const member of membersResponse.value || []) {
          if (!allMembers.has(member.identity.uniqueName)) {
            // Use the actual displayName from Azure DevOps API
            const displayName = member.identity.displayName;
            
            allMembers.set(member.identity.uniqueName, {
              id: member.identity.uniqueName,
              name: displayName || member.identity.uniqueName, // Only fallback to uniqueName if no displayName
              email: member.identity.uniqueName,
              avatar: member.identity.imageUrl || `https://dev.azure.com/${this.organization}/_apis/GraphProfile/MemberAvatars/${member.identity.id}`,
              role: 'Developer', // Default role
              isActive: true
            });
          }
        }
      }
      
      const members = Array.from(allMembers.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      logger.info(`Found ${members.length} total team members for project: ${targetProject}`);
      
      return {
        members,
        count: members.length,
        project: targetProject,
        actualProject: targetProject,
        totalMembers: members.length
      };
      
    } catch (error) {
      logger.error(`Error fetching team members for project ${targetProject}:`, error);
      throw new Error(`Failed to fetch team members for project ${targetProject}: ${error.message}`);
    }
  }

  /**
   * Get all team members from the configured Azure DevOps project
   * @returns {Promise<Array>} Array of team member objects
   */
  async getTeamMembers() {
    // Use the existing getProjectTeamMembers method with the default project
    const result = await this.getProjectTeamMembers();
    return result.members || [];
  }

  /**
   * Filter team members by frontend project selection
   * Uses actual Azure DevOps project membership instead of hash-based distribution
   * @private
   */
  async filterMembersByProject(allMembers, projectName) {
    // If requesting all projects, return all members
    if (!projectName || projectName === 'all-projects') {
      return allMembers;
    }
    
    try {
      // Map frontend project name to actual Azure DevOps project
      const azureProjectName = mapFrontendProjectToAzure(projectName);
      
      if (!azureProjectName) {
        logger.warn(`No Azure DevOps mapping for project: ${projectName}`);
        return [];
      }
      
      logger.debug(`Getting team members for Azure DevOps project: "${azureProjectName}"`);
      
      // Get actual project team members from the specific Azure DevOps project
      const projectTeamData = await this.getProjectTeamMembers(azureProjectName);
      
      if (!projectTeamData || !projectTeamData.members) {
        logger.warn(`No team members found in Azure DevOps project: ${azureProjectName}`);
        return [];
      }
      
      logger.info(`Found ${projectTeamData.members.length} team members in project "${azureProjectName}"`);
      logger.debug(`Members: ${projectTeamData.members.map(m => m.name).join(', ')}`);
      
      return projectTeamData.members;
      
    } catch (error) {
      logger.warn(`Could not get project members for "${projectName}":`, error.message);
      
      // Fallback: Filter by work item assignments for this specific project
      try {
        const workItems = await this.getWorkItems({ 
          project: mapFrontendProjectToAzure(projectName) 
        });
        
        const assignedEmails = new Set(
          workItems
            .filter(item => item.assignee && item.assignee.email)
            .map(item => item.assignee.email.toLowerCase())
        );
        
        const filteredMembers = allMembers.filter(member => 
          assignedEmails.has(member.email?.toLowerCase())
        );
        
        logger.info(`Project "${projectName}": ${filteredMembers.length} members (from work items fallback)`);
        return filteredMembers;
        
      } catch (fallbackError) {
        logger.error(`Both project members and work items failed for "${projectName}":`, fallbackError.message);
        return []; // Return empty array instead of arbitrary hash-based assignment
      }
    }
  }

  /**
   * Get Sprint Capacity data (like in Azure DevOps dashboard)
   * @param {string} projectName Project name
   * @param {string} iterationId Iteration/Sprint ID
   * @returns {Promise<object>} Sprint capacity data
   */
  async getSprintCapacity(projectName, iterationId) {
    const cacheKey = `sprint_capacity_${projectName}_${iterationId}`;
    const cached = await this.getFromCache('sprint_capacity', projectName, { iterationId });
    if (cached) return cached;

    try {
      // First, get teams for the project to find actual team names
      const teamsUrl = `https://dev.azure.com/${this.organization}/_apis/projects/${encodeURIComponent(projectName)}/teams?api-version=7.0`;
      logger.info(`Getting teams for project ${projectName}`);
      const teamsResponse = await this.makeRequest(teamsUrl);
      
      if (!teamsResponse.value || teamsResponse.value.length === 0) {
        throw new Error(`No teams found for project ${projectName}`);
      }
      
      // Try to get capacity from the first available team
      const team = teamsResponse.value[0];
      logger.info(`Using team: ${team.name} for capacity data`);
      
      // Get team iterations first to validate the iteration exists
      const iterationsUrl = `${this.baseUrl}/${encodeURIComponent(projectName)}/${encodeURIComponent(team.id)}/_apis/work/teamsettings/iterations?api-version=7.0`;
      const iterationsResponse = await this.makeRequest(iterationsUrl);
      
      // Get capacity using correct team ID and iteration structure
      const capacityUrl = `${this.baseUrl}/${encodeURIComponent(projectName)}/${encodeURIComponent(team.id)}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=7.0`;
      
      logger.info(`Fetching sprint capacity from: ${capacityUrl}`);
      const response = await this.makeRequest(capacityUrl);
      
      const capacityData = {
        iterationId,
        teamCapacities: response.value || [],
        totalCapacity: 0,
        totalActivity: 0,
        utilizationPercentage: 0
      };

      // Calculate totals
      if (capacityData.teamCapacities.length > 0) {
        capacityData.totalCapacity = capacityData.teamCapacities.reduce((sum, member) => {
          const activities = member.activities || [];
          return sum + activities.reduce((actSum, activity) => actSum + (activity.capacityPerDay || 0), 0);
        }, 0);
      }

      await this.setCache('sprint_capacity', projectName, { iterationId }, capacityData, this.cacheTTL.teamCapacity);
      return capacityData;
      
    } catch (error) {
      logger.warn(`Could not get sprint capacity for ${projectName}:`, error.message);
      return {
        iterationId,
        teamCapacities: [],
        totalCapacity: 0,
        totalActivity: 0,
        utilizationPercentage: 0,
        error: error.message
      };
    }
  }

  /**
   * Get Sprint Burndown data from Azure DevOps (official burndown)
   * @param {string} projectName Project name  
   * @param {string} iterationId Iteration/Sprint ID
   * @returns {Promise<object>} Burndown chart data
   */
  async getSprintBurndown(projectName, iterationId) {
    const cacheKey = `sprint_burndown_${projectName}_${iterationId}`;
    const cached = await this.getFromCache('sprint_burndown', projectName, { iterationId });
    if (cached) return cached;

    try {
      // First, get teams for the project
      const teamsUrl = `https://dev.azure.com/${this.organization}/_apis/projects/${encodeURIComponent(projectName)}/teams?api-version=7.0`;
      logger.info(`Getting teams for project ${projectName}`);
      const teamsResponse = await this.makeRequest(teamsUrl);
      
      if (!teamsResponse.value || teamsResponse.value.length === 0) {
        throw new Error(`No teams found for project ${projectName}`);
      }
      
      const team = teamsResponse.value[0];
      logger.info(`Using team: ${team.name} for burndown data`);
      
      // Get team iterations to find valid iteration data
      const iterationsUrl = `${this.baseUrl}/${encodeURIComponent(projectName)}/${encodeURIComponent(team.id)}/_apis/work/teamsettings/iterations?api-version=7.0`;
      const iterationsResponse = await this.makeRequest(iterationsUrl);
      
      let targetIteration = null;
      if (iterationId === 'current') {
        // Find current iteration
        targetIteration = iterationsResponse.value?.find(iter => 
          iter.attributes?.timeFrame === 'current' ||
          (new Date(iter.attributes?.startDate) <= new Date() && new Date() <= new Date(iter.attributes?.finishDate))
        );
      } else {
        // Find specific iteration
        targetIteration = iterationsResponse.value?.find(iter => 
          iter.id === iterationId || iter.name === iterationId
        );
      }
      
      if (!targetIteration) {
        throw new Error(`Iteration ${iterationId} not found for team ${team.name}`);
      }
      
      // Get capacity data for this iteration  
      const capacityUrl = `${this.baseUrl}/${encodeURIComponent(projectName)}/${encodeURIComponent(team.id)}/_apis/work/teamsettings/iterations/${targetIteration.id}/capacities?api-version=7.0`;
      const capacityResponse = await this.makeRequest(capacityUrl);
      
      // Calculate total team capacity
      const totalCapacity = capacityResponse.value?.reduce((sum, member) => {
        const activities = member.activities || [];
        return sum + activities.reduce((actSum, activity) => actSum + (activity.capacityPerDay || 0), 0);
      }, 0) || 0;
      
      const burndownData = {
        iterationId: targetIteration.id,
        iterationName: targetIteration.name,
        startDate: targetIteration.attributes?.startDate,
        endDate: targetIteration.attributes?.finishDate,
        totalCapacity: totalCapacity,
        teamCapacities: capacityResponse.value || [],
        chartData: {
          totalCapacity: totalCapacity,
          teamName: team.name,
          iteration: targetIteration.name
        },
        dataExists: true
      };

      await this.setCache('sprint_burndown', projectName, { iterationId }, burndownData, this.cacheTTL.iterations);
      return burndownData;
      
    } catch (error) {
      logger.warn(`Could not get official sprint burndown for ${projectName}:`, error.message);
      return {
        iterationId,
        chartData: {},
        dataExists: false,
        error: error.message
      };
    }
  }

  /**
   * Get Work Item Analytics (dashboard-style metrics)
   * @param {string} projectName Project name
   * @param {object} options Query options
   * @returns {Promise<object>} Work item analytics
   */
  async getWorkItemAnalytics(projectName, options = {}) {
    const cacheKey = `work_item_analytics_${projectName}_${JSON.stringify(options)}`;
    const cached = await this.getFromCache('analytics', projectName, options);
    if (cached) return cached;

    try {
      // Use Analytics API if available (newer Azure DevOps feature)
      const analyticsUrl = `https://analytics.dev.azure.com/${this.organization}/${encodeURIComponent(projectName)}/_odata/v3.0-preview/WorkItems`;
      
      const filters = [];
      if (options.iterationId) {
        filters.push(`IterationSK eq ${options.iterationId}`);
      }
      if (options.startDate && options.endDate) {
        filters.push(`CreatedDate ge ${options.startDate} and CreatedDate le ${options.endDate}`);
      }
      
      const filterQuery = filters.length > 0 ? `$filter=${filters.join(' and ')}` : '';
      const selectQuery = `$select=WorkItemId,Title,WorkItemType,State,AssignedTo,StoryPoints,CreatedDate,ChangedDate`;
      const fullUrl = `${analyticsUrl}?${selectQuery}&${filterQuery}&$top=1000`;
      
      logger.info(`Fetching work item analytics for ${projectName}`);
      const response = await this.makeRequest(fullUrl);
      
      const analytics = {
        workItems: response.value || [],
        totalCount: response['@odata.count'] || (response.value ? response.value.length : 0),
        queryOptions: options,
        source: 'analytics_api'
      };

      await this.setCache('analytics', projectName, options, analytics, this.cacheTTL.workItems);
      return analytics;
      
    } catch (error) {
      logger.warn(`Analytics API failed for ${projectName}, using fallback:`, error.message);
      
      // Fallback to regular work items query
      try {
        const workItemsResponse = await this.getWorkItems({
          projectName,
          maxResults: 1000,
          ...options
        });
        
        return {
          workItems: workItemsResponse.workItems || [],
          totalCount: workItemsResponse.totalCount || 0,
          queryOptions: options,
          source: 'fallback_api'
        };
      } catch (fallbackError) {
        logger.error(`Both analytics and fallback failed for ${projectName}:`, fallbackError.message);
        return {
          workItems: [],
          totalCount: 0,
          queryOptions: options,
          source: 'error',
          error: fallbackError.message
        };
      }
    }
  }

}

module.exports = AzureDevOpsService;