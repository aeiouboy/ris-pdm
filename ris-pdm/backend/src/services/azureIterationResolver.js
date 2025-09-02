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
const { mapFrontendProjectToTeam } = require('../config/projectMapping');

/**
 * Azure DevOps Iteration Path Resolver Service
 * Resolves iteration paths intelligently with fallback strategies
 */
class AzureIterationResolver {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    this.iterationCache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    
    // Common iteration patterns to try
    this.commonPatterns = [
      'Sprint {n}',
      'Sprint-{n}', 
      'Sprint {n:02d}',
      'S{n}',
      'Iteration {n}'
    ];
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
          resolvedPath = await this.findCurrentIteration(iterations);
          break;
        case 'latest':
          resolvedPath = this.findLatestIteration(iterations);
          break;
        default:
          resolvedPath = await this.findIterationByPattern(iterations, requestedIteration);
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
      
      // Try correct team name first, then fallback patterns
      const teamPatterns = [
        correctTeamName,
        teamName,
        `${teamName} Team`,
        project,
        `${project} Team`
      ].filter(Boolean); // Remove null/undefined values

      for (const team of teamPatterns) {
        try {
          const iterations = await this.azureService.getIterations(project, team);
          if (iterations && iterations.length > 0) {
            logger.debug(`Found ${iterations.length} iterations for team: ${team}`);
            return iterations;
          }
        } catch (error) {
          logger.debug(`Team '${team}' not found, trying next pattern`);
          continue;
        }
      }

      // If no team-specific iterations found, try project-level
      try {
        const iterations = await this.azureService.getIterations(project);
        return iterations || [];
      } catch (error) {
        logger.warn(`Could not get iterations for project: ${project}`);
        return [];
      }

    } catch (error) {
      logger.error(`Error getting project iterations: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the current active iteration
   * @param {Array} iterations - Array of iteration objects
   * @returns {string|null} Current iteration path
   */
  async findCurrentIteration(iterations) {
    const now = new Date();
    
    // Look for iteration that contains current date
    const currentIteration = iterations.find(iteration => {
      const startDate = new Date(iteration.attributes?.startDate);
      const finishDate = new Date(iteration.attributes?.finishDate);
      
      return startDate <= now && finishDate >= now;
    });

    if (currentIteration) {
      return currentIteration.path;
    }

    // Fallback: get the most recent iteration
    const sortedIterations = iterations
      .filter(iter => iter.attributes?.startDate)
      .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

    return sortedIterations.length > 0 ? sortedIterations[0].path : null;
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
   * Find iteration by pattern matching
   * @param {Array} iterations - Array of iteration objects
   * @param {string} pattern - Pattern to match (e.g., 'sprint-18')
   * @returns {string|null} Matching iteration path
   */
  async findIterationByPattern(iterations, pattern) {
    // Direct name match first
    let match = iterations.find(iter => 
      iter.name?.toLowerCase() === pattern.toLowerCase()
    );
    
    if (match) {
      return match.path;
    }

    // Pattern matching for sprint numbers
    const sprintMatch = pattern.match(/sprint[-\s]*(\d+)/i);
    if (sprintMatch) {
      const sprintNumber = parseInt(sprintMatch[1]);
      
      // Try various patterns
      for (const template of this.commonPatterns) {
        const testName = template.replace('{n}', sprintNumber).replace('{n:02d}', sprintNumber.toString().padStart(2, '0'));
        
        match = iterations.find(iter => 
          iter.name?.toLowerCase() === testName.toLowerCase()
        );
        
        if (match) {
          return match.path;
        }
      }
    }

    // Fuzzy matching as last resort
    match = iterations.find(iter => 
      iter.name?.toLowerCase().includes(pattern.toLowerCase())
    );

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