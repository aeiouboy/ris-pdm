/**
 * Azure DevOps API Integration Service
 * Handles authentication, API calls, and data transformation for Azure DevOps
 * Implements caching, rate limiting, and error handling
 */

require('dotenv').config();
const https = require('https');
const { performance } = require('perf_hooks');
const { mapFrontendProjectToAzure } = require('../config/projectMapping');
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
    
    // Check if we're in test/fallback mode
    this.isTestMode = this.isUsingTestCredentials();
    
    // Rate limiting configuration
    this.rateLimiter = {
      requestsPerMinute: 60,
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
   * Check if using test/fallback credentials
   */
  isUsingTestCredentials() {
    const testValues = ['test-org', 'test-project', 'test-pat', 'mock', 'demo', 'sample'];
    return testValues.includes(this.organization) || 
           testValues.includes(this.project) || 
           testValues.includes(this.pat) ||
           !this.organization || !this.project || !this.pat;
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    if (!this.organization || !this.project || !this.pat) {
      console.warn('Azure DevOps configuration incomplete - running in test mode with mock data');
      this.isTestMode = true;
      return;
    }
    
    if (this.isTestMode) {
      console.log('Azure DevOps detected test credentials - using mock data instead of real API calls');
    }
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
      console.log(`Azure DevOps API call: ${options.method || 'GET'} ${endpoint} - ${response.status} (${duration.toFixed(2)}ms)`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure DevOps API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.recordRequestTime();
      
      return data;
    } catch (error) {
      console.error(`Azure DevOps API request failed: ${endpoint}`, error);
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
        console.log(`Rate limiting: waiting ${waitTime}ms`);
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

    // Return mock data if in test mode
    if (this.isTestMode) {
      console.log('Returning mock work items (test mode)');
      return this.generateMockWorkItems(queryOptions);
    }

    // Check enhanced cache
    const cached = await this.getFromCache('workItems', 'query', queryOptions);
    if (cached) {
      console.log('Returning cached work items');
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
      const endpoint = `/${targetProject}/_apis/wit/wiql?api-version=${this.apiVersion}`;
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
      console.error('Error fetching work items:', error);
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

    // Return mock data if in test mode
    if (this.isTestMode) {
      console.log('Returning mock work item details (test mode)');
      return this.generateMockWorkItemDetails(workItemIds);
    }

    // Check enhanced cache
    const cacheParams = { 
      ids: workItemIds.sort().join(','), 
      fields: fields?.join(',') || 'all' 
    };
    const cached = await this.getFromCache('workItemDetails', 'batch', cacheParams);
    if (cached) {
      console.log('Returning cached work item details');
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
        'System.Description'
      ];

      const fieldsToRequest = fields || defaultFields;
      
      // Handle batch requests for large numbers of work items
      const batches = this.createBatches(workItemIds, this.batchConfig.maxBatchSize);
      const allResults = [];

      for (const batch of batches) {
        const ids = batch.join(',');
        const fieldsParam = fieldsToRequest.join(',');
        const targetProject = projectName || this.project;
        const endpoint = `/${targetProject}/_apis/wit/workitems?ids=${ids}&fields=${fieldsParam}&api-version=${this.apiVersion}`;
        
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
      console.error('Error fetching work item details:', error);
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
    const team = teamName || this.project;
    
    // Check enhanced cache
    const cached = await this.getFromCache('iterations', team, { timeframe });
    if (cached) {
      console.log('Returning cached iterations');
      return cached;
    }

    try {
      let endpoint;
      if (timeframe === 'current') {
        endpoint = `/${this.project}/${team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=${this.apiVersion}`;
      } else if (timeframe === 'all') {
        endpoint = `/${this.project}/${team}/_apis/work/teamsettings/iterations?api-version=${this.apiVersion}`;
      } else {
        endpoint = `/${this.project}/${team}/_apis/work/teamsettings/iterations?$timeframe=${timeframe}&api-version=${this.apiVersion}`;
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
            console.warn(`Failed to enrich iteration ${iteration.name}:`, error.message);
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
      console.error('Error fetching iterations:', error);
      throw new Error(`Failed to fetch iterations: ${error.message}`);
    }
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
      console.log('Returning cached team capacity');
      return cached;
    }

    try {
      const endpoint = `/${this.project}/${teamName}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=${this.apiVersion}`;
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
      console.error('Error fetching team capacity:', error);
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
      url: azureWorkItem._links?.html?.href || `https://dev.azure.com/${this.organization}/${encodeURIComponent(project)}/_workitems/edit/${fields['System.Id']}`
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
    console.log('Azure DevOps service cache cleared');
  }

  /**
   * Initialize the service with cache setup
   */
  async initialize() {
    try {
      await this.cacheService.initialize();
      console.log('Azure DevOps service initialized with enhanced caching');
      return true;
    } catch (error) {
      console.warn('Azure DevOps service initialized without Redis cache:', error.message);
      return false;
    }
  }

  /**
   * Get team members from a specific Azure DevOps project
   * @param {string} projectName - The Azure DevOps project name
   * @returns {Promise<object>} Team members data
   */
  async getProjectTeamMembers(projectName = null) {
    const targetProject = projectName || this.project;
    
    // Return mock data if in test mode
    if (this.isTestMode) {
      console.log(`Returning mock team members for project: ${targetProject}`);
      return this.generateMockTeamMembers(targetProject);
    }

    console.log(`🔧 DEBUG: Getting team members for Azure DevOps project: "${targetProject}"`);

    try {
      // Get all teams in the specific project - using correct API format
      const teamsEndpoint = `/_apis/projects/${encodeURIComponent(targetProject)}/teams?api-version=${this.apiVersion}`;
      console.log(`🔧 Getting teams from: ${teamsEndpoint}`);
      const teamsResponse = await this.makeRequest(teamsEndpoint);
      console.log(`🔧 Teams API response:`, teamsResponse);
      console.log(`🔧 Found ${teamsResponse.value?.length || 0} teams in project ${targetProject}`);
      
      const allMembers = new Map();
      
      // Get members from each team in the project
      for (const team of teamsResponse.value || []) {
        console.log(`🔧 Getting members for team: ${team.name} (${team.id})`);
        const membersEndpoint = `/_apis/projects/${encodeURIComponent(targetProject)}/teams/${team.id}/members?api-version=${this.apiVersion}`;
        const membersResponse = await this.makeRequest(membersEndpoint);
        console.log(`🔧 Members API response for team ${team.name}:`, membersResponse);
        console.log(`🔧 Found ${membersResponse.value?.length || 0} members in team ${team.name}`);
        
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
      
      console.log(`📊 Found ${members.length} total team members for project: ${targetProject}`);
      
      return {
        members,
        count: members.length,
        project: targetProject,
        actualProject: targetProject,
        totalMembers: members.length
      };
      
    } catch (error) {
      console.error(`Error fetching team members for project ${targetProject}:`, error);
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
        console.warn(`⚠️ No Azure DevOps mapping for project: ${projectName}`);
        return [];
      }
      
      console.log(`📋 Getting team members for Azure DevOps project: "${azureProjectName}"`);
      
      // Get actual project team members from the specific Azure DevOps project
      const projectTeamData = await this.getProjectTeamMembers(azureProjectName);
      
      if (!projectTeamData || !projectTeamData.members) {
        console.warn(`⚠️ No team members found in Azure DevOps project: ${azureProjectName}`);
        return [];
      }
      
      console.log(`📋 Found ${projectTeamData.members.length} team members in project "${azureProjectName}"`);
      console.log(`📋 Members: ${projectTeamData.members.map(m => m.name).join(', ')}`);
      
      return projectTeamData.members;
      
    } catch (error) {
      console.warn(`⚠️ Could not get project members for "${projectName}":`, error.message);
      
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
        
        console.log(`📋 Project "${projectName}": ${filteredMembers.length} members (from work items fallback)`);
        return filteredMembers;
        
      } catch (fallbackError) {
        console.error(`❌ Both project members and work items failed for "${projectName}":`, fallbackError.message);
        return []; // Return empty array instead of arbitrary hash-based assignment
      }
    }
  }

  /**
   * Generate mock team members for test mode
   * @private
   */
  generateMockTeamMembers(projectName) {
    // Generate different mock teams for different projects
    const projectTeams = {
      'Team - Product Management': [
        { name: 'Alice Johnson', email: 'alice.johnson@company.com' },
        { name: 'Bob Smith', email: 'bob.smith@company.com' },
        { name: 'Carol Davis', email: 'carol.davis@company.com' }
      ],
      'Product - CFG Workflow': [
        { name: 'David Wilson', email: 'david.wilson@company.com' },
        { name: 'Emma Brown', email: 'emma.brown@company.com' }
      ],
      'Product - Luke': [
        { name: 'Frank Miller', email: 'frank.miller@company.com' },
        { name: 'Grace Lee', email: 'grace.lee@company.com' },
        { name: 'Henry Taylor', email: 'henry.taylor@company.com' },
        { name: 'Iris Chen', email: 'iris.chen@company.com' }
      ]
    };
    
    const teamMembers = projectTeams[projectName] || [
      { name: 'Default User', email: 'default@company.com' }
    ];
    
    const members = teamMembers.map((member, index) => ({
      id: member.email,
      name: member.name,
      email: member.email,
      avatar: null,
      role: 'Developer',
      isActive: true
    }));
    
    return {
      members,
      count: members.length,
      project: projectName
    };
  }

  /**
   * Generate mock work items for test mode
   * @private
   */
  generateMockWorkItems(queryOptions = {}) {
    const { maxResults = 1000 } = queryOptions;
    const mockTeamMembers = [
      { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
      { name: 'Mike Chen', email: 'mike.chen@company.com' },
      { name: 'Alex Rivera', email: 'alex.rivera@company.com' },
      { name: 'Emily Davis', email: 'emily.davis@company.com' },
      { name: 'David Kim', email: 'david.kim@company.com' }
    ];

    const workItemTypes = ['User Story', 'Task', 'Bug', 'Feature'];
    const states = ['New', 'Active', 'In Progress', 'Resolved', 'Closed'];
    const workItems = [];

    // Generate realistic work items
    for (let i = 1; i <= Math.min(maxResults, 50); i++) {
      const member = mockTeamMembers[i % mockTeamMembers.length];
      const type = workItemTypes[i % workItemTypes.length];
      const state = states[Math.floor(Math.random() * states.length)];
      
      workItems.push({
        id: 1000 + i,
        url: `https://dev.azure.com/test-org/test-project/_apis/wit/workItems/${1000 + i}`,
        type: type
      });
    }

    return {
      workItems,
      query: 'Mock WIQL Query',
      totalCount: workItems.length,
      returnedCount: workItems.length
    };
  }

  /**
   * Generate mock work item details for test mode
   * @private
   */
  generateMockWorkItemDetails(workItemIds) {
    const mockTeamMembers = [
      { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
      { name: 'Mike Chen', email: 'mike.chen@company.com' },
      { name: 'Alex Rivera', email: 'alex.rivera@company.com' },
      { name: 'Emily Davis', email: 'emily.davis@company.com' },
      { name: 'David Kim', email: 'david.kim@company.com' }
    ];

    const workItemTypes = ['User Story', 'Task', 'Bug', 'Feature'];
    const states = ['New', 'Active', 'In Progress', 'Resolved', 'Closed'];
    const priorities = [1, 2, 3, 4];
    
    const workItems = workItemIds.map(id => {
      const memberIndex = id % mockTeamMembers.length;
      const member = mockTeamMembers[memberIndex];
      const type = workItemTypes[id % workItemTypes.length];
      const state = states[id % states.length];
      const priority = priorities[id % priorities.length];
      const storyPoints = type === 'User Story' ? Math.ceil(Math.random() * 8) + 1 : null;
      
      return {
        id,
        title: `${type} ${id}: Mock work item for testing`,
        workItemType: type,
        state,
        assignee: member.name,
        assigneeEmail: member.email,
        assigneeImageUrl: null,
        storyPoints,
        priority,
        createdDate: new Date(2025, 0, Math.floor(Math.random() * 20) + 1).toISOString(),
        changedDate: new Date(2025, 0, Math.floor(Math.random() * 20) + 10).toISOString(),
        closedDate: state === 'Closed' ? new Date(2025, 0, Math.floor(Math.random() * 20) + 15).toISOString() : null,
        areaPath: 'RIS Performance Dashboard',
        iterationPath: 'RIS Performance Dashboard\\Sprint 23',
        tags: type === 'Bug' ? 'bug;high-priority' : 'feature;development',
        originalEstimate: Math.ceil(Math.random() * 16),
        remainingWork: state === 'Closed' ? 0 : Math.ceil(Math.random() * 8),
        completedWork: Math.ceil(Math.random() * 8),
        description: `This is a mock ${type.toLowerCase()} work item created for testing purposes. It simulates real Azure DevOps data.`,
        reason: state === 'Active' ? 'New' : 'Development',
        parent: null
      };
    });

    return {
      workItems,
      count: workItems.length,
      fields: ['all']
    };
  }
}

module.exports = AzureDevOpsService;