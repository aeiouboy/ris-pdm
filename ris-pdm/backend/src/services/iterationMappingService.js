/**
 * Iteration Mapping Service
 * 
 * Handles project-specific iteration naming conventions and provides
 * intelligent mapping between frontend requests and Azure DevOps iterations.
 * Supports both DaaS (DaaS 1, DaaS 2, ...) and PMP (Delivery 1, Sprint 1, ...) patterns.
 * 
 * @author RIS Performance Dashboard Team
 * @version 1.0.0
 */

const logger = require('../../utils/logger').child({ component: 'IterationMappingService' });
const { 
  getProjectIterationConfig, 
  mapFrontendProjectToAzure,
  mapFrontendProjectToTeam
} = require('../config/projectMapping');

class IterationMappingService {
  constructor() {
    // Project-specific iteration mapping rules
    this.projectRules = {
      'Product - Data as a Service': {
        currentFormat: 'Delivery {n}',
        patterns: [
          /^Delivery\s+(\d+)$/i,
          /^delivery[-_\s]*(\d+)$/i
        ],
        examples: ['Delivery 12', 'delivery-12', 'delivery_12']
      },
      'Product - Partner Management Platform': {
        currentFormat: 'Delivery {n}',
        patterns: [
          /^Delivery\s+(\d+)$/i,
          /^delivery[-_\s]*(\d+)$/i,
          /^Sprint\s+(\d+)$/i,
          /^sprint[-_\s]*(\d+)$/i
        ],
        examples: ['Delivery 4', 'delivery-4', 'Sprint 18', 'sprint_18']
      }
    };
  }

