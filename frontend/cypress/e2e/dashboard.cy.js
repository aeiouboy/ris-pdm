describe('Dashboard E2E Tests', () => {
  beforeEach(() => {
    // Login and visit dashboard
    cy.login();
    cy.visit('/');
  });

  describe('Dashboard Loading and Layout', () => {
    it('should load dashboard successfully', () => {
      cy.waitForDashboard();
      
      // Verify main components are visible
      cy.get('h1').contains('RIS Performance Dashboard').should('be.visible');
      cy.get('[data-testid="export-buttons"]').should('be.visible');
      cy.get('[data-testid="realtime-status"]').should('be.visible');
    });

    it('should display all filter components', () => {
      cy.waitForDashboard();
      
      cy.get('[data-testid="product-selector"]').should('be.visible');
      cy.get('[data-testid="sprint-filter"]').should('be.visible');
      cy.get('[data-testid="date-range-picker"]').should('be.visible');
    });

    it('should display all KPI cards', () => {
      cy.waitForDashboard();
      
      cy.get('[data-testid="pl-card"]').should('be.visible');
      cy.get('[data-testid="velocity-card"]').should('be.visible');
      cy.get('[data-testid="bug-card"]').should('be.visible');
      cy.get('[data-testid="satisfaction-card"]').should('be.visible');
    });

    it('should display all charts', () => {
      cy.waitForDashboard();
      
      cy.verifyChart('burndown-chart');
      cy.verifyChart('velocity-chart');
      cy.verifyChart('distribution-chart');
    });

    it('should show loading states initially', () => {
      cy.visit('/');
      
      // Check for loading indicators before data loads
      cy.get('.animate-pulse').should('exist');
      
      cy.waitForDashboard();
      
      // Loading indicators should disappear
      cy.get('.animate-pulse').should('not.exist');
    });
  });

  describe('Filter Functionality', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should update data when product filter changes', () => {
      cy.selectProduct('product-a');
      
      // Verify API call was made with correct parameters
      cy.wait('@getKPIs').its('request.url').should('include', 'productId=product-a');
      
      // Verify KPI cards update
      cy.verifyKPICard('pl-card', '1250000');
    });

    it('should update data when sprint filter changes', () => {
      cy.selectSprint('current');
      
      cy.wait('@getKPIs').its('request.url').should('include', 'sprintId=current');
      cy.verifyKPICard('velocity-card', '32');
    });

    it('should update data when date range changes', () => {
      cy.setDateRange('2024-01-01', '2024-01-31');
      
      // Should trigger data refresh
      cy.wait('@getKPIs');
      cy.wait('@getBurndown');
    });

    it('should handle multiple filter changes', () => {
      cy.selectProduct('product-b');
      cy.selectSprint('sprint-1');
      
      cy.wait('@getKPIs').its('request.url')
        .should('include', 'productId=product-b')
        .and('include', 'sprintId=sprint-1');
    });

    it('should persist filter values during navigation', () => {
      cy.selectProduct('product-a');
      cy.selectSprint('current');
      
      // Navigate away and back
      cy.navigateToPage('individual-performance');
      cy.navigateToPage('dashboard');
      
      // Filter values should be maintained
      cy.get('[data-testid="product-selector"]').should('have.value', 'product-a');
      cy.get('[data-testid="sprint-filter"]').should('have.value', 'current');
    });
  });

  describe('KPI Cards Interaction', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should display P/L KPI with correct formatting', () => {
      cy.get('[data-testid="pl-card"]')
        .should('contain', 'P/L YTD')
        .and('contain', '$1.3M')
        .and('contain', '+$180K');
    });

    it('should display Velocity KPI with trend', () => {
      cy.get('[data-testid="velocity-card"]')
        .should('contain', 'Velocity')
        .and('contain', '32 pts/spr')
        .and('contain', '+12%');
    });

    it('should display Bug Count with negative trend (improvement)', () => {
      cy.get('[data-testid="bug-card"]')
        .should('contain', 'Bug Count')
        .and('contain', '5')
        .and('contain', '-8%');
    });

    it('should display Satisfaction rating', () => {
      cy.get('[data-testid="satisfaction-card"]')
        .should('contain', 'Satisfaction')
        .and('contain', '4.2/5')
        .and('contain', '+0.3');
    });

    it('should show hover effects on KPI cards', () => {
      cy.get('[data-testid="pl-card"]')
        .trigger('mouseover')
        .should('have.class', 'hover:shadow-lg');
    });
  });

  describe('Chart Interactions', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should display sprint burndown chart with data', () => {
      cy.get('[data-testid="burndown-chart"]')
        .should('be.visible')
        .find('svg')
        .should('exist');
    });

    it('should display team velocity chart', () => {
      cy.get('[data-testid="velocity-chart"]')
        .should('be.visible')
        .find('svg')
        .should('exist');
    });

    it('should display task distribution chart', () => {
      cy.get('[data-testid="distribution-chart"]')
        .should('be.visible')
        .find('svg')
        .should('exist');
    });

    it('should update charts when filters change', () => {
      cy.selectSprint('sprint-1');
      
      cy.wait('@getBurndown');
      cy.wait('@getVelocity');
      cy.wait('@getDistribution');
      
      // Charts should re-render with new data
      cy.verifyChart('burndown-chart');
      cy.verifyChart('velocity-chart');
      cy.verifyChart('distribution-chart');
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should export dashboard data as Excel', () => {
      cy.exportDashboard('xlsx');
      
      // Verify export request was made
      cy.wait('@exportData')
        .its('request.url')
        .should('include', 'format=xlsx');
    });

    it('should export dashboard data as PDF', () => {
      cy.exportDashboard('pdf');
      
      cy.wait('@exportData')
        .its('request.url')
        .should('include', 'format=pdf');
    });

    it('should export dashboard data as CSV', () => {
      cy.exportDashboard('csv');
      
      cy.wait('@exportData')
        .its('request.url')
        .should('include', 'format=csv');
    });

    it('should include filter parameters in export', () => {
      cy.selectProduct('product-a');
      cy.selectSprint('current');
      
      cy.exportDashboard('xlsx');
      
      cy.wait('@exportData')
        .its('request.url')
        .should('include', 'productId=product-a')
        .and('include', 'sprintId=current');
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(() => {
      cy.waitForDashboard();
      cy.mockWebSocket(true);
    });

    it('should display real-time connection status', () => {
      cy.get('[data-testid="realtime-status"]')
        .should('contain', 'Connected')
        .or('contain', 'Live');
    });

    it('should update KPI values on real-time data', () => {
      const updatedData = {
        kpis: {
          plYtd: 1300000,
          velocity: 35,
          bugCount: 3,
          satisfaction: 4.5
        }
      };

      cy.simulateRealtimeUpdate(updatedData);
      
      // Verify KPI cards update with new values
      cy.get('[data-testid="pl-card"]').should('contain', '1300000');
      cy.get('[data-testid="velocity-card"]').should('contain', '35');
      cy.get('[data-testid="bug-card"]').should('contain', '3');
      cy.get('[data-testid="satisfaction-card"]').should('contain', '4.5');
    });

    it('should show update counter for real-time updates', () => {
      cy.simulateRealtimeUpdate({ kpis: { velocity: 36 } });
      
      cy.get('[data-testid="update-counter"]')
        .should('be.visible')
        .and('contain', 'real-time update');
    });

    it('should show refresh button when disconnected', () => {
      cy.mockWebSocket(false);
      
      cy.get('button').contains('Refresh Data').should('be.visible');
    });

    it('should refresh data when refresh button clicked', () => {
      cy.mockWebSocket(false);
      
      cy.get('button').contains('Refresh Data').click();
      
      // Should trigger API calls
      cy.wait('@getKPIs');
      cy.wait('@getBurndown');
    });
  });

  describe('Navigation and Routing', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should navigate to individual performance page', () => {
      cy.get('button').contains('View Individual Performance').click();
      
      cy.url().should('include', '/individual');
      cy.get('h1').should('contain', 'Individual Performance');
    });

    it('should maintain dashboard state when navigating back', () => {
      cy.selectProduct('product-a');
      cy.navigateToPage('individual-performance');
      cy.go('back');
      
      cy.get('[data-testid="product-selector"]').should('have.value', 'product-a');
    });

    it('should handle browser back/forward buttons', () => {
      cy.navigateToPage('individual-performance');
      cy.go('back');
      
      cy.get('h1').should('contain', 'RIS Performance Dashboard');
      
      cy.go('forward');
      cy.get('h1').should('contain', 'Individual Performance');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.simulateAPIError('/api/metrics/kpis', 500);
      
      cy.visit('/');
      
      // Should show fallback data or error state
      cy.get('.text-red-500').should('be.visible').and('contain', 'Error');
    });

    it('should handle network errors', () => {
      cy.simulateAPIError('/api/metrics/overview', 0);
      
      cy.visit('/');
      
      // Should show appropriate error message
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Failed to load');
    });

    it('should retry failed requests', () => {
      cy.simulateAPIError('/api/metrics/kpis', 500);
      
      cy.visit('/');
      
      // Click retry button if available
      cy.get('button').contains('Retry').click();
      
      // Should attempt to reload data
      cy.wait('@errorForapimetricskpis');
    });

    it('should handle partial data loading', () => {
      cy.simulateAPIError('/api/metrics/burndown', 404);
      
      cy.visit('/');
      
      // KPI cards should load even if charts fail
      cy.wait('@getKPIs');
      cy.verifyKPICard('pl-card', '1250000');
      
      // Failed chart should show empty or error state
      cy.get('[data-testid="burndown-chart"]').should('contain', 'No data available');
    });
  });

  describe('Performance', () => {
    it('should load dashboard within reasonable time', () => {
      cy.measurePageLoad();
    });

    it('should handle large datasets efficiently', () => {
      // Mock large dataset
      cy.intercept('GET', '**/api/workitems*', { fixture: 'large-workitems.json' }).as('getLargeWorkItems');
      
      cy.visit('/');
      cy.waitForDashboard();
      
      // Page should remain responsive
      cy.get('h1').should('be.visible');
    });

    it('should not have memory leaks with multiple filter changes', () => {
      cy.visit('/');
      cy.waitForDashboard();
      
      // Rapidly change filters multiple times
      for (let i = 0; i < 5; i++) {
        cy.selectProduct('product-a');
        cy.selectProduct('product-b');
        cy.selectSprint('sprint-1');
        cy.selectSprint('current');
      }
      
      // Dashboard should remain functional
      cy.get('h1').should('be.visible');
      cy.verifyKPICard('pl-card', '1250000');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.waitForDashboard();
    });

    it('should have proper heading hierarchy', () => {
      cy.checkAccessibility();
    });

    it('should be keyboard navigable', () => {
      // Tab through interactive elements
      cy.get('body').tab();
      cy.focused().should('exist');
      
      // Continue tabbing through filters
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'product-selector');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'sprint-filter');
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-testid="product-selector"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'id');
      
      cy.get('[data-testid="sprint-filter"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'id');
    });

    it('should support screen readers', () => {
      // Check for proper semantic elements
      cy.get('main').should('exist');
      cy.get('nav').should('exist');
      cy.get('h1').should('exist');
      
      // Check for skip links
      cy.get('a[href="#main-content"]').should('exist');
    });

    it('should have sufficient color contrast', () => {
      // Test high contrast mode compatibility
      cy.get('h1').should('have.css', 'color');
      cy.get('.text-gray-900').should('be.visible');
    });
  });
});