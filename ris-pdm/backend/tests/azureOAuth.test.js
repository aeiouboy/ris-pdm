/**
 * Azure OAuth Service Tests
 * 
 * Comprehensive test suite for Azure DevOps OAuth 2.0 authentication implementation.
 * Tests OAuth flow, token management, and service integration.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const AzureOAuthService = require('../src/services/azureOAuthService');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const { factory } = require('../src/services/azureDevOpsServiceFactory');
const nock = require('nock');
const crypto = require('crypto');

describe('Azure OAuth Service', () => {
  let oauthService;
  
  beforeEach(() => {
    // Mock environment variables
    process.env.AZURE_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.AZURE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.AZURE_OAUTH_REDIRECT_URI = 'http://localhost:3002/auth/azure/callback';
    
    oauthService = new AzureOAuthService({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
    });
  });

  afterEach(() => {
    // Clean up nock interceptors
    nock.cleanAll();
    
    // Clear tokens
    oauthService.clearAllTokens();
    
    // Reset environment
    delete process.env.AZURE_OAUTH_CLIENT_ID;
    delete process.env.AZURE_OAUTH_CLIENT_SECRET;
    delete process.env.AZURE_OAUTH_REDIRECT_URI;
  });

  describe('Configuration', () => {
    test('should validate OAuth configuration', () => {
      const validation = oauthService.validateConfiguration();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.configuration.clientId).toBe('configured');
      expect(validation.configuration.clientSecret).toBe('configured');
    });

    test('should detect missing client ID', () => {
      const service = new AzureOAuthService({ clientId: null });
      const validation = service.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('AZURE_OAUTH_CLIENT_ID is required');
    });

    test('should detect missing client secret', () => {
      const service = new AzureOAuthService({ clientSecret: null });
      const validation = service.validateConfiguration();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('AZURE_OAUTH_CLIENT_SECRET is required');
    });

    test('should warn about non-HTTPS redirect URI', () => {
      const service = new AzureOAuthService({ 
        redirectUri: 'http://example.com/callback' 
      });
      const validation = service.validateConfiguration();
      
      expect(validation.warnings).toContain('Redirect URI should use HTTPS in production');
    });
  });

  describe('PKCE Parameters', () => {
    test('should generate valid PKCE parameters', () => {
      const pkceParams = oauthService.generatePKCEParameters();
      
      expect(pkceParams).toHaveProperty('code_verifier');
      expect(pkceParams).toHaveProperty('code_challenge');
      expect(pkceParams).toHaveProperty('code_challenge_method');
      expect(pkceParams.code_challenge_method).toBe('S256');
      
      // Verify challenge is properly encoded
      expect(pkceParams.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkceParams.code_challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkceParams.code_verifier.length).toBe(43); // Base64URL encoded 32 bytes
    });

    test('should generate different PKCE parameters each time', () => {
      const params1 = oauthService.generatePKCEParameters();
      const params2 = oauthService.generatePKCEParameters();
      
      expect(params1.code_verifier).not.toBe(params2.code_verifier);
      expect(params1.code_challenge).not.toBe(params2.code_challenge);
    });
  });

  describe('Authorization URL Generation', () => {
    test('should generate authorization URL with PKCE', () => {
      const result = oauthService.getAuthorizationUrl();
      
      expect(result).toHaveProperty('authorizationUrl');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('flowData');
      
      const url = new URL(result.authorizationUrl);
      expect(url.hostname).toBe('app.vssps.visualstudio.com');
      expect(url.pathname).toBe('/oauth2/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('vso.work_write vso.project vso.profile');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    test('should use provided state parameter', () => {
      const customState = 'custom-state-123';
      const result = oauthService.getAuthorizationUrl(customState);
      
      expect(result.state).toBe(customState);
      
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get('state')).toBe(customState);
    });

    test('should include custom scopes', () => {
      const service = new AzureOAuthService({
        scopes: 'vso.work vso.profile'
      });
      
      const result = service.getAuthorizationUrl();
      const url = new URL(result.authorizationUrl);
      
      expect(url.searchParams.get('scope')).toBe('vso.work vso.profile');
    });
  });

  describe('Token Exchange', () => {
    test('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      // Mock the token endpoint
      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(200, mockTokenResponse);

      const flowData = {
        state: 'test-state',
        redirect_uri: 'http://localhost:3002/auth/azure/callback',
        code_verifier: 'test-code-verifier'
      };

      const tokenData = await oauthService.exchangeCodeForToken(
        'test-auth-code',
        'test-state',
        flowData
      );

      expect(tokenData.access_token).toBe('test-access-token');
      expect(tokenData.refresh_token).toBe('test-refresh-token');
      expect(tokenData.expires_in).toBe(3600);
      expect(tokenData).toHaveProperty('received_at');
      expect(tokenData).toHaveProperty('expires_at');
    });

    test('should reject invalid state parameter', async () => {
      const flowData = {
        state: 'valid-state',
        redirect_uri: 'http://localhost:3002/auth/azure/callback'
      };

      await expect(
        oauthService.exchangeCodeForToken('auth-code', 'invalid-state', flowData)
      ).rejects.toThrow('Invalid state parameter - possible CSRF attack');
    });

    test('should handle token exchange errors', async () => {
      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(400, { error: 'invalid_request', error_description: 'Invalid authorization code' });

      const flowData = {
        state: 'test-state',
        redirect_uri: 'http://localhost:3002/auth/azure/callback'
      };

      await expect(
        oauthService.exchangeCodeForToken('invalid-code', 'test-state', flowData)
      ).rejects.toThrow('OAuth token exchange failed');
    });
  });

  describe('Token Refresh', () => {
    test('should refresh access token', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(200, mockRefreshResponse);

      const tokenData = await oauthService.refreshAccessToken('refresh-token');

      expect(tokenData.access_token).toBe('new-access-token');
      expect(tokenData.refresh_token).toBe('new-refresh-token');
      expect(tokenData).toHaveProperty('received_at');
      expect(tokenData).toHaveProperty('expires_at');
    });

    test('should handle refresh token errors', async () => {
      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(400, { error: 'invalid_grant', error_description: 'Refresh token expired' });

      await expect(
        oauthService.refreshAccessToken('expired-refresh-token')
      ).rejects.toThrow('OAuth token refresh failed');
    });
  });

  describe('Token Storage', () => {
    const mockTokenData = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    test('should store and retrieve tokens', () => {
      const userId = 'test-user-123';
      
      oauthService.storeTokens(userId, mockTokenData);
      const storedTokens = oauthService.getStoredTokens(userId);
      
      expect(storedTokens.access_token).toBe(mockTokenData.access_token);
      expect(storedTokens.refresh_token).toBe(mockTokenData.refresh_token);
      expect(storedTokens).toHaveProperty('stored_at');
    });

    test('should return null for non-existent user', () => {
      const tokens = oauthService.getStoredTokens('non-existent-user');
      expect(tokens).toBeNull();
    });

    test('should detect expired tokens', () => {
      const expiredTokenData = {
        ...mockTokenData,
        expires_at: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
      };
      
      expect(oauthService.isTokenExpired(expiredTokenData)).toBe(true);
    });

    test('should detect tokens expiring soon', () => {
      const soonToExpireTokenData = {
        ...mockTokenData,
        expires_at: new Date(Date.now() + 60000).toISOString() // Expires in 1 minute
      };
      
      expect(oauthService.isTokenExpired(soonToExpireTokenData)).toBe(true);
    });

    test('should detect valid tokens', () => {
      const validTokenData = {
        ...mockTokenData,
        expires_at: new Date(Date.now() + 3600000).toISOString() // Expires in 1 hour
      };
      
      expect(oauthService.isTokenExpired(validTokenData)).toBe(false);
    });
  });

  describe('Valid Access Token Retrieval', () => {
    test('should return valid access token', async () => {
      const userId = 'test-user';
      const tokenData = {
        access_token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };
      
      oauthService.storeTokens(userId, tokenData);
      
      const accessToken = await oauthService.getValidAccessToken(userId);
      expect(accessToken).toBe('valid-token');
    });

    test('should refresh expired token automatically', async () => {
      const userId = 'test-user';
      const expiredTokenData = {
        access_token: 'expired-token',
        refresh_token: 'valid-refresh-token',
        expires_at: new Date(Date.now() - 1000).toISOString()
      };
      
      const newTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(200, newTokenResponse);
      
      oauthService.storeTokens(userId, expiredTokenData);
      
      const accessToken = await oauthService.getValidAccessToken(userId);
      expect(accessToken).toBe('new-access-token');
    });

    test('should return null for user without tokens', async () => {
      const accessToken = await oauthService.getValidAccessToken('non-existent-user');
      expect(accessToken).toBeNull();
    });
  });

  describe('Token Revocation', () => {
    test('should revoke tokens for user', async () => {
      const userId = 'test-user';
      const tokenData = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      };
      
      oauthService.storeTokens(userId, tokenData);
      expect(oauthService.getStoredTokens(userId)).toBeTruthy();
      
      const success = await oauthService.revokeToken(userId);
      
      expect(success).toBe(true);
      expect(oauthService.getStoredTokens(userId)).toBeNull();
    });

    test('should handle revocation for non-existent user', async () => {
      const success = await oauthService.revokeToken('non-existent-user');
      expect(success).toBe(true);
    });
  });

  describe('Service Health', () => {
    test('should return service health information', () => {
      const health = oauthService.getServiceHealth();
      
      expect(health).toHaveProperty('service');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('configuration');
      expect(health).toHaveProperty('statistics');
      
      expect(health.service).toBe('AzureOAuthService');
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('1.0.0');
      expect(health.configuration.clientId).toBe('configured');
    });
  });

  describe('Azure DevOps Service Integration', () => {
    test('should create Azure DevOps service with OAuth', async () => {
      // Set up OAuth service in factory
      factory.setOAuthService(oauthService);
      
      // Store valid tokens
      const userId = 'test-user';
      const tokenData = {
        access_token: 'valid-oauth-token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };
      oauthService.storeTokens(userId, tokenData);
      
      // Create service with OAuth
      const service = factory.createForUser(userId);
      
      expect(service).toBeInstanceOf(AzureDevOpsService);
      expect(service.authType).toBe('OAuth');
      expect(service.userId).toBe(userId);
      expect(service.oauthService).toBe(oauthService);
    });

    test('should make authenticated API requests with OAuth', async () => {
      // Set up OAuth service in factory
      factory.setOAuthService(oauthService);
      
      // Store valid tokens
      const userId = 'test-user';
      const tokenData = {
        access_token: 'valid-oauth-token',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };
      oauthService.storeTokens(userId, tokenData);
      
      // Create service with OAuth
      const service = factory.createForUser(userId);
      
      // Get auth headers
      const authHeaders = await service.getAuthHeaders();
      
      expect(authHeaders.Authorization).toBe('Bearer valid-oauth-token');
      expect(authHeaders['Content-Type']).toBe('application/json');
      expect(authHeaders['Accept']).toBe('application/json');
    });

    test('should fail OAuth authentication with invalid token', async () => {
      // Set up OAuth service in factory
      factory.setOAuthService(oauthService);
      
      // Create service for user without tokens
      const service = factory.createForUser('user-without-tokens');
      
      await expect(service.getAuthHeaders()).rejects.toThrow(
        'OAuth authentication failed: No valid access token'
      );
    });

    test('should refresh expired OAuth token during API request', async () => {
      // Set up OAuth service in factory
      factory.setOAuthService(oauthService);
      
      // Store expired tokens with refresh capability
      const userId = 'test-user';
      const expiredTokenData = {
        access_token: 'expired-token',
        refresh_token: 'valid-refresh-token',
        expires_at: new Date(Date.now() - 1000).toISOString()
      };
      oauthService.storeTokens(userId, expiredTokenData);
      
      // Mock refresh token endpoint
      const newTokenResponse = {
        access_token: 'refreshed-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      nock('https://app.vssps.visualstudio.com')
        .post('/oauth2/token')
        .reply(200, newTokenResponse);
      
      // Create service and make request
      const service = factory.createForUser(userId);
      const authHeaders = await service.getAuthHeaders();
      
      expect(authHeaders.Authorization).toBe('Bearer refreshed-access-token');
    });
  });
});

describe('Azure DevOps Service Factory OAuth Integration', () => {
  let factory;
  let oauthService;
  
  beforeEach(() => {
    const { factory: serviceFactory } = require('../src/services/azureDevOpsServiceFactory');
    factory = serviceFactory;
    
    oauthService = new AzureOAuthService({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
    });
    
    factory.setOAuthService(oauthService);
  });

  afterEach(() => {
    factory.clearAll();
    oauthService.clearAllTokens();
  });

  test('should create OAuth-enabled service instance', () => {
    const userId = 'test-user';
    const service = factory.createForUser(userId);
    
    expect(service.authType).toBe('OAuth');
    expect(service.userId).toBe(userId);
    expect(service.oauthService).toBe(oauthService);
  });

  test('should throw error when OAuth service not configured', () => {
    const { AzureDevOpsServiceFactory } = require('../src/services/azureDevOpsServiceFactory');
    const newFactory = new AzureDevOpsServiceFactory();
    
    expect(() => {
      newFactory.createForUser('test-user');
    }).toThrow('OAuth service not configured. Call setOAuthService() first.');
  });

  test('should cache OAuth service instances by user', () => {
    const userId1 = 'user-1';
    const userId2 = 'user-2';
    
    const service1a = factory.createForUser(userId1);
    const service1b = factory.createForUser(userId1);
    const service2 = factory.createForUser(userId2);
    
    expect(service1a).toBe(service1b); // Same instance for same user
    expect(service1a).not.toBe(service2); // Different instances for different users
  });
});