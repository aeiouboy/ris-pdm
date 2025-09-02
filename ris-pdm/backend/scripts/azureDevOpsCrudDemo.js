#!/usr/bin/env node

/**
 * Azure DevOps CRUD Operations Demo
 * 
 * This script demonstrates Create, Update, and Delete operations
 * on Azure DevOps work items as specified in the PoC requirements.
 * 
 * Note: This extends the existing AzureDevOpsService with additional
 * CRUD methods to complete the PoC demonstration.
 * 
 * Usage: node backend/scripts/azureDevOpsCrudDemo.js [--dry-run] [--verbose]
 */

require('dotenv').config();
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const logger = require('../utils/logger');
const { performance } = require('perf_hooks');

/**
 * Extended Azure DevOps Service with CRUD Operations
 * This adds Create, Update, Delete capabilities to the existing service
 */
class AzureDevOpsCrudService extends AzureDevOpsService {
  constructor(config = {}) {
    super(config);
  }

  /**
   * Create a new work item
   * @param {string} workItemType - Type of work item (Bug, Task, User Story, etc.)
   * @param {object} fields - Work item fields
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Created work item
   */
  async createWorkItem(workItemType, fields, projectName = null) {
    const project = projectName || this.project;
    const startTime = performance.now();

    try {
      // Prepare the JSON Patch document for work item creation
      const patchDocument = [];

      // Add required fields
      if (fields.title) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.Title',
          value: fields.title
        });
      }

      if (fields.description) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.Description',
          value: fields.description
        });
      }

      // Add optional fields
      if (fields.assignedTo) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: fields.assignedTo
        });
      }

      if (fields.storyPoints) {
        patchDocument.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
          value: fields.storyPoints
        });
      }

      if (fields.priority) {
        patchDocument.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Common.Priority',
          value: fields.priority
        });
      }

      if (fields.tags) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.Tags',
          value: Array.isArray(fields.tags) ? fields.tags.join(';') : fields.tags
        });
      }

      if (fields.areaPath) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.AreaPath',
          value: fields.areaPath
        });
      }

      if (fields.iterationPath) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.IterationPath',
          value: fields.iterationPath
        });
      }

      // Add custom fields (like Bug types)
      if (fields.bugType) {
        // Try common bug type field names
        const bugTypeFields = ['Bug types', 'Custom.BugType', 'Custom.Bug_Type'];
        patchDocument.push({
          op: 'add',
          path: `/fields/${bugTypeFields[0]}`, // Use first field name
          value: fields.bugType
        });
      }

      // Add any additional custom fields
      if (fields.customFields) {
        Object.keys(fields.customFields).forEach(fieldName => {
          patchDocument.push({
            op: 'add',
            path: `/fields/${fieldName}`,
            value: fields.customFields[fieldName]
          });
        });
      }

      const endpoint = `/${encodeURIComponent(project)}/_apis/wit/workitems/$${workItemType}?api-version=${this.apiVersion}`;
      
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-patch+json'
        },
        body: patchDocument
      });

      const duration = performance.now() - startTime;
      logger.info(`Created work item ${response.id} in ${duration.toFixed(2)}ms`);

      // Transform to standard format
      return this.transformWorkItem(response, project);

    } catch (error) {
      logger.error(`Failed to create work item: ${error.message}`);
      throw new Error(`Failed to create work item: ${error.message}`);
    }
  }

  /**
   * Update an existing work item
   * @param {number} workItemId - Work item ID to update
   * @param {object} updates - Fields to update
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Updated work item
   */
  async updateWorkItem(workItemId, updates, projectName = null) {
    const project = projectName || this.project;
    const startTime = performance.now();

    try {
      // Prepare the JSON Patch document for work item updates
      const patchDocument = [];

      // Update supported fields
      if (updates.title !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.Title',
          value: updates.title
        });
      }

      if (updates.description !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.Description',
          value: updates.description
        });
      }

      if (updates.state !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.State',
          value: updates.state
        });
      }

      if (updates.assignedTo !== undefined) {
        if (updates.assignedTo === null || updates.assignedTo === '') {
          // Remove assignment
          patchDocument.push({
            op: 'remove',
            path: '/fields/System.AssignedTo'
          });
        } else {
          patchDocument.push({
            op: 'replace',
            path: '/fields/System.AssignedTo',
            value: updates.assignedTo
          });
        }
      }

      if (updates.storyPoints !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
          value: updates.storyPoints
        });
      }

      if (updates.priority !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/Microsoft.VSTS.Common.Priority',
          value: updates.priority
        });
      }

      if (updates.tags !== undefined) {
        const tagValue = Array.isArray(updates.tags) ? updates.tags.join(';') : updates.tags;
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.Tags',
          value: tagValue
        });
      }

      if (updates.areaPath !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.AreaPath',
          value: updates.areaPath
        });
      }

      if (updates.iterationPath !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/System.IterationPath',
          value: updates.iterationPath
        });
      }

      if (updates.bugType !== undefined) {
        patchDocument.push({
          op: 'replace',
          path: '/fields/Bug types',
          value: updates.bugType
        });
      }

      // Add any custom field updates
      if (updates.customFields) {
        Object.keys(updates.customFields).forEach(fieldName => {
          patchDocument.push({
            op: 'replace',
            path: `/fields/${fieldName}`,
            value: updates.customFields[fieldName]
          });
        });
      }

      if (patchDocument.length === 0) {
        throw new Error('No valid fields provided for update');
      }

      const endpoint = `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=${this.apiVersion}`;
      
      const response = await this.makeRequest(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json'
        },
        body: patchDocument
      });

      const duration = performance.now() - startTime;
      logger.info(`Updated work item ${workItemId} in ${duration.toFixed(2)}ms`);

      // Transform to standard format
      return this.transformWorkItem(response, project);

    } catch (error) {
      logger.error(`Failed to update work item ${workItemId}: ${error.message}`);
      throw new Error(`Failed to update work item ${workItemId}: ${error.message}`);
    }
  }

  /**
   * Delete a work item (move to Removed state)
   * @param {number} workItemId - Work item ID to delete
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Result of deletion operation
   */
  async deleteWorkItem(workItemId, projectName = null) {
    const project = projectName || this.project;
    const startTime = performance.now();

    try {
      // Azure DevOps doesn't permanently delete work items
      // Instead, we move them to "Removed" state
      const endpoint = `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=${this.apiVersion}`;
      
      const response = await this.makeRequest(endpoint, {
        method: 'DELETE'
      });

      const duration = performance.now() - startTime;
      logger.info(`Deleted (removed) work item ${workItemId} in ${duration.toFixed(2)}ms`);

      return {
        id: workItemId,
        deleted: true,
        message: 'Work item moved to Removed state',
        deletedDate: new Date().toISOString(),
        duration: Math.round(duration)
      };

    } catch (error) {
      logger.error(`Failed to delete work item ${workItemId}: ${error.message}`);
      throw new Error(`Failed to delete work item ${workItemId}: ${error.message}`);
    }
  }

  /**
   * Add a comment to a work item
   * @param {number} workItemId - Work item ID
   * @param {string} comment - Comment text
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Comment creation result
   */
  async addWorkItemComment(workItemId, comment, projectName = null) {
    const project = projectName || this.project;
    const startTime = performance.now();

    try {
      const endpoint = `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}/comments?api-version=${this.apiVersion}`;
      
      const requestBody = {
        text: comment
      };

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: requestBody
      });

      const duration = performance.now() - startTime;
      logger.info(`Added comment to work item ${workItemId} in ${duration.toFixed(2)}ms`);

      return {
        commentId: response.id,
        workItemId: workItemId,
        text: response.text,
        createdBy: response.createdBy,
        createdDate: response.createdDate,
        duration: Math.round(duration)
      };

    } catch (error) {
      logger.error(`Failed to add comment to work item ${workItemId}: ${error.message}`);
      throw new Error(`Failed to add comment to work item ${workItemId}: ${error.message}`);
    }
  }

  /**
   * Update work item relationships (parent/child, related, etc.)
   * @param {number} workItemId - Work item ID
   * @param {Array} relationships - Array of relationship operations
   * @param {string} projectName - Optional project name
   * @returns {Promise<object>} Updated work item with relationships
   */
  async updateWorkItemRelationships(workItemId, relationships, projectName = null) {
    const project = projectName || this.project;
    const startTime = performance.now();

    try {
      const patchDocument = relationships.map(rel => ({
        op: rel.operation || 'add', // add, remove, replace
        path: '/relations/-',
        value: {
          rel: rel.type || 'System.LinkTypes.Hierarchy-Forward', // Parent-Child relationship
          url: rel.url || `${this.baseUrl}/${encodeURIComponent(project)}/_apis/wit/workItems/${rel.targetId}`,
          attributes: rel.attributes || {}
        }
      }));

      const endpoint = `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=${this.apiVersion}`;
      
      const response = await this.makeRequest(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json'
        },
        body: patchDocument
      });

      const duration = performance.now() - startTime;
      logger.info(`Updated relationships for work item ${workItemId} in ${duration.toFixed(2)}ms`);

      return this.transformWorkItem(response, project);

    } catch (error) {
      logger.error(`Failed to update relationships for work item ${workItemId}: ${error.message}`);
      throw new Error(`Failed to update relationships for work item ${workItemId}: ${error.message}`);
    }
  }
}

