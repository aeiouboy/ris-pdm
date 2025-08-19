// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom commands for RIS Performance Dashboard

// Login command
Cypress.Commands.add('login', (email = 'test@company.com', password = 'password123') => {
  cy.log('Logging in user');
  
  // Mock authentication for testing
  cy.window().then((win) => {
    win.localStorage.setItem('authToken', 'mock-jwt-token');
    win.localStorage.setItem('user', JSON.stringify({
      id: 'test-user-id',
      email,
      displayName: 'Test User',
      role: 'admin'
    }));
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.log('Logging out user');
  
  cy.window().then((win) => {
    win.localStorage.removeItem('authToken');
    win.localStorage.removeItem('user');
  });
});

// Check authentication state
Cypress.Commands.add('checkAuthState', (shouldBeAuthenticated = true) => {
  cy.window().then((win) => {
    const token = win.localStorage.getItem('authToken');
    if (shouldBeAuthenticated) {
      expect(token).to.exist;
    } else {
      expect(token).to.be.null;
    }
  });
});

// Wait for dashboard to load
Cypress.Commands.add('waitForDashboard', () => {
  cy.log('Waiting for dashboard to load');
  
  // Wait for main heading
  cy.get('h1').contains('RIS Performance Dashboard').should('be.visible');
  
  // Wait for API calls to complete
  cy.wait(['@getKPIs', '@getBurndown', '@getVelocity', '@getDistribution']);
  
  // Wait for loading indicators to disappear
  cy.get('[data-testid="loading"]').should('not.exist');
  cy.get('.animate-pulse').should('not.exist');
});

// Select product filter
Cypress.Commands.add('selectProduct', (productId) => {
  cy.log(`Selecting product: ${productId}`);
  
  cy.get('[data-testid="product-selector"]').select(productId);
  cy.wait('@getKPIs'); // Wait for data to reload
});

// Select sprint filter
Cypress.Commands.add('selectSprint', (sprintId) => {
  cy.log(`Selecting sprint: ${sprintId}`);
  
  cy.get('[data-testid="sprint-filter"]').select(sprintId);
  cy.wait('@getKPIs'); // Wait for data to reload
});

// Set date range
Cypress.Commands.add('setDateRange', (startDate, endDate) => {
  cy.log(`Setting date range: ${startDate} to ${endDate}`);
  
  if (startDate) {
    cy.get('[data-testid="start-date"]').clear().type(startDate);
  }
  if (endDate) {
    cy.get('[data-testid="end-date"]').clear().type(endDate);
  }
  
  cy.wait('@getKPIs'); // Wait for data to reload
});

// Check KPI card values
Cypress.Commands.add('verifyKPICard', (cardTestId, expectedValue) => {
  cy.log(`Verifying KPI card ${cardTestId} has value ${expectedValue}`);
  
  cy.get(`[data-testid="${cardTestId}"]`)
    .should('be.visible')
    .and('contain', expectedValue);
});

// Check chart presence
Cypress.Commands.add('verifyChart', (chartTestId) => {
  cy.log(`Verifying chart ${chartTestId} is visible`);
  
  cy.get(`[data-testid="${chartTestId}"]`)
    .should('be.visible')
    .and('not.be.empty');
});

// Export data
Cypress.Commands.add('exportDashboard', (format = 'xlsx') => {
  cy.log(`Exporting dashboard as ${format}`);
  
  cy.get('[data-testid="export-buttons"]')
    .contains(format.toUpperCase())
    .click();
  
  cy.wait('@exportData');
});

// Check responsive design
Cypress.Commands.add('checkMobileLayout', () => {
  cy.log('Checking mobile layout');
  
  cy.viewport('iphone-x');
  cy.get('h1').contains('RIS Performance Dashboard').should('be.visible');
  
  // Check that elements stack vertically on mobile
  cy.get('.grid').should('have.class', 'grid-cols-1');
});

// Check tablet layout
Cypress.Commands.add('checkTabletLayout', () => {
  cy.log('Checking tablet layout');
  
  cy.viewport('ipad-2');
  cy.get('h1').contains('RIS Performance Dashboard').should('be.visible');
});

// Check desktop layout
Cypress.Commands.add('checkDesktopLayout', () => {
  cy.log('Checking desktop layout');
  
  cy.viewport(1280, 720);
  cy.get('h1').contains('RIS Performance Dashboard').should('be.visible');
});

// Navigate to page
Cypress.Commands.add('navigateToPage', (pageName) => {
  cy.log(`Navigating to ${pageName} page`);
  
  const pageRoutes = {
    'dashboard': '/',
    'individual-performance': '/individual',
    'reports': '/reports'
  };
  
  const route = pageRoutes[pageName];
  if (route) {
    cy.visit(route);
  } else {
    throw new Error(`Unknown page: ${pageName}`);
  }
});

// Mock WebSocket connection
Cypress.Commands.add('mockWebSocket', (connected = true) => {
  cy.log(`Mocking WebSocket connection: ${connected ? 'connected' : 'disconnected'}`);
  
  cy.window().then((win) => {
    // Mock Socket.IO client
    const mockSocket = {
      connected,
      connect: cy.stub(),
      disconnect: cy.stub(),
      on: cy.stub(),
      off: cy.stub(),
      emit: cy.stub()
    };
    
    win.mockSocket = mockSocket;
  });
});

// Simulate real-time data updates
Cypress.Commands.add('simulateRealtimeUpdate', (data) => {
  cy.log('Simulating real-time data update');
  
  cy.window().then((win) => {
    if (win.mockSocket) {
      // Trigger the 'metricsUpdate' event
      const callbacks = win.mockSocket.on.getCalls()
        .filter(call => call.args[0] === 'metricsUpdate')
        .map(call => call.args[1]);
      
      callbacks.forEach(callback => callback(data));
    }
  });
});

// Performance testing helpers
Cypress.Commands.add('measurePageLoad', () => {
  cy.log('Measuring page load performance');
  
  let startTime;
  
  cy.window().then((win) => {
    startTime = win.performance.now();
  });
  
  cy.waitForDashboard();
  
  cy.window().then((win) => {
    const endTime = win.performance.now();
    const loadTime = endTime - startTime;
    
    cy.log(`Page load time: ${loadTime}ms`);
    
    // Assert reasonable load time (less than 3 seconds)
    expect(loadTime).to.be.lessThan(3000);
  });
});

// Accessibility testing helpers
Cypress.Commands.add('checkAccessibility', () => {
  cy.log('Checking accessibility');
  
  // Check for proper heading hierarchy
  cy.get('h1').should('exist').and('be.visible');
  
  // Check for focus management
  cy.get('button:first').focus();
  cy.focused().should('exist');
  
  // Check for proper alt text on images
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });
});

// Error simulation
Cypress.Commands.add('simulateAPIError', (endpoint, statusCode = 500) => {
  cy.log(`Simulating API error for ${endpoint}: ${statusCode}`);
  
  cy.intercept('GET', `**${endpoint}`, {
    statusCode,
    body: { error: 'Simulated error for testing' }
  }).as(`errorFor${endpoint.replace(/[^a-zA-Z]/g, '')}`);
});