// Azure services configuration

const azureConfig = {
  // Azure AD Configuration
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    tenantId: process.env.AZURE_TENANT_ID,
    authority: process.env.AZURE_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  },

  // Azure DevOps Configuration
  devops: {
    organization: process.env.AZURE_DEVOPS_ORG,
    project: process.env.AZURE_DEVOPS_PROJECT,
    personalAccessToken: process.env.AZURE_DEVOPS_PAT,
    apiVersion: '7.0',
    baseUrl: `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORG}`,
    endpoints: {
      workItems: 'wit/workitems',
      wiql: 'wit/wiql',
      iterations: 'work/teamsettings/iterations',
      areas: 'wit/classificationnodes/Areas',
      teams: 'teams',
      projects: 'projects',
    },
  },

  // Cache configuration for Azure data
  cache: {
    workItemsTTL: 300, // 5 minutes
    iterationsTTL: 3600, // 1 hour
    areasTTL: 3600, // 1 hour
    teamsTTL: 1800, // 30 minutes
  },

  // Rate limiting for Azure API calls
  rateLimiting: {
    maxRequestsPerMinute: 300,
    maxRequestsPerHour: 3000,
  },
};

// Validation function
function validateAzureConfig() {
  const requiredEnvVars = [
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_TENANT_ID',
    'AZURE_DEVOPS_ORG',
    'AZURE_DEVOPS_PROJECT',
    'AZURE_DEVOPS_PAT',
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required Azure configuration: ${missing.join(', ')}`);
  }

  return true;
}

module.exports = {
  azureConfig,
  validateAzureConfig,
};