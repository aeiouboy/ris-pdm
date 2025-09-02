/**
 * Project Resolution Service
 * Handles project ID resolution between frontend project names and Azure DevOps project GUIDs
 * Implements caching and validation for improved performance
 */

const { mapFrontendProjectToAzure, isProjectEnabled } = require('../config/projectMapping');
const logger = require('../../utils/logger');

class ProjectResolutionService {
  constructor(azureService) {
    this.azureService = azureService;
    this.projectCache = new Map();
    this.guidCache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Check if a string is a valid GUID format
   * @param {string} str - String to check
   * @returns {boolean} True if string is GUID format
   */
  isGuid(str) {
    if (!str || typeof str !== 'string') {
      return false;
    }
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return guidRegex.test(str);
  }

  /**
   * Resolve project identifier to Azure DevOps project GUID
   * Handles both project names and existing GUIDs
   * @param {string} projectIdentifier - Frontend project name or GUID
   * @returns {Promise<string>} Azure DevOps project GUID
   */
  async resolveProjectId(projectIdentifier) {
    if (!projectIdentifier) {
      throw new Error('Project identifier is required');
    }

    // If already a GUID, validate and return
    if (this.isGuid(projectIdentifier)) {
      await this.validateProjectGuid(projectIdentifier);
      return projectIdentifier;
    }

    // Check if project is enabled in our mapping
    if (!isProjectEnabled(projectIdentifier)) {
      logger.warn(`Project ${projectIdentifier} is not enabled or mapped`);
      throw new Error(`Project not available: ${projectIdentifier}`);
    }

    // Check cache first
    const cached = this.getFromCache(projectIdentifier);
    if (cached) {
      logger.debug(`Returning cached project GUID for ${projectIdentifier}`);
      return cached;
    }

    try {
      // Map frontend project to Azure DevOps project name
      const azureProjectName = mapFrontendProjectToAzure(projectIdentifier);
      if (!azureProjectName) {
        throw new Error(`No Azure DevOps mapping found for project: ${projectIdentifier}`);
      }

      // Get all projects from Azure DevOps
      const projectsResponse = await this.azureService.getProjects();
      const projects = projectsResponse.projects || [];

      // Find the project by name
      const project = projects.find(p => 
        p.name === azureProjectName || 
        p.name.toLowerCase() === azureProjectName.toLowerCase()
      );

      if (!project) {
        logger.error(`Azure DevOps project not found: ${azureProjectName}`, {
          availableProjects: projects.map(p => p.name),
          searchedFor: azureProjectName,
          originalIdentifier: projectIdentifier
        });
        throw new Error(`Azure DevOps project not found: ${azureProjectName}`);
      }

      // Cache the result
      this.setCache(projectIdentifier, project.id);
      this.setCacheByGuid(project.id, {
        name: project.name,
        frontendId: projectIdentifier
      });

      logger.info(`Resolved project ${projectIdentifier} -> ${project.name} (${project.id})`);
      return project.id;

    } catch (error) {
      logger.error(`Failed to resolve project ${projectIdentifier}:`, error.message);
      throw new Error(`Failed to resolve project ${projectIdentifier}: ${error.message}`);
    }
  }

  /**
   * Resolve project identifier to Azure DevOps project name
   * Handles both project names and GUIDs
   * @param {string} projectIdentifier - Frontend project name or GUID
   * @returns {Promise<string>} Azure DevOps project name
   */
  async resolveProjectName(projectIdentifier) {
    if (!projectIdentifier) {
      throw new Error('Project identifier is required');
    }

    // If it's already a GUID, resolve it to project info and return name
    if (this.isGuid(projectIdentifier)) {
      const projectInfo = await this.resolveProjectInfo(projectIdentifier);
      return projectInfo.name;
    }

    // Check if project is enabled in our mapping
    if (!isProjectEnabled(projectIdentifier)) {
      // If not in mapping but looks like a project name, return as-is
      // This handles cases where the project name is passed directly
      logger.warn(`Project ${projectIdentifier} is not in mapping, returning as-is`);
      return projectIdentifier;
    }

    try {
      // Map frontend project to Azure DevOps project name
      const azureProjectName = mapFrontendProjectToAzure(projectIdentifier);
      if (!azureProjectName) {
        // If no mapping found, return the original identifier as project name
        logger.warn(`No Azure DevOps mapping found for project: ${projectIdentifier}, using as-is`);
        return projectIdentifier;
      }

      return azureProjectName;
    } catch (error) {
      logger.warn(`Failed to resolve project name for ${projectIdentifier}, using as-is:`, error.message);
      return projectIdentifier;
    }
  }

  /**
   * Resolve project GUID back to project information
   * @param {string} projectGuid - Azure DevOps project GUID
   * @returns {Promise<object>} Project information
   */
  async resolveProjectInfo(projectGuid) {
    if (!projectGuid || !this.isGuid(projectGuid)) {
      throw new Error('Valid project GUID is required');
    }

    // Check GUID cache first
    const cached = this.getCacheByGuid(projectGuid);
    if (cached) {
      return cached;
    }

    try {
      // Get all projects from Azure DevOps
      const projectsResponse = await this.azureService.getProjects();
      const projects = projectsResponse.projects || [];

      // Find the project by GUID
      const project = projects.find(p => p.id === projectGuid);
      if (!project) {
        throw new Error(`Project not found for GUID: ${projectGuid}`);
      }

      const projectInfo = {
        id: project.id,
        name: project.name,
        description: project.description,
        state: project.state,
        visibility: project.visibility,
        url: project.url
      };

      // Cache the result
      this.setCacheByGuid(projectGuid, projectInfo);

      return projectInfo;

    } catch (error) {
      logger.error(`Failed to resolve project info for GUID ${projectGuid}:`, error.message);
      throw new Error(`Failed to resolve project info: ${error.message}`);
    }
  }

  /**
   * Validate that a project GUID exists in Azure DevOps
   * @param {string} projectGuid - Azure DevOps project GUID
   * @returns {Promise<boolean>} True if valid
   */
  async validateProjectGuid(projectGuid) {
    try {
      await this.resolveProjectInfo(projectGuid);
      return true;
    } catch (error) {
      logger.warn(`Invalid project GUID: ${projectGuid}`);
      return false;
    }
  }

  /**
   * Get all available projects with their mappings
   * @returns {Promise<Array>} Array of project mappings
   */
  async getAllProjectMappings() {
    try {
      const projectsResponse = await this.azureService.getProjects();
      const azureProjects = projectsResponse.projects || [];

      const mappings = [];
      
      // Get enabled frontend projects
      const { getFrontendProjects } = require('../config/projectMapping');
      const frontendProjects = getFrontendProjects(true); // enabled only

      for (const frontendId of frontendProjects) {
        try {
          const azureProjectName = mapFrontendProjectToAzure(frontendId);
          const azureProject = azureProjects.find(p => p.name === azureProjectName);
          
          if (azureProject) {
            mappings.push({
              frontendId,
              azureProjectName: azureProject.name,
              azureProjectId: azureProject.id,
              description: azureProject.description,
              state: azureProject.state,
              enabled: true
            });
          } else {
            mappings.push({
              frontendId,
              azureProjectName,
              azureProjectId: null,
              description: 'Project not found in Azure DevOps',
              state: 'missing',
              enabled: false
            });
          }
        } catch (error) {
          logger.warn(`Failed to map project ${frontendId}:`, error.message);
        }
      }

      return mappings;
    } catch (error) {
      logger.error('Failed to get project mappings:', error);
      throw new Error(`Failed to get project mappings: ${error.message}`);
    }
  }

  /**
   * Bulk resolve multiple project identifiers
   * @param {Array<string>} projectIdentifiers - Array of project identifiers
   * @returns {Promise<Map>} Map of identifier to resolved GUID
   */
  async bulkResolveProjects(projectIdentifiers) {
    const results = new Map();
    const errors = [];

    for (const identifier of projectIdentifiers) {
      try {
        const resolvedId = await this.resolveProjectId(identifier);
        results.set(identifier, resolvedId);
      } catch (error) {
        errors.push({ identifier, error: error.message });
        logger.warn(`Failed to resolve ${identifier}:`, error.message);
      }
    }

    if (errors.length > 0) {
      logger.warn(`Bulk resolve completed with ${errors.length} errors:`, errors);
    }

    return {
      resolved: results,
      errors
    };
  }

  /**
   * Cache management methods
   */
  getFromCache(projectIdentifier) {
    const cached = this.projectCache.get(projectIdentifier);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.guid;
    }
    return null;
  }

  setCache(projectIdentifier, guid) {
    this.projectCache.set(projectIdentifier, {
      guid,
      timestamp: Date.now()
    });
  }

  getCacheByGuid(guid) {
    const cached = this.guidCache.get(guid);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.info;
    }
    return null;
  }

  setCacheByGuid(guid, info) {
    this.guidCache.set(guid, {
      info,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.projectCache.clear();
    this.guidCache.clear();
    logger.info('Project resolution cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      projectCacheSize: this.projectCache.size,
      guidCacheSize: this.guidCache.size,
      cacheExpiry: this.cacheExpiry
    };
  }
}

module.exports = ProjectResolutionService;