/**
 * Comprehensive Cypress Custom Commands for RIS Performance Dashboard
 * These commands support the critical user journey tests
 */

// Authentication Commands
Cypress.Commands.add('mockAuth', () => {
  // Mock authentication token
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJuYW1lIjoiVGVzdCBVc2VyIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDAsInJvbGUiOiJhZG1pbiJ9.test-signature';
  
  cy.window().then((win) => {
    win.localStorage.setItem('auth_token', mockToken);
    win.localStorage.setItem('user_profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      email: 'test@company.com',
      role: 'admin'
    }));
  });
});

Cypress.Commands.add('handleAuthentication', () => {
  // Handle different authentication scenarios
  cy.url().then((url) => {
    if (url.includes('/login')) {
      // Mock login process
      cy.get('[data-testid="username"]').type('test@company.com');
      cy.get('[data-testid="password"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      // Wait for redirect
      cy.url().should('not.include', '/login');
    }
  });
  
  // Ensure auth token is available
  cy.mockAuth();
});

// API Intercept Setup
Cypress.Commands.add('setupAPIIntercepts', () => {
  // Core metrics endpoints
  cy.intercept('GET', '**/api/metrics/overview', { fixture: 'overview-metrics.json' }).as('getOverviewMetrics');
  cy.intercept('GET', '**/api/metrics/kpis', { fixture: 'kpi-metrics.json' }).as('getKPIs');
  cy.intercept('GET', '**/api/metrics/burndown', { fixture: 'burndown-data.json' }).as('getBurndown');
  cy.intercept('GET', '**/api/metrics/velocity', { fixture: 'velocity-data.json' }).as('getVelocity');
  cy.intercept('GET', '**/api/metrics/distribution', { fixture: 'distribution-data.json' }).as('getDistribution');
  cy.intercept('GET', '**/api/metrics/individual', { fixture: 'individual-metrics.json' }).as('getIndividualMetrics');
  
  // Work items endpoints
  cy.intercept('GET', '**/api/workitems**', { fixture: 'workitems.json' }).as('getWorkItems');
  cy.intercept('GET', '**/api/workitems/*', { fixture: 'workitem-detail.json' }).as('getWorkItemDetail');
  
  // Team and user endpoints
  cy.intercept('GET', '**/api/users', { fixture: 'team-members.json' }).as('getTeamMembers');
  cy.intercept('GET', '**/api/users/*', { fixture: 'user-detail.json' }).as('getUserDetail');
  
  // Export endpoints
  cy.intercept('GET', '**/api/exports/**', { 
    statusCode: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="dashboard-export.xlsx"'
    },
    body: 'mock-export-data'
  }).as('exportData');
  
  cy.intercept('GET', '**/api/exports/individual/**', {
    statusCode: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="individual-performance.pdf"'
    },
    body: 'mock-pdf-data'
  }).as('exportIndividual');
  
  // Health check
  cy.intercept('GET', '**/health', { 
    body: { status: 'OK', timestamp: new Date().toISOString() }
  }).as('healthCheck');
});

// Dashboard Interaction Commands
Cypress.Commands.add('waitForDashboard', (timeout = 10000) => {
  // Wait for key dashboard elements to be present and loaded
  cy.get('h1', { timeout }).should('contain', 'RIS Performance Dashboard');
  
  // Wait for main components to load
  cy.get('[data-testid="product-selector"]', { timeout }).should('be.visible');
  cy.get('[data-testid="sprint-filter"]', { timeout }).should('be.visible');
  cy.get('[data-testid="date-range-picker"]', { timeout }).should('be.visible');
  
  // Wait for KPI cards to load
  cy.get('[data-testid="pl-card"]', { timeout }).should('be.visible');
  cy.get('[data-testid="velocity-card"]', { timeout }).should('be.visible');
  cy.get('[data-testid="bug-card"]', { timeout }).should('be.visible');
  cy.get('[data-testid="satisfaction-card"]', { timeout }).should('be.visible');
  
  // Wait for loading states to complete
  cy.get('.animate-pulse', { timeout: 5000 }).should('not.exist');
});

Cypress.Commands.add('verifyDashboardComponents', () => {
  // Verify all major dashboard components are present
  const components = [
    'product-selector',
    'sprint-filter', 
    'date-range-picker',
    'export-buttons',
    'realtime-status',
    'pl-card',
    'velocity-card',
    'bug-card',
    'satisfaction-card',
    'burndown-chart',
    'velocity-chart',
    'distribution-chart'
  ];
  
  components.forEach(component => {
    cy.get(`[data-testid="${component}"]`).should('be.visible');
  });
});

