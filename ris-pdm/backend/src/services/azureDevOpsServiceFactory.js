/**
 * Azure DevOps Service Factory
 * Creates and manages Azure DevOps service instances with different configurations
 */

const AzureDevOpsService = require('./azureDevOpsService');
const { azureDevOpsConfig, validateConfig, getEnvironmentConfig } = require('../config/azureDevOpsConfig');

class AzureDevOpsServiceFactory {
  constructor() {
    this.instances = new Map();
    this.defaultConfig = getEnvironmentConfig();
  }

  /**
   * Create or get cached service instance
   * @param {object} config - Optional configuration override
   * @param {string} instanceKey - Optional instance key for caching
   * @returns {AzureDevOpsService} Service instance
   */
  create(config = {}, instanceKey = 'default') {
    // Check if we already have an instance with this key
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey);
    }

    // Merge default config with provided config
    const serviceConfig = {
      ...this.defaultConfig,
      ...config
    };

    // Validate configuration
    const validation = validateConfig();
    if (!validation.isValid) {
      throw new Error(`Invalid Azure DevOps configuration: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Azure DevOps configuration warnings:', validation.warnings);
    }

    // Create new service instance
    const service = new AzureDevOpsService(serviceConfig);
    
    // Cache the instance
    this.instances.set(instanceKey, service);
    
    console.log(`Created Azure DevOps service instance: ${instanceKey}`);
    return service;
  }

  /**
   * Create service instance for specific organization/project
   * @param {string} organization - Azure DevOps organization
   * @param {string} project - Azure DevOps project
   * @param {string} pat - Personal Access Token
   * @param {object} additionalConfig - Additional configuration
   * @returns {AzureDevOpsService} Service instance
   */
  createForProject(organization, project, pat, additionalConfig = {}) {
    const config = {
      organization,
      project,
      pat,
      ...additionalConfig
    };

    const instanceKey = `${organization}_${project}`;
    return this.create(config, instanceKey);
  }

  /**
   * Get existing service instance
   * @param {string} instanceKey - Instance key
   * @returns {AzureDevOpsService|null} Service instance or null if not found
   */
  get(instanceKey = 'default') {
    return this.instances.get(instanceKey) || null;
  }

  /**
   * Remove service instance from cache
   * @param {string} instanceKey - Instance key
   * @returns {boolean} True if instance was removed
   */
  remove(instanceKey) {
    return this.instances.delete(instanceKey);
  }

  /**
   * Clear all cached instances
   */
  clearAll() {
    this.instances.clear();
    console.log('Cleared all Azure DevOps service instances');
  }

  /**
   * Get health status of all instances
   * @returns {object} Health status
   */
  getHealthStatus() {
    const status = {
      totalInstances: this.instances.size,
      instances: {}
    };

    for (const [key, service] of this.instances) {
      status.instances[key] = service.getServiceHealth();
    }

    return status;
  }

  /**
   * Create service instance with performance monitoring
   * @param {object} config - Configuration
   * @param {string} instanceKey - Instance key
   * @returns {AzureDevOpsService} Monitored service instance
   */
  createWithMonitoring(config = {}, instanceKey = 'monitored') {
    const service = this.create(config, instanceKey);
    
    // Wrap service methods with performance monitoring
    const originalMethods = [
      'getWorkItems',
      'getWorkItemDetails', 
      'getIterations',
      'getTeamCapacity'
    ];

    originalMethods.forEach(methodName => {
      const originalMethod = service[methodName];
      service[methodName] = async function(...args) {
        const startTime = performance.now();
        try {
          const result = await originalMethod.apply(this, args);
          const duration = performance.now() - startTime;
          console.log(`[Performance] ${methodName} completed in ${duration.toFixed(2)}ms`);
          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          console.error(`[Performance] ${methodName} failed after ${duration.toFixed(2)}ms:`, error.message);
          throw error;
        }
      };
    });

    return service;
  }
}

// Export singleton instance
const factory = new AzureDevOpsServiceFactory();

module.exports = {
  AzureDevOpsServiceFactory,
  factory
};