  /**
   * Resolve frontend iteration request to actual Azure DevOps iteration
   * @param {string} projectId - Frontend project ID
   * @param {string} requestedIteration - Requested iteration (e.g., 'current', 'latest', 'sprint-18')
   * @param {Array} availableIterations - Available iterations from Azure DevOps
   * @returns {Object} Resolution result with iteration name and path
   */
  async resolveIteration(projectId, requestedIteration, availableIterations = []) {
    try {
      const azureProject = mapFrontendProjectToAzure(projectId);
      const teamName = mapFrontendProjectToTeam(projectId);
      
      logger.info(`🔄 Resolving iteration for project: ${projectId} → ${azureProject}`);
      logger.debug(`Requested: ${requestedIteration}, Available iterations: ${availableIterations.length}`);

      // Handle special cases
      switch (requestedIteration?.toLowerCase()) {
        case 'current':
          return await this.findCurrentIteration(azureProject, availableIterations);
        case 'latest':
          return await this.findLatestIteration(availableIterations);
        default:
          return await this.findIterationByPattern(azureProject, requestedIteration, availableIterations);
      }

    } catch (error) {
      logger.error(`Error resolving iteration: ${error.message}`, {
        projectId,
        requestedIteration,
        error: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Find current iteration based on project-specific logic
   * @param {string} azureProject - Azure DevOps project name
   * @param {Array} iterations - Available iterations
   * @returns {Object} Current iteration result
   */
  async findCurrentIteration(azureProject, iterations) {
    const now = new Date();

    // Strategy 1: Find by date range (most accurate)
    const currentByDate = iterations.find(iteration => {
      const startDate = new Date(iteration.attributes?.startDate);
      const finishDate = new Date(iteration.attributes?.finishDate);
      return startDate <= now && finishDate >= now;
    });

    if (currentByDate) {
      logger.info(`✅ Found current iteration by date: ${currentByDate.name}`);
      return {
        success: true,
        iteration: currentByDate.name,
        path: currentByDate.path,
        method: 'date-range',
        startDate: currentByDate.attributes?.startDate,
        finishDate: currentByDate.attributes?.finishDate
      };
    }

    // Strategy 2: Find by project-specific pattern (highest number)
    const projectRules = this.projectRules[azureProject];
    if (projectRules) {
      const matchingIterations = [];

      for (const pattern of projectRules.patterns) {
        iterations.forEach(iter => {
          const match = iter.name.match(pattern);
          if (match) {
            matchingIterations.push({
              ...iter,
              number: parseInt(match[1]),
              pattern: pattern.source
            });
          }
        });
      }

      if (matchingIterations.length > 0) {
        // Sort by number descending and get the highest
        const latest = matchingIterations.sort((a, b) => b.number - a.number)[0];
        logger.info(`✅ Found current iteration by pattern: ${latest.name} (highest number: ${latest.number})`);
        return {
          success: true,
          iteration: latest.name,
          path: latest.path,
          method: 'pattern-latest',
          number: latest.number,
          pattern: latest.pattern
        };
      }
    }

    // Strategy 3: Most recent by start date (fallback)
    const sortedByDate = iterations
      .filter(iter => iter.attributes?.startDate)
      .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

    if (sortedByDate.length > 0) {
      const latest = sortedByDate[0];
      logger.info(`⚠️ Using most recent iteration as fallback: ${latest.name}`);
      return {
        success: true,
        iteration: latest.name,
        path: latest.path,
        method: 'date-fallback',
        startDate: latest.attributes?.startDate
      };
    }

    logger.warn(`❌ Could not find current iteration for project: ${azureProject}`);
    return {
      success: false,
      error: 'No current iteration found',
      availableIterations: iterations.map(i => i.name)
    };
  }

  /**
   * Find latest iteration (most recent by start date)
   * @param {Array} iterations - Available iterations
   * @returns {Object} Latest iteration result
   */
  async findLatestIteration(iterations) {
    const sortedByDate = iterations
      .filter(iter => iter.attributes?.startDate)
      .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

    if (sortedByDate.length > 0) {
      const latest = sortedByDate[0];
      return {
        success: true,
        iteration: latest.name,
        path: latest.path,
        method: 'latest-by-date',
        startDate: latest.attributes?.startDate
      };
    }

    return { success: false, error: 'No iterations available' };
  }

  /**
   * Find iteration by pattern matching
   * @param {string} azureProject - Azure DevOps project name
   * @param {string} pattern - Pattern to match
   * @param {Array} iterations - Available iterations
   * @returns {Object} Iteration result
   */
  async findIterationByPattern(azureProject, pattern, iterations) {
    // Direct name match first
    const directMatch = iterations.find(iter => 
      iter.name?.toLowerCase() === pattern?.toLowerCase()
    );

    if (directMatch) {
      return {
        success: true,
        iteration: directMatch.name,
        path: directMatch.path,
        method: 'direct-match'
      };
    }

    // Extract number from pattern
    const numberMatch = pattern?.match(/(\d+)/);
    if (!numberMatch) {
      return { success: false, error: `No number found in pattern: ${pattern}` };
    }

    const number = parseInt(numberMatch[1]);
    const projectRules = this.projectRules[azureProject];

    // Try project-specific patterns
    if (projectRules) {
      for (const testPattern of projectRules.patterns) {
        const match = iterations.find(iter => {
          const iterMatch = iter.name.match(testPattern);
          return iterMatch && parseInt(iterMatch[1]) === number;
        });

        if (match) {
          return {
            success: true,
            iteration: match.name,
            path: match.path,
            method: 'project-pattern',
            pattern: testPattern.source,
            number
          };
        }
      }
    }

    // Generic patterns as fallback
    const genericPatterns = [
      `Sprint ${number}`,
      `Sprint-${number}`,
      `Iteration ${number}`,
      `S${number}`
    ];

    for (const testName of genericPatterns) {
      const match = iterations.find(iter => 
        iter.name?.toLowerCase() === testName.toLowerCase()
      );

      if (match) {
        return {
          success: true,
          iteration: match.name,
          path: match.path,
          method: 'generic-pattern',
          pattern: testName,
          number
        };
      }
    }

    // Fuzzy matching as last resort
    const fuzzyMatch = iterations.find(iter => 
      iter.name?.toLowerCase().includes(pattern?.toLowerCase())
    );

    if (fuzzyMatch) {
      return {
        success: true,
        iteration: fuzzyMatch.name,
        path: fuzzyMatch.path,
        method: 'fuzzy-match',
        warning: 'Used fuzzy matching, may not be exact'
      };
    }

    return {
      success: false,
      error: `No iteration found matching pattern: ${pattern}`,
      suggestions: iterations.slice(0, 5).map(i => i.name)
    };
  }

  /**
   * Get iteration examples for a project
   * @param {string} projectId - Frontend project ID
   * @returns {Array} Array of example iteration names
   */
  getIterationExamples(projectId) {
    const azureProject = mapFrontendProjectToAzure(projectId);
    const rules = this.projectRules[azureProject];
    
    if (rules) {
      return rules.examples;
    }

    return ['Sprint 1', 'Sprint-2', 'Iteration 3'];
  }

  /**
   * Get supported projects and their iteration patterns
   * @returns {Object} Map of projects to their iteration patterns
   */
  getSupportedProjects() {
    const result = {};
    
    Object.keys(this.projectRules).forEach(project => {
      const rules = this.projectRules[project];
      result[project] = {
        currentFormat: rules.currentFormat,
        patterns: rules.patterns.map(p => p.source),
        examples: rules.examples
      };
    });

    return result;
  }

  /**
   * Validate iteration name against project patterns
   * @param {string} projectId - Frontend project ID
   * @param {string} iterationName - Iteration name to validate
   * @returns {Object} Validation result
   */
  validateIterationName(projectId, iterationName) {
    const azureProject = mapFrontendProjectToAzure(projectId);
    const rules = this.projectRules[azureProject];

    if (!rules) {
      return { valid: true, note: 'No specific validation rules for this project' };
    }

    const isValid = rules.patterns.some(pattern => pattern.test(iterationName));

    return {
      valid: isValid,
      project: azureProject,
      iterationName,
      expectedFormat: rules.currentFormat,
      examples: rules.examples,
      message: isValid 
        ? 'Iteration name follows project conventions' 
        : `Iteration name should follow pattern: ${rules.currentFormat}`
    };
  }
}

module.exports = IterationMappingService;