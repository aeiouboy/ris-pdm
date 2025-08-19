/**
 * Project Mapping Configuration
 * Maps frontend project IDs to actual Azure DevOps projects
 */

const PROJECT_MAPPING = {
  // Map frontend projects to their actual Azure DevOps projects
  // ✅ Confirmed existing projects with data
  'Product - Data as a Service': 'Product - Data as a Service',
  'Product - Supplier Connect': 'Product - Supplier Connect', 
  'Product - CFG Workflow': 'Product - CFG Workflow',
  'Product - New OMS': 'Product - New OMS',
  'Team - Product Management': 'Product - Partner Management Platform',
  'Team - Engineering': 'Product - Partner Management Platform',
  'Team - QA Testing': 'Product - Partner Management Platform',
  'Team - DevOps': 'Product - Partner Management Platform'
  // ❌ Removed non-existent projects: Product - Order Management, Product - Inventory Management, Product - Analytics Platform
};

/**
 * Maps frontend project ID to actual Azure DevOps project name
 * @param {string} frontendProjectId - Frontend project identifier
 * @returns {string} Azure DevOps project name
 */
const mapFrontendProjectToAzure = (frontendProjectId) => {
  if (!frontendProjectId || frontendProjectId === 'all-projects') {
    return null;
  }
  
  const mappedProject = PROJECT_MAPPING[frontendProjectId];
  if (!mappedProject) {
    console.warn(`⚠️ No Azure DevOps mapping found for frontend project: ${frontendProjectId}`);
    return frontendProjectId; // Fallback to original name
  }
  
  return mappedProject;
};

/**
 * Gets all available frontend project IDs
 * @returns {string[]} Array of frontend project IDs
 */
const getFrontendProjects = () => {
  return Object.keys(PROJECT_MAPPING);
};

/**
 * Gets all unique Azure DevOps projects
 * @returns {string[]} Array of unique Azure DevOps project names
 */
const getAzureProjects = () => {
  return [...new Set(Object.values(PROJECT_MAPPING))];
};

module.exports = {
  PROJECT_MAPPING,
  mapFrontendProjectToAzure,
  getFrontendProjects,
  getAzureProjects
};