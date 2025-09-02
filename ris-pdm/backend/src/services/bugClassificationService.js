/**
 * Bug Classification Service
 * Analyzes and categorizes bugs from Azure DevOps data
 */

const logger = require('../../utils/logger');

class BugClassificationService {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    
    // Bug classification rules
    this.classificationRules = {
      severity: {
        critical: {
          keywords: ['critical', 'crash', 'data loss', 'security', 'production down', 'system failure'],
          priority: [1],
          tags: ['critical', 'blocker', 'p1']
        },
        high: {
          keywords: ['high', 'major', 'blocking', 'urgent', 'cannot proceed'],
          priority: [1, 2],
          tags: ['high', 'major', 'p2']
        },
        medium: {
          keywords: ['medium', 'normal', 'moderate'],
          priority: [2, 3],
          tags: ['medium', 'normal', 'p3']
        },
        low: {
          keywords: ['low', 'minor', 'cosmetic', 'enhancement'],
          priority: [3, 4],
          tags: ['low', 'minor', 'p4', 'cosmetic']
        }
      },
      
      category: {
        ui: {
          keywords: ['ui', 'interface', 'display', 'layout', 'css', 'styling', 'responsive'],
          areas: ['frontend', 'web', 'mobile', 'design']
        },
        functional: {
          keywords: ['function', 'feature', 'workflow', 'process', 'calculation'],
          areas: ['backend', 'api', 'service', 'logic']
        },
        performance: {
          keywords: ['slow', 'timeout', 'performance', 'memory', 'cpu', 'speed'],
          areas: ['optimization', 'database', 'query']
        },
        security: {
          keywords: ['security', 'authentication', 'authorization', 'vulnerability', 'xss', 'sql injection'],
          areas: ['auth', 'permissions', 'data protection']
        },
        integration: {
          keywords: ['integration', 'api', 'third party', 'external', 'connection'],
          areas: ['external api', 'services', 'webhooks']
        },
        data: {
          keywords: ['data', 'database', 'export', 'import', 'sync', 'corruption'],
          areas: ['database', 'migration', 'backup']
        }
      },

      source: {
        user_reported: {
          keywords: ['user reported', 'customer', 'feedback', 'complaint'],
          tags: ['user-feedback', 'customer-issue']
        },
        testing: {
          keywords: ['test', 'qa', 'automated test', 'unit test', 'integration test'],
          tags: ['qa', 'testing', 'automated']
        },
        production: {
          keywords: ['production', 'live', 'deployment'],
          tags: ['production', 'hotfix']
        },
        development: {
          keywords: ['development', 'dev', 'coding', 'implementation'],
          tags: ['dev', 'implementation']
        }
      }
    };
  }

  /**
   * Get all bugs with classification
   */
  async getClassifiedBugs(options = {}) {
    try {
      logger.info('🐛 Starting bug classification analysis');
      
      // Get all bugs from Azure DevOps
      const bugQuery = {
        workItemTypes: ['Bug'],
        states: options.states || null,
        iterationPath: options.iterationPath,
        assignedTo: options.assignedTo,
        maxResults: options.maxResults || 1000
      };

      const bugs = await this.azureService.getWorkItems(bugQuery);
      
      if (!bugs.workItems || bugs.workItems.length === 0) {
        logger.info('No bugs found');
        return {
          bugs: [],
          classification: {},
          totalCount: 0
        };
      }

      // Get detailed information for all bugs
      const bugIds = bugs.workItems.map(bug => bug.id);
      const detailedBugs = await this.azureService.getWorkItemDetails(bugIds);
      
      // Classify each bug
      const classifiedBugs = detailedBugs.workItems.map(bug => 
        this.classifyBug(bug)
      );

      // Generate classification summary
      const classification = this.generateClassificationSummary(classifiedBugs);
      
      logger.info(`🔍 Classified ${classifiedBugs.length} bugs`);
      
      return {
        bugs: classifiedBugs,
        classification,
        totalCount: classifiedBugs.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error in bug classification:', error);
      throw new Error(`Bug classification failed: ${error.message}`);
    }
  }

  /**
   * Classify individual bug
   */
  classifyBug(bug) {
    const classification = {
      severity: this.classifySeverity(bug),
      category: this.classifyCategory(bug),
      source: this.classifySource(bug),
      bugType: this.classifyBugType(bug)
    };

    return {
      ...bug,
      classification,
      classificationScore: this.calculateClassificationScore(classification)
    };
  }

  /**
   * Classify bug severity
   */
  classifySeverity(bug) {
    const title = (bug.title || '').toLowerCase();
    const description = (bug.description || '').toLowerCase();
    const tags = bug.tags || [];
    const priority = bug.priority || 4;
    
    for (const [severityLevel, rules] of Object.entries(this.classificationRules.severity)) {
      // Check keywords in title and description
      const keywordMatch = rules.keywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
      );
      
      // Check priority match
      const priorityMatch = rules.priority.includes(priority);
      
      // Check tags match
      const tagMatch = tags.some(tag => 
        rules.tags.some(ruleTag => 
          tag.toLowerCase().includes(ruleTag.toLowerCase())
        )
      );
      
      if (keywordMatch || (priorityMatch && tagMatch)) {
        return {
          level: severityLevel,
          confidence: this.calculateConfidence([keywordMatch, priorityMatch, tagMatch]),
          factors: {
            keywordMatch,
            priorityMatch,
            tagMatch
          }
        };
      }
    }
    
    // Default classification based on priority
    if (priority <= 2) return { level: 'high', confidence: 0.6, factors: { priorityMatch: true }};
    if (priority === 3) return { level: 'medium', confidence: 0.6, factors: { priorityMatch: true }};
    return { level: 'low', confidence: 0.6, factors: { priorityMatch: true }};
  }

  /**
   * Classify bug category
   */
  classifyCategory(bug) {
    const title = (bug.title || '').toLowerCase();
    const description = (bug.description || '').toLowerCase();
    const areaPath = (bug.areaPath || '').toLowerCase();
    const tags = bug.tags || [];
    
    for (const [categoryType, rules] of Object.entries(this.classificationRules.category)) {
      // Check keywords in title and description
      const keywordMatch = rules.keywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
      );
      
      // Check area path match
      const areaMatch = rules.areas.some(area => 
        areaPath.includes(area.toLowerCase())
      );
      
      // Check tags match
      const tagMatch = tags.some(tag => 
        rules.keywords.some(keyword => 
          tag.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (keywordMatch || areaMatch || tagMatch) {
        return {
          type: categoryType,
          confidence: this.calculateConfidence([keywordMatch, areaMatch, tagMatch]),
          factors: {
            keywordMatch,
            areaMatch,
            tagMatch
          }
        };
      }
    }
    
    return { 
      type: 'functional', 
      confidence: 0.3, 
      factors: { defaultClassification: true }
    };
  }

  /**
   * Classify bug source
   */
  classifySource(bug) {
    const title = (bug.title || '').toLowerCase();
    const description = (bug.description || '').toLowerCase();
    const tags = bug.tags || [];
    const reason = (bug.reason || '').toLowerCase();
    
    for (const [sourceType, rules] of Object.entries(this.classificationRules.source)) {
      // Check keywords in title, description, and reason
      const keywordMatch = rules.keywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword) || reason.includes(keyword)
      );
      
      // Check tags match
      const tagMatch = tags.some(tag => 
        rules.tags.some(ruleTag => 
          tag.toLowerCase().includes(ruleTag.toLowerCase())
        )
      );
      
      if (keywordMatch || tagMatch) {
        return {
          type: sourceType,
          confidence: this.calculateConfidence([keywordMatch, tagMatch]),
          factors: {
            keywordMatch,
            tagMatch
          }
        };
      }
    }
    
    return { 
      type: 'development', 
      confidence: 0.4, 
      factors: { defaultClassification: true }
    };
  }

  /**
   * Classify bug type based on Azure DevOps custom field
   */
  classifyBugType(bug) {
    // Check for Azure DevOps custom field "Bug types" or similar field
    const bugTypeField = bug.customFields?.bugTypes || 
                        bug.fields?.['Custom.BugTypes'] || 
                        bug.fields?.['Microsoft.VSTS.Common.BugType'] ||
                        bug.fields?.['System.Tags'] ||
                        bug.fields?.['Bug types'] ||
                        bug.bugTypes ||
                        bug.bugType || 
                        bug.type;

    // Also check common Azure DevOps field patterns
    const allPossibleFields = [
      bug.customFields?.['Bug types'],
      bug.customFields?.bugTypes,
      bug.fields?.['Custom.Bug types'],
      bug.fields?.['Custom.BugTypes'],
      bug.fields?.['Microsoft.VSTS.Common.BugType'],
      bug.fields?.['System.BugType'],
      bug.fields?.['Bug types'],
      bug.bugTypes,
      bug.bugType,
      bug.type
    ].filter(field => field && field.trim && field.trim() !== '');

    const actualBugTypeField = allPossibleFields[0] || bugTypeField;

    // Debug logging to see what fields are available
    if (process.env.NODE_ENV === 'development') {
      console.log('🐛 Bug classification debug:', {
        id: bug.id,
        title: bug.title?.substring(0, 50),
        availableFields: Object.keys(bug.fields || {}),
        customFields: Object.keys(bug.customFields || {}),
        bugTypeField,
        actualBugTypeField,
        tags: bug.tags,
        // Show actual field values for debugging
        fieldsStartingWithBug: Object.entries(bug.fields || {})
          .filter(([key]) => key.toLowerCase().includes('bug'))
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
        fieldsContainingType: Object.entries(bug.fields || {})
          .filter(([key]) => key.toLowerCase().includes('type'))
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      });
    }

    // Map Azure DevOps bug types to our classification
    const bugTypeMapping = {
      'PROD Issues': 'production',
      'Deploy Bug': 'deployment', 
      'SIT Bug': 'system_integration_test',
      'UAT Bug': 'user_acceptance_test',
      'Production Bug': 'production',
      'Deployment Bug': 'deployment',
      'Integration Bug': 'integration',
      'Regression Bug': 'regression',
      'Performance Bug': 'performance',
      'Security Bug': 'security',
      'Data Bug': 'data',
      'UI Bug': 'ui',
      'Functional': 'functional'
    };

    // If we have explicit bug type from Azure DevOps
    if (actualBugTypeField && bugTypeMapping[actualBugTypeField]) {
      return {
        type: bugTypeMapping[actualBugTypeField],
        originalType: actualBugTypeField,
        confidence: 1.0,
        source: 'azure_devops_field'
      };
    }

    // Fallback classification based on title and description
    const title = (bug.title || '').toLowerCase();
    const description = (bug.description || '').toLowerCase();
    const areaPath = (bug.areaPath || '').toLowerCase();

    // Pattern matching for bug types
    const typePatterns = {
      production: ['prod', 'production', 'live', 'customer facing', 'hotfix'],
      deployment: ['deploy', 'deployment', 'release', 'build', 'pipeline'],
      system_integration_test: ['sit', 'system integration', 'integration test'],
      user_acceptance_test: ['uat', 'user acceptance', 'acceptance test', 'user test'],
      regression: ['regression', 'previous feature', 'broke', 'working before'],
      performance: ['slow', 'timeout', 'performance', 'load', 'response time'],
      security: ['security', 'vulnerability', 'auth', 'permission', 'access'],
      data: ['data', 'database', 'corrupt', 'missing data', 'wrong data'],
      ui: ['ui', 'display', 'layout', 'visual', 'css', 'frontend'],
      integration: ['integration', 'api', 'external', 'third party', 'service']
    };

    // Check patterns
    for (const [type, patterns] of Object.entries(typePatterns)) {
      const patternMatch = patterns.some(pattern => 
        title.includes(pattern) || 
        description.includes(pattern) || 
        areaPath.includes(pattern)
      );
      
      if (patternMatch) {
        return {
          type,
          originalType: null,
          confidence: 0.7,
          source: 'pattern_matching'
        };
      }
    }

    // Default classification
    return {
      type: 'functional',
      originalType: null,
      confidence: 0.3,
      source: 'default'
    };
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(matches) {
    const trueMatches = matches.filter(match => match).length;
    const totalMatches = matches.length;
    return Math.round((trueMatches / totalMatches) * 100) / 100;
  }

  /**
   * Calculate overall classification score
   */
  calculateClassificationScore(classification) {
    const severityScore = classification.severity.confidence;
    const categoryScore = classification.category.confidence;
    const sourceScore = classification.source.confidence;
    const bugTypeScore = classification.bugType.confidence;
    
    return Math.round(((severityScore + categoryScore + sourceScore + bugTypeScore) / 4) * 100) / 100;
  }

  /**
   * Generate classification summary
   */
  generateClassificationSummary(bugs) {
    const summary = {
      severity: {},
      category: {},
      source: {},
      bugType: {},
      trends: {}
    };

    // Count by classification
    bugs.forEach(bug => {
      const { classification } = bug;
      
      // Severity summary
      const severity = classification.severity.level;
      summary.severity[severity] = (summary.severity[severity] || 0) + 1;
      
      // Category summary
      const category = classification.category.type;
      summary.category[category] = (summary.category[category] || 0) + 1;
      
      // Source summary
      const source = classification.source.type;
      summary.source[source] = (summary.source[source] || 0) + 1;

      // Bug Type summary
      const bugType = classification.bugType.type;
      summary.bugType[bugType] = (summary.bugType[bugType] || 0) + 1;
    });

    // Calculate percentages
    const total = bugs.length;
    Object.keys(summary.severity).forEach(key => {
      summary.severity[key] = {
        count: summary.severity[key],
        percentage: Math.round((summary.severity[key] / total) * 100)
      };
    });

    Object.keys(summary.category).forEach(key => {
      summary.category[key] = {
        count: summary.category[key],
        percentage: Math.round((summary.category[key] / total) * 100)
      };
    });

    Object.keys(summary.source).forEach(key => {
      summary.source[key] = {
        count: summary.source[key],
        percentage: Math.round((summary.source[key] / total) * 100)
      };
    });

    Object.keys(summary.bugType).forEach(key => {
      summary.bugType[key] = {
        count: summary.bugType[key],
        percentage: Math.round((summary.bugType[key] / total) * 100)
      };
    });

    // Generate trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentBugs = bugs.filter(bug => 
      new Date(bug.createdDate) >= thirtyDaysAgo
    );

    summary.trends = {
      totalBugs: total,
      recentBugs: recentBugs.length,
      recentPercentage: Math.round((recentBugs.length / total) * 100),
      averageClassificationScore: Math.round(
        bugs.reduce((sum, bug) => sum + bug.classificationScore, 0) / total * 100
      ) / 100
    };

    return summary;
  }

  /**
   * Get bug classification statistics
   */
  async getBugClassificationStats(options = {}) {
    try {
      const classifiedBugs = await this.getClassifiedBugs(options);
      
      return {
        summary: classifiedBugs.classification,
        totalBugs: classifiedBugs.totalCount,
        highSeverityBugs: classifiedBugs.bugs.filter(
          bug => bug.classification.severity.level === 'critical' || 
                 bug.classification.severity.level === 'high'
        ).length,
        timestamp: classifiedBugs.timestamp
      };
      
    } catch (error) {
      logger.error('Error getting bug classification stats:', error);
      throw error;
    }
  }

  /**
   * Export bug classification data
   */
  async exportBugClassification(format = 'json', options = {}) {
    try {
      const classifiedBugs = await this.getClassifiedBugs(options);
      
      if (format === 'csv') {
        return this.convertToCSV(classifiedBugs.bugs);
      }
      
      return classifiedBugs;
      
    } catch (error) {
      logger.error('Error exporting bug classification:', error);
      throw error;
    }
  }

  /**
   * Convert bugs to CSV format
   */
  convertToCSV(bugs) {
    const headers = [
      'ID', 'Title', 'State', 'Assignee', 'Priority', 
      'Severity', 'Category', 'Source', 'Bug Type', 'Original Bug Type', 
      'Classification Score', 'Created Date', 'Area Path', 'Tags'
    ];
    
    const rows = bugs.map(bug => [
      bug.id,
      bug.title,
      bug.state,
      bug.assignee,
      bug.priority,
      bug.classification.severity.level,
      bug.classification.category.type,
      bug.classification.source.type,
      bug.classification.bugType.type,
      bug.classification.bugType.originalType || '',
      bug.classificationScore,
      bug.createdDate,
      bug.areaPath,
      (bug.tags || []).join(';')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  /**
   * Static method to determine if a work item is bug-related
   * Uses the same logic as the full bug classification but returns boolean
   */
  static async isBugWorkItem(workItem) {
    // First check if it's explicitly a Bug work item type
    if (workItem.type === 'Bug') {
      return true;
    }

    // Extract text content for pattern matching
    const title = (workItem.title || '').toLowerCase();
    const description = (workItem.description || '').toLowerCase();
    const areaPath = (workItem.areaPath || '').toLowerCase();

    // Bug-related keywords and patterns
    const bugPatterns = [
      // Direct bug indicators
      'bug', 'defect', 'issue', 'problem', 'error', 'fail', 'broken',
      'fix', 'resolve', 'correct', 'repair', 'debug',
      
      // Specific bug types
      'prod', 'production', 'deploy', 'deployment', 'regression',
      'sit bug', 'uat bug', 'integration bug', 'performance bug',
      'security bug', 'ui bug', 'data bug',
      
      // Error conditions
      'crash', 'exception', 'timeout', 'hanging', 'freeze',
      'memory leak', 'null reference', 'index out of bounds',
      
      // Quality issues
      'incorrect', 'wrong', 'invalid', 'missing', 'duplicate',
      'not working', 'doesn\'t work', 'broken functionality'
    ];

    // Check if any bug patterns match in title, description, or area path
    const textToCheck = `${title} ${description} ${areaPath}`;
    const hasBugPattern = bugPatterns.some(pattern => textToCheck.includes(pattern));

    // Check Azure DevOps custom fields for bug type classification
    const customFields = workItem.customFields || {};
    const bugTypeFields = [
      'System.BugType',
      'Custom.BugType', 
      'Microsoft.VSTS.Common.BugType',
      'BugType'
    ];

    const hasBugTypeField = bugTypeFields.some(field => 
      customFields[field] && customFields[field].trim() !== ''
    );

    return hasBugPattern || hasBugTypeField;
  }
}

module.exports = BugClassificationService;