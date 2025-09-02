@description('The name of the App Service app')
param appName string = 'ris-dashboard'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The pricing tier for the App Service plan')
@allowed([
  'F1'
  'D1'
  'B1'
  'B2'
  'B3'
  'S1'
  'S2'
  'S3'
  'P1'
  'P2'
  'P3'
  'P1V2'
  'P2V2'
  'P3V2'
])
param skuName string = 'P1V2'

@description('Azure DevOps organization name')
param azureDevOpsOrg string

@description('Azure DevOps project name')
param azureDevOpsProject string

@description('Azure DevOps Personal Access Token')
@secure()
param azureDevOpsPat string

@description('Redis connection string')
@secure()
param redisConnectionString string

@description('Database connection string')
@secure()
param databaseConnectionString string

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: skuName
    capacity: 2
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// Backend App Service
resource backendAppService 'Microsoft.Web/sites@2021-02-01' = {
  name: '${appName}-backend'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|ghcr.io/ris-product/dashboard-backend:latest'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '3001'
        }
        {
          name: 'AZURE_DEVOPS_ORG'
          value: azureDevOpsOrg
        }
        {
          name: 'AZURE_DEVOPS_PROJECT'
          value: azureDevOpsProject
        }
        {
          name: 'AZURE_DEVOPS_PAT'
          value: azureDevOpsPat
        }
        {
          name: 'REDIS_URL'
          value: redisConnectionString
        }
        {
          name: 'DATABASE_URL'
          value: databaseConnectionString
        }
        {
          name: 'CORS_ORIGIN'
          value: 'https://${appName}-frontend.azurewebsites.net'
        }
        {
          name: 'RATE_LIMIT_WINDOW_MS'
          value: '900000'
        }
        {
          name: 'RATE_LIMIT_MAX_REQUESTS'
          value: '100'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://ghcr.io'
        }
      ]
      healthCheckPath: '/health'
    }
    httpsOnly: true
  }
}

// Frontend App Service
resource frontendAppService 'Microsoft.Web/sites@2021-02-01' = {
  name: '${appName}-frontend'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|ghcr.io/ris-product/dashboard-frontend:latest'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'VITE_API_BASE_URL'
          value: 'https://${appName}-backend.azurewebsites.net'
        }
        {
          name: 'VITE_WS_URL'
          value: 'wss://${appName}-backend.azurewebsites.net'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://ghcr.io'
        }
      ]
      healthCheckPath: '/health'
    }
    httpsOnly: true
  }
}

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
  }
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Azure Cache for Redis
resource redisCache 'Microsoft.Cache/Redis@2021-06-01' = {
  name: '${appName}-redis'
  location: location
  properties: {
    sku: {
      name: 'Standard'
      family: 'C'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

output backendUrl string = 'https://${backendAppService.properties.defaultHostName}'
output frontendUrl string = 'https://${frontendAppService.properties.defaultHostName}'
output redisHostName string = redisCache.properties.hostName
output instrumentationKey string = applicationInsights.properties.InstrumentationKey