Cypress.Commands.add('verifyKPICards', (expectedValues) => {
  Object.entries(expectedValues).forEach(([kpiType, values]) => {
    const cardSelector = `[data-testid="${kpiType}-card"]`;
    
    cy.get(cardSelector).within(() => {
      if (values.value) {
        cy.contains(values.value).should('be.visible');
      }
      if (values.trend) {
        cy.contains(values.trend).should('be.visible');
      }
    });
  });
});

Cypress.Commands.add('verifyCharts', (chartTypes) => {
  chartTypes.forEach(chartType => {
    cy.get(`[data-testid="${chartType}-chart"]`).should('be.visible');
    
    // Verify chart has rendered content (SVG or Canvas)
    cy.get(`[data-testid="${chartType}-chart"]`).within(() => {
      cy.get('svg, canvas').should('exist');
    });
  });
});

// Filter and Navigation Commands
Cypress.Commands.add('selectProduct', (productName) => {
  cy.get('[data-testid="product-selector"]').select(productName);
  
  // Wait for data to update
  cy.wait(['@getOverviewMetrics', '@getKPIs'], { timeout: 10000 });
});

Cypress.Commands.add('selectSprint', (sprintName) => {
  cy.get('[data-testid="sprint-filter"]').select(sprintName);
  
  // Wait for data to update
  cy.wait(['@getBurndown', '@getVelocity'], { timeout: 10000 });
});

Cypress.Commands.add('setDateRange', (startDate, endDate) => {
  cy.get('[data-testid="start-date"]').clear().type(startDate);
  cy.get('[data-testid="end-date"]').clear().type(endDate);
  
  // Trigger change event
  cy.get('[data-testid="end-date"]').blur();
  
  // Wait for data refresh
  cy.wait('@getOverviewMetrics', { timeout: 10000 });
});

Cypress.Commands.add('navigateToPage', (pageName) => {
  const pageRoutes = {
    'dashboard': '/',
    'individual-performance': '/individual',
    'reports': '/reports',
    'workitems': '/workitems'
  };
  
  const route = pageRoutes[pageName];
  if (route) {
    cy.visit(route);
  } else {
    // Use navigation links
    cy.get(`[data-testid="nav-${pageName}"]`).click();
  }
});

// Export Commands
Cypress.Commands.add('exportDashboard', (format) => {
  cy.get('[data-testid="export-buttons"]').within(() => {
    cy.get(`button[data-format="${format}"]`).click();
  });
  
  // Wait for export to initiate
  cy.wait('@exportData', { timeout: 15000 });
});

// Individual Performance Commands
Cypress.Commands.add('verifyIndividualMetrics', (expectedMetrics) => {
  Object.entries(expectedMetrics).forEach(([metric, assertion]) => {
    cy.get(`[data-testid="individual-${metric}"]`).should(assertion);
  });
});

Cypress.Commands.add('selectTimePeriod', (period) => {
  cy.get('[data-testid="time-period-selector"]').select(period);
  cy.wait('@getIndividualMetrics', { timeout: 10000 });
});

Cypress.Commands.add('selectTeamMembers', (memberNames) => {
  memberNames.forEach(name => {
    cy.get('[data-testid="member-selector"]').within(() => {
      cy.contains(name).click();
    });
  });
});

// Responsive Design Testing Commands
Cypress.Commands.add('testResponsiveLayout', () => {
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop Large' },
    { width: 1024, height: 768, name: 'Desktop Small' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 375, height: 667, name: 'Mobile' }
  ];
  
  viewports.forEach(viewport => {
    cy.viewport(viewport.width, viewport.height);
    
    // Verify key elements are still accessible
    cy.get('h1').should('be.visible');
    cy.get('[data-testid="product-selector"]').should('be.visible');
    
    if (viewport.width < 768) {
      // Mobile-specific checks
      cy.get('[data-testid="mobile-menu"]').should('exist');
    }
  });
  
  // Reset to default viewport
  cy.viewport(1280, 720);
});

// Data Verification Commands
Cypress.Commands.add('verifyFilteredData', (filters) => {
  // Verify that the data reflects the applied filters
  cy.get('[data-testid="metadata-display"]').within(() => {
    if (filters.productId) {
      cy.contains(filters.productId).should('be.visible');
    }
    if (filters.sprintId) {
      cy.contains(filters.sprintId).should('be.visible');
    }
    if (filters.dateRange) {
      cy.contains(filters.dateRange).should('be.visible');
    }
  });
});

