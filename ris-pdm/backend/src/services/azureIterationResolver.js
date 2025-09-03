/**
 * Azure DevOps Iteration Path Resolver
 * 
 * Provides intelligent iteration path resolution for Azure DevOps projects.
 * Handles missing iterations gracefully with fallback strategies.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const logger = require('../../utils/logger').child({ component: 'AzureIterationResolver' });
const { 
  mapFrontendProjectToTeam, 
  getProjectIterationConfig, 
  findCurrentIterationForProject 
} = require('../config/projectMapping');
// Using built-in fetch from Node.js 18+
const fetch = globalThis.fetch;

/**
 * Azure DevOps Iteration Path Resolver Service
 * Resolves iteration paths intelligently with fallback strategies
 */
class AzureIterationResolver {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    this.iterationCache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    
    // Common iteration patterns to try (fallback for projects without specific config)
    this.commonPatterns = [
      'Sprint {n}',
      'Sprint-{n}', 
      'Sprint {n:02d}',
      'S{n}',
      'Iteration {n}',
      'DaaS {n}',
      'Delivery {n}'
    ];
    
    // Project-specific iteration patterns
    this.projectPatterns = {
      'Product - Data as a Service': {
        patterns: ['DaaS {n}'],
        regex: /^DaaS\s+(\d+)$/i
      },
      'Product - Partner Management Platform': {
        patterns: ['Delivery {n}', 'Sprint {n}'],
        regex: /^(Delivery|Sprint)\s+(\d+)$/i
      }
    };
  }

  /**
   * Resolve iteration path with intelligent fallbacks
   * @param {string} project - Azure DevOps project name
   * @param {string} requestedIteration - Requested iteration (e.g., 'current', 'sprint-18')
   * @param {string} teamName - Team name (optional)
   * @returns {Promise<string|null>} Resolved iteration path or null
   */
  async resolveIteration(project, requestedIteration, teamName = null) {
    const cacheKey = `${project}:${teamName}:${requestedIteration}`;
    
    // Check cache first
    const cached = this.getCachedIteration(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get all available iterations for the project
      const iterations = await this.getProjectIterations(project, teamName);
      
      if (!iterations || !Array.isArray(iterations) || iterations.length === 0) {
        logger.warn(`No iterations found for project: ${project}. Iterations: ${JSON.stringify(iterations)}`);
        return null;
      }

      let resolvedPath = null;

      // Handle special cases
      switch (requestedIteration.toLowerCase()) {
        case 'current':
          resolvedPath = await this.findCurrentIteration(iterations, project);
          break;
        case 'latest':
          resolvedPath = this.findLatestIteration(iterations);
          break;
        default:
          resolvedPath = await this.findIterationByPattern(iterations, requestedIteration, project);
          break;
      }

      // Cache the result
      if (resolvedPath) {
        this.cacheIteration(cacheKey, resolvedPath);
        logger.info(`Resolved iteration: ${requestedIteration} → ${resolvedPath} for project: ${project}`);
      } else {
        logger.warn(`Could not resolve iteration: ${requestedIteration} for project: ${project}`);
      }

      return resolvedPath;

    } catch (error) {
      logger.error(`Error resolving iteration path: ${error.message}`, {
        project,
        requestedIteration,
        teamName
      });
      return null;
    }
  }

  /**
   * Get all iterations for a project
   * @param {string} project - Project name
   * @param {string} teamName - Team name (optional)
   * @returns {Promise<Array>} Array of iteration objects
   */
  async getProjectIterations(project, teamName = null) {
    try {
      // 🎯 FIXED: Use proper team mapping instead of guessing patterns
      const correctTeamName = teamName || mapFrontendProjectToTeam(project) || project;
      
      // Debug logging to see what teams we're trying
      logger.info(`🔍 Project: "${project}" → Mapped Team: "${mapFrontendProjectToTeam(project)}" → Final Team: "${correctTeamName}"`);
      
      // 🎯 FIXED: Call Azure DevOps API directly to avoid recursion
      // Instead of calling azureService.getIterations (which creates recursion), call the API directly
      const org = this.azureService.organization;
      const pat = this.azureService.pat;
      const apiVersion = this.azureService.apiVersion;
      
      const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/${encodeURIComponent(correctTeamName)}/_apis/work/teamsettings/iterations?api-version=${apiVersion}`;
      
      logger.debug(`Calling Azure DevOps API directly: ${url}`);
      
      const auth = Buffer.from(':' + pat).toString('base64');
      const response = await fetch(url, {
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.debug(`Azure DevOps API failed for team '${correctTeamName}': ${response.status} - ${errorText}`);
        return [];
      }
      
      const data = await response.json();
      logger.info(`✅ Found ${data.count} iterations for team: ${correctTeamName}`);
      
      return data.value || [];

    } catch (error) {
      logger.error(`Error getting project iterations: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the current active iteration with project-specific logic
   * @param {Array} iterations - Array of iteration objects
   * @param {string} project - Project name for project-specific logic
   * @returns {string|null} Current iteration path
   */
  async findCurrentIteration(iterations, project = null) {
    const now = new Date();
    
    // First try: Look for iteration that contains current date
    const currentIteration = iterations.find(iteration => {
      const startDate = new Date(iteration.attributes?.startDate);
      const finishDate = new Date(iteration.attributes?.finishDate);
      
      return startDate <= now && finishDate >= now;
    });

    if (currentIteration) {
      logger.info(`Found current iteration by date: ${currentIteration.name} for project: ${project}`);
      return currentIteration.path;
    }

    // Second try: Use project-specific logic to find current iteration
    if (project) {
      const projectCurrentIteration = findCurrentIterationForProject(project, iterations);
      if (projectCurrentIteration) {
        const foundIteration = iterations.find(iter => iter.name === projectCurrentIteration);
        if (foundIteration) {
          logger.info(`Found current iteration by project logic: ${projectCurrentIteration} for project: ${project}`);
          return foundIteration.path;
        }
      }
    }

    // Fallback: get the most recent iteration
    const sortedIterations = iterations
      .filter(iter => iter.attributes?.startDate)
      .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

    if (sortedIterations.length > 0) {
      logger.info(`Using most recent iteration as fallback: ${sortedIterations[0].name} for project: ${project}`);
      return sortedIterations[0].path;
    }

    return null;
  }

  /**
   * Find the latest iteration
   * @param {Array} iterations - Array of iteration objects
   * @returns {string|null} Latest iteration path
   */
  findLatestIteration(iterations) {
    const sortedIterations = iterations
      .filter(iter => iter.attributes?.startDate)
      .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

    return sortedIterations.length > 0 ? sortedIterations[0].path : null;
  }

  /**
   * Find iteration by pattern matching with project-specific patterns
   * @param {Array} iterations - Array of iteration objects
   * @param {string} pattern - Pattern to match (e.g., 'sprint-18', 'daas-12')
   * @param {string} project - Project name for project-specific patterns
   * @returns {string|null} Matching iteration path
   */
  async findIterationByPattern(iterations, pattern, project = null) {
    // Direct name match first
    let match = iterations.find(iter => 
      iter.name?.toLowerCase() === pattern.toLowerCase()
    );
    
    if (match) {
      logger.info(`Found direct name match: ${pattern} → ${match.path}`);
      return match.path;
    }

    // Extract number from pattern
    const numberMatch = pattern.match(/(\d+)/i);
    if (numberMatch) {
      const number = parseInt(numberMatch[1]);
      
      // Try project-specific patterns first
      if (project && this.projectPatterns[project]) {
        const projectConfig = this.projectPatterns[project];
        for (const template of projectConfig.patterns) {
          const testName = template.replace('{n}', number).replace('{n:02d}', number.toString().padStart(2, '0'));
          
          match = iterations.find(iter => 
            iter.name?.toLowerCase() === testName.toLowerCase()
          );
          
          if (match) {
            logger.info(`Found project-specific pattern match: ${pattern} → ${testName} → ${match.path}`);
            return match.path;
          }
        }
      }
      
      // Try common patterns as fallback
      for (const template of this.commonPatterns) {
        const testName = template.replace('{n}', number).replace('{n:02d}', number.toString().padStart(2, '0'));
        
        match = iterations.find(iter => 
          iter.name?.toLowerCase() === testName.toLowerCase()
        );
        
        if (match) {
          logger.info(`Found common pattern match: ${pattern} → ${testName} → ${match.path}`);
          return match.path;
        }
      }
    }

    // Fuzzy matching as last resort
    match = iterations.find(iter => 
      iter.name?.toLowerCase().includes(pattern.toLowerCase())
    );

    if (match) {
      logger.info(`Found fuzzy match: ${pattern} → ${match.name} → ${match.path}`);
    }

    return match ? match.path : null;
  }

  /**
   * Get cached iteration
   * @param {string} key - Cache key
   * @returns {string|null} Cached iteration path
   */
  getCachedIteration(key) {
    const cached = this.iterationCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.path;
    }
    
    if (cached) {
      this.iterationCache.delete(key);
    }
    
    return null;
  }

  /**
   * Cache iteration path
   * @param {string} key - Cache key
   * @param {string} path - Iteration path
   */
  cacheIteration(key, path) {
    this.iterationCache.set(key, {
      path,
      timestamp: Date.now()
    });
  }

  /**
   * Get supported iteration patterns for a project
   * @param {string} project - Project name
   * @returns {Array} Array of supported patterns
   */
  getSupportedPatternsForProject(project) {
    const projectConfig = this.projectPatterns[project];
    if (projectConfig) {
      return projectConfig.patterns;
    }
    return this.commonPatterns;
  }

  /**
   * Clear iteration cache
   */
  clearCache() {
    this.iterationCache.clear();
    logger.info('Iteration cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.iterationCache.size,
      ttl: this.cacheTTL,
      entries: Array.from(this.iterationCache.keys())
    };
  }
}

module.exports = AzureIterationResolver;