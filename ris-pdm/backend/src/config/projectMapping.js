/**
 * Project Mapping Configuration
 * Maps frontend project IDs to actual Azure DevOps projects
 * Currently configured to show only PMP and DaaS projects
 */

// Project enablement configuration - controls which projects are shown in the dashboard
const PROJECT_CONFIG = {
  // ✅ ENABLED PROJECTS - Only PMP and DaaS as requested
  'Product - Data as a Service': { enabled: true, priority: 1 },
  'Product - Partner Management Platform': { enabled: true, priority: 2 },
  'Team - Product Management': { enabled: true, priority: 3 },
  'Team - Engineering': { enabled: true, priority: 4 },
  'Team - QA Testing': { enabled: true, priority: 5 },
  'Team - DevOps': { enabled: true, priority: 6 },
  
  // ❌ DISABLED PROJECTS - Hidden from dashboard as requested
  'Product - Supplier Connect': { enabled: false, priority: 999 },
  'Product - CFG Workflow': { enabled: false, priority: 999 },
  'Product - New OMS': { enabled: false, priority: 999 }
};

// Azure DevOps Project → Team mapping - CRITICAL: Team names must match Azure DevOps exactly
// Based on actual teams from Azure DevOps screenshot
const TEAM_MAPPING = {
  // ✅ ENABLED PROJECTS - Using EXACT team names from Azure DevOps
  'Product - Data as a Service': 'Product - Data as a Service Team', // Will be created if needed
  'Product - Partner Management Platform': 'PMP Developer Team', // 🎯 CONFIRMED: Exact team name from screenshot
  'Team - Product Management': 'PMP Developer Team', // Map to PMP Developer Team
  'Team - Engineering': 'PMP Developer Team', // Map to PMP Developer Team  
  'Team - QA Testing': 'PMP QA Team', // 🎯 CONFIRMED: Exact team name from screenshot
  'Team - DevOps': 'PMP Developer Team', // Map to PMP Developer Team
  
  // ❌ DISABLED PROJECTS - Commented out to hide from dashboard
  // 'Product - Supplier Connect': 'Product - Supplier Connect', 
  // 'Product - CFG Workflow': 'Product - CFG Workflow',
  // 'Product - New OMS': 'Product - New OMS'
};

const PROJECT_MAPPING = {
  // ✅ ENABLED PROJECTS - PMP and DaaS only
  'Product - Data as a Service': 'Product - Data as a Service',
  'Product - Partner Management Platform': 'Product - Partner Management Platform',
  'Team - Product Management': 'Product - Partner Management Platform',
  'Team - Engineering': 'Product - Partner Management Platform',
  'Team - QA Testing': 'Product - Partner Management Platform',
  'Team - DevOps': 'Product - Partner Management Platform',
  
  // ❌ DISABLED PROJECTS - Commented out to hide from dashboard
  // 'Product - Supplier Connect': 'Product - Supplier Connect', 
  // 'Product - CFG Workflow': 'Product - CFG Workflow',
  // 'Product - New OMS': 'Product - New OMS'
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
 * Maps frontend project ID to actual Azure DevOps team name
 * @param {string} frontendProjectId - Frontend project identifier
 * @returns {string} Azure DevOps team name
 */
const mapFrontendProjectToTeam = (frontendProjectId) => {
  if (!frontendProjectId || frontendProjectId === 'all-projects') {
    return null;
  }
  
  const mappedTeam = TEAM_MAPPING[frontendProjectId];
  if (!mappedTeam) {
    console.warn(`⚠️ No Azure DevOps team mapping found for frontend project: ${frontendProjectId}`);
    // Fallback to project mapping for backward compatibility
    return mapFrontendProjectToAzure(frontendProjectId);
  }
  
  return mappedTeam;
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

/**
 * Check if a project is enabled in the dashboard
 * @param {string} projectId - Project identifier
 * @returns {boolean} True if project is enabled
 */
const isProjectEnabled = (projectId) => {
  // First check if it exists in PROJECT_CONFIG
  if (PROJECT_CONFIG[projectId]) {
    return PROJECT_CONFIG[projectId].enabled;
  }
  
  // Fallback: if it's in PROJECT_MAPPING, it's enabled
  return PROJECT_MAPPING.hasOwnProperty(projectId);
};

/**
 * Get project configuration
 * @param {string} projectId - Project identifier
 * @returns {object|null} Project configuration or null if not found
 */
const getProjectConfig = (projectId) => {
  return PROJECT_CONFIG[projectId] || null;
};

/**
 * Get all enabled frontend projects sorted by priority
 * @returns {string[]} Array of enabled frontend project IDs
 */
const getEnabledProjects = () => {
  return Object.keys(PROJECT_CONFIG)
    .filter(projectId => PROJECT_CONFIG[projectId].enabled)
    .sort((a, b) => PROJECT_CONFIG[a].priority - PROJECT_CONFIG[b].priority);
};

/**
 * Get project statistics
 * @returns {object} Statistics about project configuration
 */
const getProjectStats = () => {
  const enabled = Object.values(PROJECT_CONFIG).filter(config => config.enabled).length;
  const disabled = Object.values(PROJECT_CONFIG).filter(config => !config.enabled).length;
  
  return {
    total: Object.keys(PROJECT_CONFIG).length,
    enabled,
    disabled,
    enabledProjects: getEnabledProjects()
  };
};

module.exports = {
  PROJECT_MAPPING,
  PROJECT_CONFIG,
  TEAM_MAPPING,
  mapFrontendProjectToAzure,
  mapFrontendProjectToTeam,
  getFrontendProjects,
  getAzureProjects,
  isProjectEnabled,
  getProjectConfig,
  getEnabledProjects,
  getProjectStats
};