// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES6 syntax:
import './commands';

// Import coverage support
import '@cypress/code-coverage/support';

// Hide fetch/XHR requests from command log
Cypress.on('window:before:load', (win) => {
  // Stub console methods to reduce noise in tests
  cy.stub(win.console, 'log');
  cy.stub(win.console, 'warn');
});

// Global test configuration
beforeEach(() => {
  // Set viewport for consistent testing
  cy.viewport(1280, 720);
  
  // Intercept and stub API calls by default
  cy.intercept('GET', '**/api/metrics/overview', { fixture: 'overview-metrics.json' }).as('getOverview');
  cy.intercept('GET', '**/api/metrics/kpis*', { fixture: 'kpi-metrics.json' }).as('getKPIs');
  cy.intercept('GET', '**/api/metrics/burndown*', { fixture: 'burndown-data.json' }).as('getBurndown');
  cy.intercept('GET', '**/api/metrics/velocity-trend*', { fixture: 'velocity-data.json' }).as('getVelocity');
  cy.intercept('GET', '**/api/metrics/task-distribution*', { fixture: 'distribution-data.json' }).as('getDistribution');
  cy.intercept('GET', '**/api/workitems*', { fixture: 'workitems.json' }).as('getWorkItems');
  cy.intercept('GET', '**/api/users', { fixture: 'users.json' }).as('getUsers');
  cy.intercept('POST', '**/api/exports/**', { fixture: 'export-response.json' }).as('exportData');
});

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // for certain expected errors
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  if (err.message.includes('Non-Error promise rejection captured')) {
    return false;
  }
  if (err.message.includes('Network Error')) {
    return false;
  }
  
  // Let other errors fail the test
  return true;
});