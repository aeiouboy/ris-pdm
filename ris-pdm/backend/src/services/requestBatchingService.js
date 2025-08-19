/**
 * Request Batching Service for Azure DevOps API Optimization
 * Implements intelligent batching to minimize API calls and improve performance
 */

const logger = require('../../utils/logger');
const cacheService = require('./cacheService');

class RequestBatchingService {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    this.pendingBatches = new Map();
    this.batchConfig = {
      maxBatchSize: 200,        // Azure DevOps API limit
      batchDelayMs: 50,         // Delay to collect requests
      maxWaitTime: 500,         // Maximum time to wait for batch
      enableIntelligentMerging: true
    };
    
    // Performance tracking
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      apiCallsSaved: 0,
      avgBatchSize: 0
    };
  }

  /**
   * Batch work item detail requests
   * @param {Array} workItemIds - Array of work item IDs
   * @param {Array} fields - Fields to retrieve
   * @returns {Promise<Array>} Work item details
   */
  async batchWorkItemDetails(workItemIds, fields = null) {
    if (!Array.isArray(workItemIds) || workItemIds.length === 0) {
      return [];
    }

    // For single items or small batches, use direct cache lookup first
    if (workItemIds.length === 1) {
      return this.getSingleWorkItem(workItemIds[0], fields);
    }

    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check cache for all items first
      const cachedResults = await this.checkCacheForWorkItems(workItemIds, fields);
      const uncachedIds = workItemIds.filter(id => !cachedResults.has(id));

      logger.debug(`Cache check: ${cachedResults.size}/${workItemIds.length} items found in cache`);

      // If all items are cached, return immediately
      if (uncachedIds.length === 0) {
        return this.combineWorkItemResults(workItemIds, cachedResults, new Map());
      }

      // Batch uncached requests efficiently
      const freshResults = await this.executeBatchedWorkItemRequests(uncachedIds, fields);

      // Combine cached and fresh results
      const combinedResults = this.combineWorkItemResults(workItemIds, cachedResults, freshResults);
      
      const duration = Date.now() - startTime;
      logger.debug(`Batched work item request completed: ${workItemIds.length} items in ${duration}ms`);
      
      // Update statistics
      if (uncachedIds.length < workItemIds.length) {
        this.stats.batchedRequests++;
        this.stats.apiCallsSaved += Math.ceil(cachedResults.size / this.batchConfig.maxBatchSize);
      }

      return combinedResults;
    } catch (error) {
      logger.error('Batch work item request failed:', error);
      throw error;
    }
  }

  /**
   * Get single work item with caching
   */
  async getSingleWorkItem(workItemId, fields) {
    const cacheKey = cacheService.generateKey('workItem', workItemId, { fields: fields?.join(',') || 'default' });
    
    let workItem = await cacheService.get(cacheKey);
    if (workItem) {
      return [workItem];
    }

    // Fetch single item
    const result = await this.azureService.getWorkItemDetails([workItemId], fields);
    if (result.workItems.length > 0) {
      workItem = result.workItems[0];
      // Cache individual work item
      await cacheService.set(cacheKey, workItem, { ttl: 900 }); // 15 minutes
      return [workItem];
    }

    return [];
  }

  /**
   * Check cache for multiple work items
   */
  async checkCacheForWorkItems(workItemIds, fields) {
    const cachedResults = new Map();
    const fieldsKey = fields?.join(',') || 'default';
    
    // Batch cache lookups for better performance
    const cacheKeys = workItemIds.map(id => ({
      id,
      key: cacheService.generateKey('workItem', id, { fields: fieldsKey })
    }));
    
    const batchCacheResults = await cacheService.getBatch(cacheKeys.map(item => item.key));
    
    cacheKeys.forEach(({ id, key }) => {
      const cachedItem = batchCacheResults[key];
      if (cachedItem) {
        cachedResults.set(parseInt(id), cachedItem);
      }
    });
    
    return cachedResults;
  }

  /**
   * Execute batched API requests for uncached work items
   */
  async executeBatchedWorkItemRequests(workItemIds, fields) {
    const results = new Map();
    const fieldsKey = fields?.join(',') || 'default';
    
    // Split into optimally sized batches
    const batches = this.createOptimalBatches(workItemIds);
    
    // Execute batches in parallel (but rate-limited)
    const batchPromises = batches.map(async (batch, index) => {
      // Add small delay between batches to respect rate limits
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, this.batchConfig.batchDelayMs * index));
      }
      
      try {
        const batchResult = await this.azureService.getWorkItemDetails(batch, fields);
        
        // Cache individual items from batch
        const cacheOperations = batchResult.workItems.map(item => ({
          key: cacheService.generateKey('workItem', item.id, { fields: fieldsKey }),
          data: item
        }));
        
        // Batch cache set operations
        await cacheService.setBatch(cacheOperations, { ttl: 900 });
        
        // Add to results map
        batchResult.workItems.forEach(item => {
          results.set(item.id, item);
        });
        
        return batch.length;
      } catch (error) {
        logger.error(`Batch request failed for batch ${index}:`, error);
        // Continue with other batches
        return 0;
      }
    });
    
    const batchSizes = await Promise.allSettled(batchPromises);
    const successfulItems = batchSizes
      .filter(result => result.status === 'fulfilled')
      .reduce((sum, result) => sum + result.value, 0);
    
    logger.debug(`Executed ${batches.length} batches, fetched ${successfulItems}/${workItemIds.length} items`);
    
    return results;
  }

  /**
   * Create optimal batches based on API limits and performance
   */
  createOptimalBatches(items) {
    const batches = [];
    const batchSize = Math.min(this.batchConfig.maxBatchSize, 100); // Conservative batch size
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Combine cached and fresh results in original order
   */
  combineWorkItemResults(requestedIds, cachedResults, freshResults) {
    const combinedResults = [];
    
    requestedIds.forEach(id => {
      const numericId = parseInt(id);
      const item = cachedResults.get(numericId) || freshResults.get(numericId);
      if (item) {
        combinedResults.push(item);
      }
    });
    
    return combinedResults;
  }

  /**
   * Batch team member queries with intelligent caching from all projects
   */
  async batchTeamMemberQueries(options = {}) {
    const cacheKey = cacheService.generateKey('teamMembers', 'list', options);
    
    // Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached team members list');
      return cached;
    }

    try {
      const { getAzureProjects } = require('../config/projectMapping');
      const shouldFetchAllProjects = process.env.AZURE_DEVOPS_FETCH_ALL_PROJECTS === 'true';
      const teamMemberMap = new Map();
      
      if (shouldFetchAllProjects) {
        logger.debug('🌐 Fetching team members from all Azure DevOps projects');
        const azureProjects = getAzureProjects();
        
        // Get work items from all projects
        for (const projectName of azureProjects) {
          try {
            const workItemsQuery = await this.azureService.getWorkItems({
              maxResults: 1000,
              workItemTypes: ['Task', 'Bug', 'User Story', 'Feature'],
              projectName: projectName
            });
            
            if (workItemsQuery.workItems?.length > 0) {
              logger.debug(`📊 Processing ${workItemsQuery.workItems.length} work items from project: ${projectName}`);
              
              // Batch process work item details for this project
              const workItemIds = workItemsQuery.workItems.map(wi => wi.id);
              const detailedWorkItems = await this.batchWorkItemDetails(workItemIds);
              
              // Process team members from this project
              detailedWorkItems.forEach(item => {
                if (item.assignee && item.assignee !== 'Unassigned' && item.assigneeEmail) {
                  const member = teamMemberMap.get(item.assigneeEmail) || {
                    name: item.assignee,
                    email: item.assigneeEmail,
                    avatar: item.assigneeImageUrl,
                    workItemCount: 0,
                    completedCount: 0,
                    storyPoints: 0,
                    workItemTypes: new Set(),
                    projects: new Set()
                  };
                  
                  member.workItemCount++;
                  member.workItemTypes.add(item.type);
                  member.projects.add(projectName);
                  
                  if (item.storyPoints) {
                    member.storyPoints += item.storyPoints;
                  }
                  
                  if (item.state === 'Done' || item.state === 'Closed') {
                    member.completedCount++;
                  }
                  
                  teamMemberMap.set(item.assigneeEmail, member);
                }
              });
            }
          } catch (projectError) {
            logger.warn(`⚠️ Failed to fetch team members from project ${projectName}:`, projectError.message);
          }
        }
        
        logger.debug(`🌐 Processed team members from ${azureProjects.length} projects`);
      } else {
        logger.debug('🔄 Fetching team members from default project only');
        
        // Original single-project logic
        const workItemsQuery = await this.azureService.getWorkItems({
          maxResults: 2000,
          workItemTypes: ['Task', 'Bug', 'User Story', 'Feature']
        });
        
        // Batch process work item details for better performance
        if (workItemsQuery.workItems && workItemsQuery.workItems.length > 0) {
          const workItemIds = workItemsQuery.workItems.map(wi => wi.id);
          const detailedWorkItems = await this.batchWorkItemDetails(workItemIds);
          
          detailedWorkItems.forEach(item => {
            if (item.assignee && item.assignee !== 'Unassigned' && item.assigneeEmail) {
              const member = teamMemberMap.get(item.assigneeEmail) || {
                name: item.assignee,
                email: item.assigneeEmail,
                avatar: item.assigneeImageUrl,
                workItemCount: 0,
                completedCount: 0,
                storyPoints: 0,
                workItemTypes: new Set()
              };
              
              member.workItemCount++;
              member.workItemTypes.add(item.type);
              
              if (item.storyPoints) {
                member.storyPoints += item.storyPoints;
              }
              
              if (item.state === 'Done' || item.state === 'Closed') {
                member.completedCount++;
              }
              
              teamMemberMap.set(item.assigneeEmail, member);
            }
          });
        }
      }

      // Convert to array and add productivity metrics
      const teamMembers = Array.from(teamMemberMap.values()).map(member => ({
        ...member,
        workItemTypes: Array.from(member.workItemTypes),
        projects: member.projects ? Array.from(member.projects) : [],
        completionRate: member.workItemCount > 0 
          ? Math.round((member.completedCount / member.workItemCount) * 100) 
          : 0,
        avgStoryPoints: member.workItemCount > 0 
          ? Math.round((member.storyPoints / member.workItemCount) * 10) / 10
          : 0
      }));

      // Sort by work item count for better UX
      teamMembers.sort((a, b) => b.workItemCount - a.workItemCount);

      const result = {
        members: teamMembers,
        count: teamMembers.length,
        totalWorkItems: Array.from(teamMemberMap.values()).reduce((sum, m) => sum + m.workItemCount, 0),
        timestamp: new Date().toISOString()
      };

      // Cache for 30 minutes
      await cacheService.set(cacheKey, result, { ttl: 1800 });
      
      return result;
    } catch (error) {
      logger.error('Error in batch team member query:', error);
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgBatchSize = this.stats.batchedRequests > 0 
      ? this.stats.totalRequests / this.stats.batchedRequests 
      : 0;
    
    return {
      ...this.stats,
      avgBatchSize: Math.round(avgBatchSize * 100) / 100,
      cacheHitRate: this.stats.apiCallsSaved > 0 
        ? Math.round((this.stats.apiCallsSaved / this.stats.totalRequests) * 100) 
        : 0,
      batchingEfficiency: this.stats.totalRequests > 0
        ? Math.round((this.stats.apiCallsSaved / this.stats.totalRequests) * 100)
        : 0
    };
  }

  /**
   * Warm up cache with commonly requested data from all Azure DevOps projects
   */
  async warmUpCache() {
    logger.info('🔥 Starting request batching cache warmup...');
    const startTime = Date.now();
    
    try {
      const { getAzureProjects } = require('../config/projectMapping');
      const shouldFetchAllProjects = process.env.AZURE_DEVOPS_FETCH_ALL_PROJECTS === 'true';
      
      if (shouldFetchAllProjects) {
        logger.info('🌐 Multi-project mode enabled - warming up cache for all Azure DevOps projects');
        const azureProjects = getAzureProjects();
        logger.info(`📋 Found ${azureProjects.length} unique Azure DevOps projects: ${azureProjects.join(', ')}`);
        
        // Warm up data from each Azure DevOps project
        for (const projectName of azureProjects) {
          logger.info(`🔄 Warming up cache for project: ${projectName}`);
          
          try {
            // Get work items from this specific project
            const projectWorkItems = await this.azureService.getWorkItems({
              maxResults: 200,
              states: ['Active', 'New', 'In Progress', 'Done', 'Closed'],
              projectName: projectName
            });
            
            if (projectWorkItems.workItems?.length > 0) {
              logger.info(`📊 Found ${projectWorkItems.workItems.length} work items in ${projectName}`);
              
              // Batch warm up work item details for this project
              const workItemIds = projectWorkItems.workItems.slice(0, 50).map(wi => wi.id);
              await this.batchWorkItemDetails(workItemIds);
              
              logger.info(`✅ Cache warmed for project: ${projectName} (${workItemIds.length} work items)`);
            } else {
              logger.info(`⚠️ No work items found in project: ${projectName}`);
            }
          } catch (projectError) {
            logger.warn(`⚠️ Cache warmup failed for project ${projectName}:`, projectError.message);
          }
        }
        
        logger.info('🌐 Multi-project cache warmup completed');
      } else {
        logger.info('🔄 Single-project mode - warming up cache for default project');
        
        // Original single-project warmup
        await this.batchTeamMemberQueries();
        
        const currentSprintItems = await this.azureService.getWorkItems({
          maxResults: 500,
          states: ['Active', 'New', 'In Progress', 'Done']
        });
        
        if (currentSprintItems.workItems?.length > 0) {
          const workItemIds = currentSprintItems.workItems.slice(0, 100).map(wi => wi.id);
          await this.batchWorkItemDetails(workItemIds);
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Request batching cache warmup completed (${duration}ms)`);
    } catch (error) {
      logger.warn('Cache warmup partially failed:', error.message);
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      batchedRequests: 0,
      apiCallsSaved: 0,
      avgBatchSize: 0
    };
  }
}

module.exports = RequestBatchingService;