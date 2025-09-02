#!/usr/bin/env node

/**
 * Simple CRUD Operations Test Script
 * Tests the newly implemented CRUD operations with your real Azure DevOps environment
 * Use with caution - this will create actual work items in your project
 */

require('dotenv').config();
const AzureDevOpsService = require('../src/services/azureDevOpsService');

async function testCrudOperations() {
  console.log('🧪 Testing CRUD Operations with Real Azure DevOps API');
  console.log('⚠️  This will create and modify actual work items in your project');
  console.log('====================================================================');

  try {
    const service = new AzureDevOpsService();
    let createdWorkItemId = null;

    // Test 1: Create Work Item
    console.log('\n1️⃣  Testing CREATE operation...');
    const createFields = {
      title: 'CRUD Test - Delete Me',
      description: 'This is a test work item created by the CRUD operations test. Please delete.',
      assignedTo: 'tachongrak@central.co.th', // Use your email
      storyPoints: 1,
      priority: 4,
      tags: ['test', 'crud', 'delete-me']
    };

    const createdItem = await service.createWorkItem('Task', createFields);
    createdWorkItemId = createdItem.id;
    
    console.log(`✅ Created work item #${createdItem.id}`);
    console.log(`   Title: ${createdItem.title}`);
    console.log(`   Type: ${createdItem.type}`);
    console.log(`   State: ${createdItem.state}`);
    console.log(`   URL: ${createdItem.url}`);

    // Test 2: Update Work Item
    console.log('\n2️⃣  Testing UPDATE operation...');
    const updateFields = {
      title: 'CRUD Test - UPDATED - Delete Me',
      description: 'This work item has been updated by the CRUD test.',
      state: 'Active',
      storyPoints: 2,
      tags: ['test', 'crud', 'updated', 'delete-me']
    };

    const updatedItem = await service.updateWorkItem(createdWorkItemId, updateFields);
    
    console.log(`✅ Updated work item #${updatedItem.id}`);
    console.log(`   Title: ${updatedItem.title}`);
    console.log(`   State: ${updatedItem.state}`);
    console.log(`   Story Points: ${updatedItem.storyPoints}`);

    // Test 3: Add Comment
    console.log('\n3️⃣  Testing COMMENT operation...');
    const comment = 'This comment was added by the CRUD operations test script. The work item can be safely deleted.';
    
    const commentResult = await service.addWorkItemComment(createdWorkItemId, comment);
    
    console.log(`✅ Added comment to work item #${createdWorkItemId}`);
    console.log(`   Comment ID: ${commentResult.commentId}`);
    console.log(`   Comment: ${commentResult.text}`);

    // Test 4: Read/Retrieve Work Item (using existing method)
    console.log('\n4️⃣  Testing READ operation...');
    const retrievedItems = await service.getWorkItemDetails([createdWorkItemId]);
    
    if (retrievedItems.workItems.length > 0) {
      const retrieved = retrievedItems.workItems[0];
      console.log(`✅ Retrieved work item #${retrieved.id}`);
      console.log(`   Title: ${retrieved.title}`);
      console.log(`   State: ${retrieved.state}`);
      console.log(`   Last Changed: ${retrieved.changedDate}`);
    }

    // Test 5: Delete Work Item (move to Removed state)
    console.log('\n5️⃣  Testing DELETE operation...');
    const deleteResult = await service.deleteWorkItem(createdWorkItemId);
    
    console.log(`✅ Deleted work item #${createdWorkItemId}`);
    console.log(`   Status: ${deleteResult.message}`);
    console.log(`   Deleted Date: ${deleteResult.deletedDate}`);

    // Summary
    console.log('\n🎉 CRUD Operations Test Complete!');
    console.log('====================================');
    console.log('✅ CREATE: Successfully created work item');
    console.log('✅ READ: Successfully retrieved work item details');
    console.log('✅ UPDATE: Successfully updated work item fields');
    console.log('✅ DELETE: Successfully deleted work item (moved to Removed)');
    console.log('✅ COMMENT: Successfully added comment to work item');
    
    console.log('\n📊 Summary:');
    console.log(`   Work Item Created: #${createdWorkItemId}`);
    console.log(`   Final State: Removed (deleted)`);
    console.log('   All CRUD operations working correctly!');

  } catch (error) {
    console.error('\n❌ CRUD Operations Test Failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n🔍 Possible Issues:');
    console.error('   - Check Azure DevOps credentials in .env file');
    console.error('   - Verify project permissions for work item creation');
    console.error('   - Ensure network connectivity to Azure DevOps');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting CRUD Operations Test...');
  testCrudOperations()
    .then(() => {
      console.log('\n✨ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testCrudOperations };