// WebSocket and Real-time Commands
Cypress.Commands.add('mockWebSocket', (connected = true) => {
  cy.window().then((win) => {
    // Mock WebSocket connection status
    win.mockWebSocketStatus = connected;
    
    // Dispatch custom event to simulate connection change
    win.dispatchEvent(new CustomEvent('websocket-status-change', {
      detail: { connected }
    }));
  });
});

Cypress.Commands.add('simulateRealtimeUpdate', (data) => {
  cy.window().then((win) => {
    // Simulate real-time data update
    win.dispatchEvent(new CustomEvent('realtime-metrics-update', {
      detail: data
    }));
  });
});

// Error Simulation Commands
Cypress.Commands.add('simulateAPIError', (endpoint, statusCode) => {
  cy.intercept('GET', `**${endpoint}`, {
    statusCode: statusCode,
    body: { error: 'Simulated API error', code: 'TEST_ERROR' }
  }).as(`errorFor${endpoint.replace(/[^a-zA-Z0-9]/g, '')}`);
});

Cypress.Commands.add('simulateNetworkDelay', (endpoint, delay) => {
  cy.intercept('GET', `**${endpoint}`, (req) => {
    req.reply((res) => {
      return new Promise(resolve => {
        setTimeout(() => resolve(res.send({ fixture: 'overview-metrics.json' })), delay);
      });
    });
  });
});

// Performance Testing Commands
Cypress.Commands.add('measurePageLoad', () => {
  cy.window().then((win) => {
    return new Promise((resolve) => {
      if (win.performance && win.performance.timing) {
        const timing = win.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        
        cy.log(`Page load time: ${loadTime}ms`);
        expect(loadTime).to.be.lessThan(5000); // 5 seconds max
        
        resolve(loadTime);
      } else {
        cy.log('Performance timing not available');
        resolve(0);
      }
    });
  });
});

// Accessibility Commands
Cypress.Commands.add('checkAccessibility', () => {
  // Basic accessibility checks
  cy.get('h1').should('exist'); // Page should have main heading
  cy.get('[alt]').each(($el) => {
    // Images should have alt text
    expect($el.attr('alt')).to.not.be.empty;
  });
  
  // Check for skip links
  cy.get('body').then(($body) => {
    if ($body.find('a[href="#main-content"]').length > 0) {
      cy.get('a[href="#main-content"]').should('exist');
    }
  });
  
  // Check for proper focus management
  cy.get('button, a, input, select, textarea').each(($el) => {
    cy.wrap($el).should('not.have.css', 'outline', 'none');
  });
});

// Cleanup Commands
Cypress.Commands.add('cleanupTest', () => {
  // Clear any timers or intervals that might be running
  cy.window().then((win) => {
    // Clear any test-specific state
    if (win.testCleanup) {
      win.testCleanup();
    }
  });
  
  // Clear localStorage and sessionStorage
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Utility Commands
Cypress.Commands.add('waitForStableDOM', (timeout = 5000) => {
  // Wait for DOM to stabilize (no more mutations)
  cy.window().then((win) => {
    return new Promise((resolve) => {
      let timeoutId;
      const observer = new win.MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 100);
      });
      
      observer.observe(win.document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      
      // Initial timeout
      timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 100);
      
      // Maximum wait time
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  });
});

Cypress.Commands.add('verifyNoJSErrors', () => {
  cy.window().then((win) => {
    expect(win.console.error).to.not.have.been.called;
  });
});

// Custom assertions
Cypress.Commands.add('shouldBeWithinRange', { prevSubject: true }, (subject, min, max) => {
  const value = parseFloat(subject.text());
  expect(value).to.be.within(min, max);
  return cy.wrap(subject);
});

Cypress.Commands.add('shouldHaveValidDate', { prevSubject: true }, (subject) => {
  const dateText = subject.text();
  const date = new Date(dateText);
  expect(date).to.be.a('date');
  expect(date.toString()).to.not.equal('Invalid Date');
  return cy.wrap(subject);
});

// Add to commands file
Cypress.Commands.add('tab', { prevSubject: 'optional' }, (subject) => {
  const tabKey = { keyCode: 9, which: 9, key: 'Tab' };
  
  if (subject) {
    cy.wrap(subject).trigger('keydown', tabKey);
  } else {
    cy.focused().trigger('keydown', tabKey);
  }
});

// Debug helpers
Cypress.Commands.add('debugState', () => {
  cy.window().then((win) => {
    cy.log('Current URL:', win.location.href);
    cy.log('Local Storage:', win.localStorage);
    cy.log('Session Storage:', win.sessionStorage);
  });
});

Cypress.Commands.add('takeScreenshotOnFailure', () => {
  cy.screenshot(`failure-${Date.now()}`);
});