/**
 * CRUD Operations Demo Class
 */
class AzureDevOpsCrudDemo {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      ...options
    };

    this.service = new AzureDevOpsCrudService();
    this.createdWorkItems = []; // Track items created during demo
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = this.options.dryRun ? '[DRY-RUN] ' : '';
    console.log(`[${timestamp}] ${prefix}${message}`);
    
    if (logger && typeof logger[level] === 'function') {
      logger[level](`${prefix}${message}`);
    }
  }

  /**
   * Demonstrate work item creation
   */
  async demonstrateCreate() {
    this.log('\n🆕 Demonstrating Work Item Creation...');

    if (this.options.dryRun) {
      this.log('DRY-RUN: Would create work items with specified fields');
      return [];
    }

    const workItemsToCreate = [
      {
        type: 'Task',
        fields: {
          title: 'PoC Demo Task - Performance Optimization',
          description: 'Task created during Azure DevOps API PoC demonstration for performance testing',
          assignedTo: 'demo@example.com', // Use actual email from your organization
          storyPoints: 5,
          priority: 2,
          tags: ['poc', 'demo', 'performance'],
          bugType: null // Not applicable for tasks
        }
      },
      {
        type: 'Bug',
        fields: {
          title: 'PoC Demo Bug - API Integration Issue',
          description: 'Bug created during Azure DevOps API PoC demonstration for CRUD testing',
          assignedTo: 'demo@example.com',
          priority: 3,
          tags: ['poc', 'demo', 'api'],
          bugType: 'Functional'
        }
      },
      {
        type: 'User Story',
        fields: {
          title: 'PoC Demo User Story - Dashboard Enhancement',
          description: 'User story created during Azure DevOps API PoC demonstration',
          storyPoints: 8,
          priority: 2,
          tags: ['poc', 'demo', 'dashboard']
        }
      }
    ];

    const createdItems = [];

    for (const itemSpec of workItemsToCreate) {
      try {
        this.log(`Creating ${itemSpec.type}: "${itemSpec.fields.title}"`);
        
        const createdItem = await this.service.createWorkItem(
          itemSpec.type,
          itemSpec.fields
        );

        createdItems.push(createdItem);
        this.createdWorkItems.push(createdItem.id);
        
        this.log(`✅ Created ${itemSpec.type} #${createdItem.id}`);
        this.log(`   Title: ${createdItem.title}`);
        this.log(`   State: ${createdItem.state}`);
        this.log(`   URL: ${createdItem.url}`);

      } catch (error) {
        this.log(`❌ Failed to create ${itemSpec.type}: ${error.message}`, 'error');
      }
    }

    this.log(`\n📋 Created ${createdItems.length} work items successfully`);
    return createdItems;
  }

  /**
   * Demonstrate work item updates
   */
  async demonstrateUpdate(workItemsToUpdate) {
    this.log('\n✏️  Demonstrating Work Item Updates...');

    if (this.options.dryRun) {
      this.log('DRY-RUN: Would update work items with new field values');
      return [];
    }

    if (!workItemsToUpdate || workItemsToUpdate.length === 0) {
      this.log('⚠️  No work items available for update demonstration');
      return [];
    }

    const updateOperations = [
      {
        workItem: workItemsToUpdate[0],
        updates: {
          state: 'Active',
          description: 'Updated during PoC demo - moved to Active state',
          tags: ['poc', 'demo', 'updated', 'active'],
          priority: 1
        },
        description: 'Update state and priority'
      },
      {
        workItem: workItemsToUpdate[1],
        updates: {
          assignedTo: '', // Unassign
          storyPoints: 3,
          customFields: {
            'System.Reason': 'Updated during demo'
          }
        },
        description: 'Unassign and update story points'
      }
    ];

    const updatedItems = [];

    for (const operation of updateOperations) {
      try {
        this.log(`Updating work item #${operation.workItem.id}: ${operation.description}`);
        
        const updatedItem = await this.service.updateWorkItem(
          operation.workItem.id,
          operation.updates
        );

        updatedItems.push(updatedItem);
        
        this.log(`✅ Updated work item #${updatedItem.id}`);
        this.log(`   State: ${updatedItem.state}`);
        this.log(`   Assignee: ${updatedItem.assignee}`);
        this.log(`   Priority: ${updatedItem.priority}`);

      } catch (error) {
        this.log(`❌ Failed to update work item #${operation.workItem.id}: ${error.message}`, 'error');
      }
    }

    this.log(`\n📝 Updated ${updatedItems.length} work items successfully`);
    return updatedItems;
  }

  /**
   * Demonstrate work item comments
   */
  async demonstrateComments(workItems) {
    this.log('\n💬 Demonstrating Work Item Comments...');

    if (this.options.dryRun) {
      this.log('DRY-RUN: Would add comments to work items');
      return [];
    }

    if (!workItems || workItems.length === 0) {
      this.log('⚠️  No work items available for comment demonstration');
      return [];
    }

    const comments = [
      'Comment added during Azure DevOps API PoC demonstration',
      'Testing comment functionality - this is an automated test comment',
      'PoC validation complete for work item commenting'
    ];

    const addedComments = [];

    for (let i = 0; i < Math.min(workItems.length, comments.length); i++) {
      try {
        const workItem = workItems[i];
        const comment = comments[i];
        
        this.log(`Adding comment to work item #${workItem.id}`);
        
        const commentResult = await this.service.addWorkItemComment(
          workItem.id,
          comment
        );

        addedComments.push(commentResult);
        
        this.log(`✅ Added comment to work item #${workItem.id}`);
        this.log(`   Comment ID: ${commentResult.commentId}`);

      } catch (error) {
        this.log(`❌ Failed to add comment to work item #${workItems[i].id}: ${error.message}`, 'error');
      }
    }

    this.log(`\n💬 Added ${addedComments.length} comments successfully`);
    return addedComments;
  }

  /**
   * Demonstrate work item deletion
   */
  async demonstrateDelete(workItemsToDelete) {
    this.log('\n🗑️  Demonstrating Work Item Deletion...');

    if (this.options.dryRun) {
      this.log('DRY-RUN: Would delete (move to Removed state) specified work items');
      return [];
    }

    if (!workItemsToDelete || workItemsToDelete.length === 0) {
      this.log('⚠️  No work items available for deletion demonstration');
      return [];
    }

    const deletionResults = [];

    // Only delete items we created during this demo
    const itemsToDelete = workItemsToDelete.filter(item => 
      this.createdWorkItems.includes(item.id)
    );

    if (itemsToDelete.length === 0) {
      this.log('ℹ️  Skipping deletion - only demo-created items would be deleted');
      return [];
    }

    for (const workItem of itemsToDelete) {
      try {
        this.log(`Deleting work item #${workItem.id}: "${workItem.title}"`);
        
        const deletionResult = await this.service.deleteWorkItem(workItem.id);
        deletionResults.push(deletionResult);
        
        this.log(`✅ Deleted work item #${workItem.id}`);
        this.log(`   Status: ${deletionResult.message}`);

      } catch (error) {
        this.log(`❌ Failed to delete work item #${workItem.id}: ${error.message}`, 'error');
      }
    }

    this.log(`\n🗑️  Deleted ${deletionResults.length} work items successfully`);
    return deletionResults;
  }

  /**
   * Run the complete CRUD demonstration
   */
  async runCrudDemo() {
    this.log('🚀 Starting Azure DevOps CRUD Operations Demonstration...');
    this.log(`Mode: ${this.options.dryRun ? 'DRY-RUN' : 'LIVE'}`);
    this.log(`Started at: ${new Date().toISOString()}`);

    const results = {
      created: [],
      updated: [],
      comments: [],
      deleted: [],
      totalOperations: 0,
      successfulOperations: 0,
      duration: 0
    };

    const startTime = performance.now();

    try {
      // 1. Create demonstration
      this.log('\n📋 Phase 1: CREATE Operations');
      results.created = await this.demonstrateCreate();
      results.totalOperations += 3; // Attempted to create 3 items
      results.successfulOperations += results.created.length;

      // 2. Update demonstration  
      this.log('\n📋 Phase 2: UPDATE Operations');
      results.updated = await this.demonstrateUpdate(results.created);
      results.totalOperations += Math.min(results.created.length, 2);
      results.successfulOperations += results.updated.length;

      // 3. Comments demonstration
      this.log('\n📋 Phase 3: COMMENT Operations');
      results.comments = await this.demonstrateComments(results.created);
      results.totalOperations += Math.min(results.created.length, 3);
      results.successfulOperations += results.comments.length;

      // 4. Delete demonstration (only items created in this demo)
      this.log('\n📋 Phase 4: DELETE Operations');
      results.deleted = await this.demonstrateDelete(results.created);
      results.totalOperations += results.created.length;
      results.successfulOperations += results.deleted.length;

      results.duration = performance.now() - startTime;

      // Generate summary report
      this.generateSummaryReport(results);

      return results;

    } catch (error) {
      this.log(`❌ CRUD Demo failed with error: ${error.message}`, 'error');
      results.duration = performance.now() - startTime;
      return results;
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(results) {
    this.log('\n📊 ===============================');
    this.log('📊 CRUD OPERATIONS DEMO SUMMARY');
    this.log('📊 ===============================');

    this.log(`\n🎯 Operations Summary:`);
    this.log(`   Created Work Items: ${results.created.length}`);
    this.log(`   Updated Work Items: ${results.updated.length}`);
    this.log(`   Added Comments: ${results.comments.length}`);
    this.log(`   Deleted Work Items: ${results.deleted.length}`);
    
    this.log(`\n⚡ Performance Metrics:`);
    this.log(`   Total Operations: ${results.totalOperations}`);
    this.log(`   Successful Operations: ${results.successfulOperations}`);
    this.log(`   Success Rate: ${((results.successfulOperations / results.totalOperations) * 100).toFixed(1)}%`);
    this.log(`   Total Duration: ${(results.duration / 1000).toFixed(2)}s`);
    this.log(`   Average Operation Time: ${(results.duration / results.totalOperations).toFixed(0)}ms`);

    // Show created work items details
    if (results.created.length > 0 && !this.options.dryRun) {
      this.log(`\n📋 Created Work Items (IDs for reference):`);
      results.created.forEach(item => {
        this.log(`   - ${item.type} #${item.id}: "${item.title}"`);
      });
    }

    const overallSuccess = results.successfulOperations >= (results.totalOperations * 0.8);
    this.log(`\n🏆 Overall CRUD Demo Status: ${overallSuccess ? '✅ SUCCESS' : '❌ PARTIAL SUCCESS'}`);

    if (!this.options.dryRun && results.created.length > 0) {
      this.log(`\n💡 Note: Demo work items have been created in your Azure DevOps project.`);
      this.log(`   You may want to review and clean up these items if needed.`);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('🔧 Azure DevOps CRUD Operations Demo');
  console.log('====================================');
  
  if (dryRun) {
    console.log('⚠️  Running in DRY-RUN mode - no actual changes will be made');
  } else {
    console.log('⚠️  Running in LIVE mode - actual work items will be created/modified');
    console.log('   Use --dry-run flag to test without making changes');
  }

  const demo = new AzureDevOpsCrudDemo({ dryRun, verbose });
  
  demo.runCrudDemo()
    .then(results => {
      const success = results.successfulOperations >= (results.totalOperations * 0.8);
      console.log(`\n🎉 CRUD Demo completed!`);
      console.log(`Final Status: ${success ? 'SUCCESS ✅' : 'PARTIAL SUCCESS ⚠️'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ CRUD Demo failed to start:', error.message);
      process.exit(1);
    });
}

module.exports = { AzureDevOpsCrudService, AzureDevOpsCrudDemo };