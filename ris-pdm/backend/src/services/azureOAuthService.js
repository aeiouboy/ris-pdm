/**
 * Azure DevOps OAuth 2.0 Authentication Service
 * 
 * Provides OAuth 2.0 authentication flow for Azure DevOps integration.
 * Implements automatic token refresh and secure token management.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const crypto = require('crypto');
const logger = require('../../utils/logger').child({ component: 'AzureOAuthService' });

/**
 * Azure DevOps OAuth 2.0 Service
 * Handles authentication flow and token management
 */
class AzureOAuthService {
  constructor(config = {}) {
    this.clientId = config.clientId || process.env.AZURE_OAUTH_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.AZURE_OAUTH_CLIENT_SECRET;
    this.redirectUri = config.redirectUri || process.env.AZURE_OAUTH_REDIRECT_URI;
    this.scopes = config.scopes || ['vso.work', 'vso.project'];
    
    // OAuth endpoints
    this.authBaseUrl = 'https://app.vssps.visualstudio.com/oauth2/authorize';
    this.tokenUrl = 'https://app.vssps.visualstudio.com/oauth2/token';
    
    // Token storage
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    this.validateConfig();
  }

  /**
   * Validate OAuth configuration
   */
  validateConfig() {
    const required = ['clientId', 'clientSecret', 'redirectUri'];
    const missing = required.filter(field => !this[field]);
    
    if (missing.length > 0) {
      logger.warn(`Missing OAuth configuration: ${missing.join(', ')}`);
      logger.info('OAuth authentication will not be available. Using PAT fallback.');
    }
  }

  /**
   * Check if OAuth is properly configured
   * @returns {boolean} True if OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - Optional state parameter for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state = null) {
    if (!this.isConfigured()) {
      throw new Error('OAuth not configured. Please set AZURE_OAUTH_CLIENT_ID, AZURE_OAUTH_CLIENT_SECRET, and AZURE_OAUTH_REDIRECT_URI');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'Assertion',
      state: state || crypto.randomBytes(16).toString('hex'),
      scope: this.scopes.join(' '),
      redirect_uri: this.redirectUri
    });

    const authUrl = `${this.authBaseUrl}?${params.toString()}`;
    
    logger.info('Generated OAuth authorization URL', {
      clientId: this.clientId,
      scopes: this.scopes.join(' '),
      state: params.get('state')
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} authorizationCode - Authorization code from OAuth callback
   * @param {string} state - State parameter for validation
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(authorizationCode, state = null) {
    if (!this.isConfigured()) {
      throw new Error('OAuth not configured');
    }

    try {
      const tokenData = {
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.clientSecret,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: authorizationCode,
        redirect_uri: this.redirectUri
      };

      const response = await this.makeTokenRequest(tokenData);
      
      // Store tokens
      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token;
      this.tokenExpiry = new Date(Date.now() + (response.expires_in * 1000));

      logger.info('OAuth token exchange successful', {
        expiresIn: response.expires_in,
        tokenType: response.token_type,
        scope: response.scope
      });

      return {
        success: true,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: response.expires_in,
        tokenType: response.token_type,
        scope: response.scope
      };

    } catch (error) {
      logger.error('OAuth token exchange failed:', error.message);
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get valid access token (refresh if needed)
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken() {
    // Check if token exists and is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try to refresh if we have a refresh token
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.accessToken;
      } catch (error) {
        logger.warn('Token refresh failed, authentication required');
        throw new Error('Authentication required: Token expired and refresh failed');
      }
    }

    throw new Error('Authentication required: No valid tokens available');
  }

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const tokenData = {
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: this.clientSecret,
        grant_type: 'refresh_token',
        assertion: this.refreshToken,
        redirect_uri: this.redirectUri
      };

      const response = await this.makeTokenRequest(tokenData);
      
      // Update tokens
      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token || this.refreshToken;
      this.tokenExpiry = new Date(Date.now() + (response.expires_in * 1000));

      logger.info('OAuth token refresh successful');
      return { success: true, accessToken: this.accessToken };

    } catch (error) {
      logger.error('OAuth token refresh failed:', error.message);
      this.clearTokens();
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Make token request to OAuth endpoint
   * @param {Object} tokenData - Token request data
   * @returns {Promise<Object>} Token response
   */
  async makeTokenRequest(tokenData) {
    const formData = new URLSearchParams(tokenData);
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    return await response.json();
  }

  /**
   * Clear stored tokens
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    logger.info('OAuth tokens cleared');
  }

  /**
   * Get current token status
   * @returns {Object} Token status information
   */
  getTokenStatus() {
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      tokenExpiry: this.tokenExpiry,
      isExpired: this.tokenExpiry ? new Date() >= this.tokenExpiry : null,
      isConfigured: this.isConfigured(),
      scopes: this.scopes
    };
  }

  /**
   * Health check for OAuth service
   * @returns {Object} Health status
   */
  healthCheck() {
    const status = this.getTokenStatus();
    
    return {
      service: 'AzureOAuthService',
      status: status.isConfigured ? 'configured' : 'not_configured',
      authentication: status.hasAccessToken ? 'authenticated' : 'not_authenticated',
      tokenExpiry: status.tokenExpiry,
      isExpired: status.isExpired,
      scopes: status.scopes,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AzureOAuthService;