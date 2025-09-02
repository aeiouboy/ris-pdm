/**
 * Classification Engine Utility
 * Handles bug type classification, pattern recognition, and configuration management
 * Provides intelligent classification and insights for work items
 */

const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class ClassificationEngine {
  constructor() {
    this.bugTypeConfig = null;
    this.classificationRules = null;
    this.patterns = {
      environments: {
        deploy: /deploy|deployment|release/i,
        prod: /prod|production|live/i,
        sit: /sit|system\s+integration|integration\s+test/i,
        uat: /uat|user\s+acceptance|acceptance\s+test/i
      },
      bugTypes: {
        functionality: /functional|feature|requirement/i,
        performance: /performance|slow|timeout|speed/i,
        ui: /ui|user\s+interface|display|visual/i,
        integration: /integration|api|service|endpoint/i,
        security: /security|auth|permission|access/i,
        data: /data|database|sql|query/i
      }
    };
    
    this.initializeConfig();
  }

  /**
   * Initialize configuration
   */
  async initializeConfig() {
    try {
      await this.loadBugTypeConfig();
      logger.info('Classification Engine initialized successfully');
    } catch (error) {
      logger.warn('Classification Engine initialized with default config:', error.message);
      this.useDefaultConfig();
    }
  }

  /**
   * Classify bug by type based on work item data
   * @param {object} bugItem - Bug work item
   * @returns {object} Classification result
   */
  classifyBugByType(bugItem) {
    if (!bugItem || bugItem.type !== 'Bug') {
      return {
        category: null,
        confidence: 0,
        reasoning: 'Not a bug work item'
      };
    }

    const classificationResult = {
      category: 'Unclassified',
      confidence: 0,
      reasoning: 'No classification patterns matched',
      customFieldValue: null,
      inferredType: null
    };

    // First, check custom field value
    const customFieldValue = this.extractCustomFieldValue(bugItem, 'Bug types');
    if (customFieldValue) {
      classificationResult.customFieldValue = customFieldValue;
      classificationResult.category = this.normalizeBugType(customFieldValue);
      classificationResult.confidence = 95;
      classificationResult.reasoning = 'Classified using custom field value';
      return classificationResult;
    }

    // If no custom field, try to infer from title and description
    const inferredType = this.inferBugTypeFromContent(bugItem);
    if (inferredType.category !== 'Unclassified') {
      classificationResult.inferredType = inferredType.category;
      classificationResult.category = inferredType.category;
      classificationResult.confidence = inferredType.confidence;
      classificationResult.reasoning = `Inferred from content: ${inferredType.reasoning}`;
    }

    return classificationResult;
  }

  /**
   * Classify bug by environment
   * @param {object} bugItem - Bug work item
   * @returns {object} Environment classification result
   */
  classifyBugByEnvironment(bugItem) {
    if (!bugItem || bugItem.type !== 'Bug') {
      return {
        environment: null,
        confidence: 0,
        reasoning: 'Not a bug work item'
      };
    }

    const result = {
      environment: 'Other',
      confidence: 0,
      reasoning: 'No environment patterns matched',
      customFieldValue: null,
      inferredEnvironment: null
    };

    // Check custom field first
    const customFieldValue = this.extractCustomFieldValue(bugItem, 'Bug types');
    if (customFieldValue) {
      result.customFieldValue = customFieldValue;
      const environment = this.extractEnvironmentFromValue(customFieldValue);
      if (environment !== 'Other') {
        result.environment = environment;
        result.confidence = 90;
        result.reasoning = 'Extracted from custom field value';
        return result;
      }
    }

    // Infer from content
    const inferredEnv = this.inferEnvironmentFromContent(bugItem);
    if (inferredEnv.environment !== 'Other') {
      result.inferredEnvironment = inferredEnv.environment;
      result.environment = inferredEnv.environment;
      result.confidence = inferredEnv.confidence;
      result.reasoning = `Inferred from content: ${inferredEnv.reasoning}`;
    }

    return result;
  }

  /**
   * Extract custom field value from work item
   * @param {object} workItem - Work item
   * @param {string} fieldName - Field name to extract
   * @returns {string|null} Field value
   */
  extractCustomFieldValue(workItem, fieldName) {
    if (!workItem) return null;

    // Try different possible field locations
    const possibleLocations = [
      workItem.customFields?.[fieldName],
      workItem.customFields?.['bug types'],
      workItem.customFields?.['Bug Types'],
      workItem.bugType,
      workItem.fields?.[fieldName],
      workItem.fields?.['Bug types'],
      workItem.fields?.['Bug Types']
    ];

    for (const value of possibleLocations) {
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  /**
   * Identify bug patterns in a collection of bugs
   * @param {Array} bugs - Array of bug work items
   * @returns {object} Identified patterns
   */
  identifyBugPatterns(bugs) {
    const patterns = {
      typeFrequency: {},
      environmentFrequency: {},
      areaPatterns: {},
      assigneePatterns: {},
      timePatterns: {},
      priorityPatterns: {},
      titleKeywords: {},
      insights: []
    };

    if (!bugs || bugs.length === 0) {
      return patterns;
    }

    // Analyze type frequency
    bugs.forEach(bug => {
      const classification = this.classifyBugByType(bug);
      const environment = this.classifyBugByEnvironment(bug);
      
      // Type frequency
      patterns.typeFrequency[classification.category] = 
        (patterns.typeFrequency[classification.category] || 0) + 1;
      
      // Environment frequency
      patterns.environmentFrequency[environment.environment] = 
        (patterns.environmentFrequency[environment.environment] || 0) + 1;

      // Area patterns
      if (bug.areaPath) {
        patterns.areaPatterns[bug.areaPath] = 
          (patterns.areaPatterns[bug.areaPath] || 0) + 1;
      }

      // Assignee patterns
      if (bug.assignee && bug.assignee !== 'Unassigned') {
        patterns.assigneePatterns[bug.assignee] = 
          (patterns.assigneePatterns[bug.assignee] || 0) + 1;
      }

      // Priority patterns
      patterns.priorityPatterns[bug.priority] = 
        (patterns.priorityPatterns[bug.priority] || 0) + 1;

      // Extract keywords from titles
      this.extractKeywords(bug.title).forEach(keyword => {
        patterns.titleKeywords[keyword] = 
          (patterns.titleKeywords[keyword] || 0) + 1;
      });
    });

    // Analyze time patterns
    patterns.timePatterns = this.analyzeTimePatterns(bugs);

    // Generate insights
    patterns.insights = this.generatePatternInsights(patterns, bugs);

    return patterns;
  }

  /**
   * Analyze bug recurrence patterns
   * @param {Array} historicalData - Historical bug data
   * @returns {object} Recurrence analysis
   */
  analyzeBugRecurrence(historicalData) {
    const recurrence = {
      similarBugs: [],
      recurringPatterns: [],
      hotspots: [],
      recommendations: []
    };

    if (!historicalData || historicalData.length < 2) {
      return recurrence;
    }

    // Group bugs by similarity
    const bugGroups = this.groupSimilarBugs(historicalData);
    
    // Identify recurring patterns
    Object.entries(bugGroups).forEach(([signature, bugs]) => {
      if (bugs.length > 1) {
        recurrence.recurringPatterns.push({
          signature,
          count: bugs.length,
          bugs: bugs.map(bug => ({
            id: bug.id,
            title: bug.title,
            createdDate: bug.createdDate,
            assignee: bug.assignee
          })),
          pattern: this.analyzeRecurrencePattern(bugs)
        });
      }
    });

    // Identify hotspots
    recurrence.hotspots = this.identifyBugHotspots(historicalData);

    // Generate recommendations
    recurrence.recommendations = this.generateRecurrenceRecommendations(recurrence);

    return recurrence;
  }

  /**
   * Generate classification insights
   * @param {object} classificationData - Classification data
   * @returns {object} Generated insights
   */
  generateClassificationInsights(classificationData) {
    const insights = {
      summary: {},
      trends: [],
      alerts: [],
      recommendations: []
    };

    if (!classificationData) {
      return insights;
    }

    // Summary statistics
    insights.summary = {
      totalBugs: classificationData.totalBugs || 0,
      classificationRate: classificationData.classificationRate || 0,
      topBugType: this.getTopCategory(classificationData.bugTypes),
      topEnvironment: this.getTopCategory(classificationData.environments),
      diversityIndex: this.calculateDiversityIndex(classificationData.bugTypes)
    };

    // Trend analysis
    if (classificationData.historical) {
      insights.trends = this.analyzeTrends(classificationData.historical);
    }

    // Generate alerts
    if (insights.summary.classificationRate < 70) {
      insights.alerts.push({
        type: 'low_classification_rate',
        message: 'Low bug classification rate detected',
        severity: 'warning',
        value: insights.summary.classificationRate
      });
    }

    if (classificationData.prodIssues > classificationData.sitBugs * 2) {
      insights.alerts.push({
        type: 'production_heavy',
        message: 'Too many production issues compared to SIT bugs',
        severity: 'high',
        prodIssues: classificationData.prodIssues,
        sitBugs: classificationData.sitBugs
      });
    }

    // Generate recommendations
    insights.recommendations = this.generateClassificationRecommendations(insights);

    return insights;
  }

  /**
   * Load bug type configuration from file
   * @returns {Promise<void>}
   */
  async loadBugTypeConfig() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'bugTypeConfig.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.bugTypeConfig = JSON.parse(configData);
      logger.debug('Bug type configuration loaded from file');
    } catch (error) {
      // File doesn't exist or is invalid, use default config
      this.useDefaultConfig();
    }
  }

  /**
   * Update classification rules
   * @param {object} newRules - New classification rules
   * @returns {boolean} Success status
   */
  updateClassificationRules(newRules) {
    try {
      if (newRules && typeof newRules === 'object') {
        this.classificationRules = { ...this.classificationRules, ...newRules };
        logger.info('Classification rules updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update classification rules:', error);
      return false;
    }
  }

  // Private helper methods

  /**
   * Use default configuration
   * @private
   */
  useDefaultConfig() {
    this.bugTypeConfig = {
      environments: ['Deploy', 'Prod', 'SIT', 'UAT', 'Other'],
      bugTypes: [
        'Deploy Bug',
        'Production Issue',
        'SIT Bug',
        'UAT Bug',
        'Functionality Bug',
        'Performance Bug',
        'UI Bug',
        'Integration Bug',
        'Security Bug',
        'Data Bug'
      ],
      defaultEnvironment: 'Other',
      defaultType: 'Unclassified'
    };

    this.classificationRules = {
      confidenceThreshold: 70,
      requireCustomField: false,
      allowInference: true,
      maxInferenceAttempts: 3
    };
  }

  /**
   * Normalize bug type value
   * @param {string} value - Raw bug type value
   * @returns {string} Normalized type
   * @private
   */
  normalizeBugType(value) {
    if (!value || typeof value !== 'string') {
      return 'Unclassified';
    }

    const normalized = value.toLowerCase().trim();
    
    // Environment-based classification
    if (normalized.includes('deploy')) return 'Deploy Bug';
    if (normalized.includes('prod')) return 'Production Issue';
    if (normalized.includes('sit')) return 'SIT Bug';
    if (normalized.includes('uat')) return 'UAT Bug';
    
    // Type-based classification
    if (this.patterns.bugTypes.functionality.test(normalized)) return 'Functionality Bug';
    if (this.patterns.bugTypes.performance.test(normalized)) return 'Performance Bug';
    if (this.patterns.bugTypes.ui.test(normalized)) return 'UI Bug';
    if (this.patterns.bugTypes.integration.test(normalized)) return 'Integration Bug';
    if (this.patterns.bugTypes.security.test(normalized)) return 'Security Bug';
    if (this.patterns.bugTypes.data.test(normalized)) return 'Data Bug';
    
    return value; // Return original if no pattern matches
  }

  /**
   * Extract environment from value
   * @param {string} value - Value to analyze
   * @returns {string} Extracted environment
   * @private
   */
  extractEnvironmentFromValue(value) {
    if (!value || typeof value !== 'string') {
      return 'Other';
    }

    const normalized = value.toLowerCase();
    
    if (this.patterns.environments.deploy.test(normalized)) return 'Deploy';
    if (this.patterns.environments.prod.test(normalized)) return 'Prod';
    if (this.patterns.environments.sit.test(normalized)) return 'SIT';
    if (this.patterns.environments.uat.test(normalized)) return 'UAT';
    
    return 'Other';
  }

  /**
   * Infer bug type from content
   * @param {object} bugItem - Bug work item
   * @returns {object} Inference result
   * @private
   */
  inferBugTypeFromContent(bugItem) {
    const content = `${bugItem.title || ''} ${bugItem.description || ''}`.toLowerCase();
    
    for (const [type, pattern] of Object.entries(this.patterns.bugTypes)) {
      if (pattern.test(content)) {
        return {
          category: `${type.charAt(0).toUpperCase() + type.slice(1)} Bug`,
          confidence: 60,
          reasoning: `Matched ${type} pattern in content`
        };
      }
    }

    return {
      category: 'Unclassified',
      confidence: 0,
      reasoning: 'No content patterns matched'
    };
  }

  /**
   * Infer environment from content
   * @param {object} bugItem - Bug work item
   * @returns {object} Inference result
   * @private
   */
  inferEnvironmentFromContent(bugItem) {
    const content = `${bugItem.title || ''} ${bugItem.description || ''}`.toLowerCase();
    
    for (const [env, pattern] of Object.entries(this.patterns.environments)) {
      if (pattern.test(content)) {
        return {
          environment: env.charAt(0).toUpperCase() + env.slice(1),
          confidence: 65,
          reasoning: `Matched ${env} pattern in content`
        };
      }
    }

    return {
      environment: 'Other',
      confidence: 0,
      reasoning: 'No environment patterns matched'
    };
  }

  /**
   * Extract keywords from text
   * @param {string} text - Text to analyze
   * @returns {Array} Extracted keywords
   * @private
   */
  extractKeywords(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Simple keyword extraction - remove common words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to first 10 meaningful words
  }

  /**
   * Analyze time patterns in bugs
   * @param {Array} bugs - Array of bugs
   * @returns {object} Time pattern analysis
   * @private
   */
  analyzeTimePatterns(bugs) {
    const patterns = {
      creationDays: {},
      creationHours: {},
      resolutionTimes: []
    };

    bugs.forEach(bug => {
      if (bug.createdDate) {
        const created = new Date(bug.createdDate);
        const day = created.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = created.getHours();

        patterns.creationDays[day] = (patterns.creationDays[day] || 0) + 1;
        patterns.creationHours[hour] = (patterns.creationHours[hour] || 0) + 1;

        if (bug.closedDate) {
          const closed = new Date(bug.closedDate);
          const resolutionTime = Math.ceil((closed - created) / (1000 * 60 * 60 * 24));
          patterns.resolutionTimes.push(resolutionTime);
        }
      }
    });

    return patterns;
  }

  /**
   * Generate pattern insights
   * @param {object} patterns - Analyzed patterns
   * @param {Array} bugs - Original bugs array
   * @returns {Array} Generated insights
   * @private
   */
  generatePatternInsights(patterns, bugs) {
    const insights = [];

    // Most common bug type
    const topBugType = this.getTopCategory(patterns.typeFrequency);
    if (topBugType) {
      insights.push(`Most common bug type: ${topBugType} (${patterns.typeFrequency[topBugType]} occurrences)`);
    }

    // Most problematic area
    const topArea = this.getTopCategory(patterns.areaPatterns);
    if (topArea) {
      insights.push(`Area with most bugs: ${topArea} (${patterns.areaPatterns[topArea]} bugs)`);
    }

    // Assignee with most bugs
    const topAssignee = this.getTopCategory(patterns.assigneePatterns);
    if (topAssignee) {
      insights.push(`Assignee with most bugs: ${topAssignee} (${patterns.assigneePatterns[topAssignee]} bugs)`);
    }

    // Time-based insights
    if (patterns.timePatterns.resolutionTimes.length > 0) {
      const avgResolution = patterns.timePatterns.resolutionTimes.reduce((a, b) => a + b, 0) / 
                           patterns.timePatterns.resolutionTimes.length;
      insights.push(`Average resolution time: ${Math.round(avgResolution)} days`);
    }

    return insights;
  }

  /**
   * Get top category from frequency data
   * @param {object} frequency - Frequency data
   * @returns {string|null} Top category
   * @private
   */
  getTopCategory(frequency) {
    if (!frequency || Object.keys(frequency).length === 0) {
      return null;
    }

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Calculate diversity index for classifications
   * @param {object} classifications - Classification data
   * @returns {number} Diversity index (0-1)
   * @private
   */
  calculateDiversityIndex(classifications) {
    if (!classifications || Object.keys(classifications).length === 0) {
      return 0;
    }

    const total = Object.values(classifications).reduce((sum, count) => sum + count, 0);
    const probabilities = Object.values(classifications).map(count => count / total);
    
    // Calculate Shannon diversity index
    const entropy = probabilities.reduce((sum, p) => sum - (p * Math.log2(p || 1)), 0);
    const maxEntropy = Math.log2(Object.keys(classifications).length);
    
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Group similar bugs
   * @param {Array} bugs - Array of bugs
   * @returns {object} Grouped bugs
   * @private
   */
  groupSimilarBugs(bugs) {
    const groups = {};

    bugs.forEach(bug => {
      const signature = this.generateBugSignature(bug);
      if (!groups[signature]) {
        groups[signature] = [];
      }
      groups[signature].push(bug);
    });

    return groups;
  }

  /**
   * Generate bug signature for similarity comparison
   * @param {object} bug - Bug work item
   * @returns {string} Bug signature
   * @private
   */
  generateBugSignature(bug) {
    const keywords = this.extractKeywords(bug.title).slice(0, 3).sort().join('_');
    const area = bug.areaPath ? bug.areaPath.split('\\').pop() : 'unknown';
    return `${keywords}_${area}`;
  }

  /**
   * Analyze recurrence pattern for a group of similar bugs
   * @param {Array} bugs - Similar bugs
   * @returns {object} Recurrence pattern
   * @private
   */
  analyzeRecurrencePattern(bugs) {
    const dates = bugs.map(bug => new Date(bug.createdDate)).sort();
    const intervals = [];
    
    for (let i = 1; i < dates.length; i++) {
      intervals.push(Math.ceil((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24)));
    }

    return {
      frequency: bugs.length,
      avgInterval: intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 0,
      firstOccurrence: dates[0].toISOString().split('T')[0],
      lastOccurrence: dates[dates.length - 1].toISOString().split('T')[0]
    };
  }

  /**
   * Identify bug hotspots from historical data
   * @param {Array} bugs - Historical bug data
   * @returns {Array} Identified hotspots
   * @private
   */
  identifyBugHotspots(bugs) {
    const hotspots = [];
    const areaCount = {};
    const assigneeCount = {};

    bugs.forEach(bug => {
      if (bug.areaPath) {
        areaCount[bug.areaPath] = (areaCount[bug.areaPath] || 0) + 1;
      }
      if (bug.assignee && bug.assignee !== 'Unassigned') {
        assigneeCount[bug.assignee] = (assigneeCount[bug.assignee] || 0) + 1;
      }
    });

    // Area hotspots
    Object.entries(areaCount).forEach(([area, count]) => {
      if (count >= 5) {
        hotspots.push({
          type: 'area',
          location: area,
          count,
          severity: count >= 10 ? 'high' : 'medium'
        });
      }
    });

    // Assignee hotspots
    Object.entries(assigneeCount).forEach(([assignee, count]) => {
      if (count >= 8) {
        hotspots.push({
          type: 'assignee',
          location: assignee,
          count,
          severity: count >= 15 ? 'high' : 'medium'
        });
      }
    });

    return hotspots.sort((a, b) => b.count - a.count);
  }

  /**
   * Generate recurrence recommendations
   * @param {object} recurrenceData - Recurrence analysis data
   * @returns {Array} Recommendations
   * @private
   */
  generateRecurrenceRecommendations(recurrenceData) {
    const recommendations = [];

    if (recurrenceData.recurringPatterns.length > 0) {
      recommendations.push('Investigate recurring bug patterns to identify root causes');
      recommendations.push('Consider implementing preventive measures for common bug types');
    }

    if (recurrenceData.hotspots.length > 0) {
      const highSeverityHotspots = recurrenceData.hotspots.filter(h => h.severity === 'high');
      if (highSeverityHotspots.length > 0) {
        recommendations.push('Focus quality improvements on identified high-severity hotspots');
      }
    }

    return recommendations;
  }

  /**
   * Analyze trends in classification data
   * @param {Array} historicalData - Historical classification data
   * @returns {Array} Trend analysis
   * @private
   */
  analyzeTrends(historicalData) {
    const trends = [];

    if (historicalData.length < 2) {
      return trends;
    }

    // Simple trend analysis - compare latest with previous
    const latest = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];

    const changeRate = ((latest.totalBugs - previous.totalBugs) / previous.totalBugs) * 100;
    
    trends.push({
      metric: 'total_bugs',
      direction: changeRate > 0 ? 'increasing' : changeRate < 0 ? 'decreasing' : 'stable',
      changePercent: Math.abs(Math.round(changeRate))
    });

    return trends;
  }

  /**
   * Generate classification recommendations
   * @param {object} insights - Insights data
   * @returns {Array} Recommendations
   * @private
   */
  generateClassificationRecommendations(insights) {
    const recommendations = [];

    if (insights.summary.classificationRate < 80) {
      recommendations.push('Improve bug classification rate by training team on custom field usage');
      recommendations.push('Consider making bug type field required for bug work items');
    }

    if (insights.alerts.some(alert => alert.type === 'production_heavy')) {
      recommendations.push('Strengthen pre-production testing to catch more bugs in SIT environment');
      recommendations.push('Review deployment and testing processes');
    }

    if (insights.summary.diversityIndex < 0.3) {
      recommendations.push('Bug types are heavily concentrated - consider if more categories are needed');
    }

    return recommendations;
  }
}

module.exports = ClassificationEngine;