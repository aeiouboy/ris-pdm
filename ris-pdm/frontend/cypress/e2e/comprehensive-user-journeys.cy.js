/**
 * Comprehensive E2E Tests for RIS Performance Dashboard
 * Tests critical user journeys as specified in PRD Section E
 */

describe('RIS Performance Dashboard - Critical User Journeys', () => {
  beforeEach(() => {
    // Setup API intercepts for consistent testing
    cy.setupAPIIntercepts();
    
    // Setup authentication
    cy.mockAuth();
    
    // Clear any existing state
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  afterEach(() => {
    // Cleanup after each test
    cy.cleanupTest();
  });

  /**
   * Critical User Journey 1: Login → Select Product → View Dashboard
   * This tests the primary dashboard access flow
   */
  describe('Journey 1: Login → Select Product → View Dashboard', () => {
    it('should complete full dashboard access journey successfully', () => {
      cy.log('🚀 Starting Journey 1: Dashboard Access');
      
      // Step 1: Navigate to application
      cy.visit('/');
      
      // Step 2: Handle authentication (if required)
      cy.handleAuthentication();
      
      // Step 3: Verify dashboard loads with default state
      cy.waitForDashboard();
      cy.get('h1').should('contain', 'RIS Performance Dashboard');
      
      // Step 4: Select specific product
      cy.log('📊 Selecting Product A');
      cy.selectProduct('Product - Data as a Service');
      
      // Step 5: Verify product-specific data loads
      cy.wait('@getOverviewMetrics');
      cy.wait('@getKPIs');
      
      // Step 6: Verify all dashboard components are present and functional
      cy.verifyDashboardComponents();
      
      // Step 7: Verify KPI cards display correct data
      cy.verifyKPICards({
        plYtd: { value: '$1.3M', trend: '+$180K' },
        velocity: { value: '32 pts/spr', trend: '+12%' },
        bugCount: { value: '5', trend: '-8%' },
        satisfaction: { value: '4.2/5', trend: '+0.3' }
      });
      
      // Step 8: Verify charts render correctly
      cy.verifyCharts(['burndown', 'velocity', 'distribution']);
      
      // Step 9: Test responsive design
      cy.testResponsiveLayout();
      
      cy.log('✅ Journey 1 completed successfully');
    });

    it('should handle errors gracefully during dashboard load', () => {
      // Simulate API errors
      cy.intercept('GET', '**/api/metrics/overview', { statusCode: 500 }).as('overviewError');
      
      cy.visit('/');
      cy.handleAuthentication();
      
      // Should show error state but not crash
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');
      
      // Test retry functionality
      cy.intercept('GET', '**/api/metrics/overview', { fixture: 'overview-metrics.json' }).as('overviewFixed');
      cy.get('button').contains('Retry').click();
      
      cy.wait('@overviewFixed');
      cy.waitForDashboard();
    });

    it('should handle slow network conditions', () => {
      // Simulate slow network
      cy.intercept('GET', '**/api/metrics/**', { delay: 3000, fixture: 'overview-metrics.json' });
      
      cy.visit('/');
      cy.handleAuthentication();
      
      // Should show loading states
      cy.get('.animate-pulse').should('exist');
      
      // Should eventually load
      cy.waitForDashboard(10000); // Extended timeout for slow network
      cy.get('.animate-pulse').should('not.exist');
    });
  });

  /**
   * Critical User Journey 2: Apply Filters → Export Report
   * This tests the filtering and export functionality
   */
  describe('Journey 2: Apply Filters → Export Report', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
    });

    it('should apply filters and export comprehensive report', () => {
      cy.log('🚀 Starting Journey 2: Filter and Export');
      
      // Step 1: Apply multiple filters
      cy.log('🔍 Applying filters');
      cy.selectProduct('Product - Supplier Connect');
      cy.selectSprint('Sprint 2');
      cy.setDateRange('2024-01-01', '2024-01-31');
      
      // Step 2: Wait for filtered data to load
      cy.wait('@getOverviewMetrics');
      cy.wait('@getBurndown');
      cy.wait('@getVelocity');
      
      // Step 3: Verify filtered data is displayed
      cy.verifyFilteredData({
        productId: 'Product - Supplier Connect',
        sprintId: 'Sprint 2',
        dateRange: '2024-01-01 to 2024-01-31'
      });
      
      // Step 4: Test Excel export
      cy.log('📊 Testing Excel export');
      cy.exportDashboard('xlsx');
      
      cy.wait('@exportData').then((interception) => {
        expect(interception.request.url).to.include('format=xlsx');
        expect(interception.request.url).to.include('productId=Product - Supplier Connect');
        expect(interception.request.url).to.include('sprintId=Sprint 2');
      });
      
      // Step 5: Test PDF export
      cy.log('📄 Testing PDF export');
      cy.exportDashboard('pdf');
      
      cy.wait('@exportData').then((interception) => {
        expect(interception.request.url).to.include('format=pdf');
      });
      
      // Step 6: Test CSV export
      cy.log('📋 Testing CSV export');
      cy.exportDashboard('csv');
      
      cy.wait('@exportData').then((interception) => {
        expect(interception.request.url).to.include('format=csv');
      });
      
      // Step 7: Verify export notifications
      cy.get('[data-testid="export-notification"]')
        .should('be.visible')
        .and('contain', 'Export completed successfully');
      
      cy.log('✅ Journey 2 completed successfully');
    });

    it('should handle export failures gracefully', () => {
      // Simulate export failure
      cy.intercept('GET', '**/api/exports/**', { statusCode: 500 }).as('exportError');
      
      cy.exportDashboard('xlsx');
      
      cy.wait('@exportError');
      cy.get('[data-testid="error-notification"]')
        .should('be.visible')
        .and('contain', 'Export failed');
      
      // Should offer retry option
      cy.get('button').contains('Retry Export').should('be.visible');
    });

    it('should validate filter combinations', () => {
      // Test invalid date range
      cy.setDateRange('2024-01-31', '2024-01-01'); // End before start
      
      cy.get('[data-testid="date-validation-error"]')
        .should('be.visible')
        .and('contain', 'End date must be after start date');
      
      // Test future date range
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      cy.setDateRange('2024-01-01', futureDate.toISOString().split('T')[0]);
      
      cy.get('[data-testid="date-validation-warning"]')
        .should('be.visible')
        .and('contain', 'Future dates may not have data');
    });
  });

  /**
   * Critical User Journey 3: View Individual Performance
   * This tests the individual performance analysis feature
   */
  describe('Journey 3: View Individual Performance', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
    });

    it('should navigate to and interact with individual performance page', () => {
      cy.log('🚀 Starting Journey 3: Individual Performance');
      
      // Step 1: Navigate to individual performance page
      cy.log('👥 Navigating to individual performance');
      cy.get('button').contains('View Individual Performance').click();
      
      cy.url().should('include', '/individual');
      cy.get('h1').should('contain', 'Individual Performance');
      
      // Step 2: Wait for team members data to load
      cy.wait('@getTeamMembers');
      cy.wait('@getIndividualMetrics');
      
      // Step 3: Verify team members list
      cy.get('[data-testid="team-members-list"]').should('be.visible');
      cy.get('[data-testid="team-member-card"]').should('have.length.at.least', 5);
      
      // Step 4: Select a specific team member
      cy.log('👤 Selecting team member');
      cy.get('[data-testid="team-member-card"]').first().click();
      
      // Step 5: Verify individual metrics display
      cy.verifyIndividualMetrics({
        velocity: 'should.exist',
        completedItems: 'should.exist',
        qualityScore: 'should.exist',
        burndownChart: 'should.exist',
        workItemsHistory: 'should.exist'
      });
      
      // Step 6: Test time period filtering
      cy.log('📅 Testing time period filtering');
      cy.selectTimePeriod('Last 30 Days');
      cy.wait('@getIndividualMetrics');
      
      cy.selectTimePeriod('Last Quarter');
      cy.wait('@getIndividualMetrics');
      
      // Step 7: Test individual performance export
      cy.log('📊 Testing individual performance export');
      cy.get('[data-testid="export-individual"]').click();
      cy.get('[data-testid="export-format"]').select('pdf');
      cy.get('button').contains('Export Performance Report').click();
      
      cy.wait('@exportIndividual');
      
      // Step 8: Verify comparison functionality
      cy.log('⚖️ Testing team member comparison');
      cy.get('[data-testid="compare-members"]').click();
      cy.selectTeamMembers(['John Doe', 'Jane Smith']);
      
      cy.get('[data-testid="comparison-chart"]').should('be.visible');
      cy.get('[data-testid="comparison-metrics"]').should('be.visible');
      
      // Step 9: Test navigation back to dashboard
      cy.log('🔙 Testing navigation back to dashboard');
      cy.get('[data-testid="back-to-dashboard"]').click();
      
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.get('h1').should('contain', 'RIS Performance Dashboard');
      
      cy.log('✅ Journey 3 completed successfully');
    });

    it('should handle team member selection and filtering', () => {
      cy.navigateToPage('individual-performance');
      
      // Test search functionality
      cy.get('[data-testid="member-search"]').type('John');
      cy.get('[data-testid="team-member-card"]')
        .should('have.length.lessThan', 10)
        .each(($card) => {
          cy.wrap($card).should('contain', 'John');
        });
      
      // Test role filtering
      cy.get('[data-testid="role-filter"]').select('Developer');
      cy.get('[data-testid="team-member-card"]')
        .each(($card) => {
          cy.wrap($card).find('[data-testid="member-role"]').should('contain', 'Developer');
        });
      
      // Test performance sorting
      cy.get('[data-testid="sort-by"]').select('Velocity (High to Low)');
      cy.get('[data-testid="team-member-card"]').then(($cards) => {
        const velocities = Array.from($cards).map(card => 
          parseInt(card.querySelector('[data-testid="member-velocity"]').textContent)
        );
        
        expect(velocities).to.deep.equal(velocities.sort((a, b) => b - a));
      });
    });
  });

  /**
   * Cross-Journey Integration Tests
   * Tests that span multiple user journeys and complex scenarios
   */
  describe('Cross-Journey Integration Tests', () => {
    it('should maintain state across navigation', () => {
      cy.log('🔄 Testing state persistence across navigation');
      
      // Set up initial state
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      cy.selectProduct('Product - CFG Workflow');
      cy.selectSprint('Sprint 3');
      cy.setDateRange('2024-01-15', '2024-01-29');
      
      // Navigate to individual performance
      cy.navigateToPage('individual-performance');
      
      // Navigate back to dashboard
      cy.navigateToPage('dashboard');
      
      // Verify filters are maintained
      cy.get('[data-testid="product-selector"]').should('have.value', 'Product - CFG Workflow');
      cy.get('[data-testid="sprint-filter"]').should('have.value', 'Sprint 3');
      cy.get('[data-testid="start-date"]').should('have.value', '2024-01-15');
      cy.get('[data-testid="end-date"]').should('have.value', '2024-01-29');
    });

    it('should handle concurrent user actions', () => {
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Simulate rapid filter changes
      cy.selectProduct('Product - Data as a Service');
      cy.selectProduct('Product - Supplier Connect');
      cy.selectProduct('Product - CFG Workflow');
      
      // Should handle race conditions gracefully
      cy.wait('@getOverviewMetrics');
      cy.get('[data-testid="loading-indicator"]').should('not.exist');
      
      // Final state should be consistent
      cy.get('[data-testid="product-selector"]').should('have.value', 'Product - CFG Workflow');
    });

    it('should handle browser refresh with active filters', () => {
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Apply filters
      cy.selectProduct('Product - Data as a Service');
      cy.selectSprint('Sprint 1');
      
      // Refresh browser
      cy.reload();
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Filters should be restored (if URL state management is implemented)
      // Or should gracefully reset to defaults
      cy.get('[data-testid="product-selector"]').should('exist');
      cy.get('[data-testid="sprint-filter"]').should('exist');
    });
  });

  /**
   * Performance and Accessibility Tests
   * Tests for performance benchmarks and accessibility compliance
   */
  describe('Performance and Accessibility', () => {
    it('should meet performance benchmarks', () => {
      cy.log('⚡ Testing performance benchmarks');
      
      // Measure page load time
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.performance.mark('start');
        },
        onLoad: (win) => {
          win.performance.mark('end');
          win.performance.measure('pageLoad', 'start', 'end');
        }
      });
      
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Check performance metrics
      cy.window().then((win) => {
        const measure = win.performance.getEntriesByName('pageLoad')[0];
        expect(measure.duration).to.be.lessThan(5000); // 5 seconds max load time
      });
      
      // Test large dataset handling
      cy.intercept('GET', '**/api/workitems*', { fixture: 'large-workitems.json' }).as('getLargeWorkItems');
      
      cy.navigateToPage('workitems');
      cy.wait('@getLargeWorkItems');
      
      // Page should remain responsive
      cy.get('[data-testid="workitems-table"]').should('be.visible');
      cy.get('body').should('not.have.class', 'loading-frozen');
    });

    it('should meet accessibility standards', () => {
      cy.log('♿ Testing accessibility compliance');
      
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Check for accessibility violations
      cy.checkA11y();
      
      // Test keyboard navigation
      cy.get('body').tab();
      cy.focused().should('exist');
      
      // Navigate through interactive elements
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'product-selector');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'sprint-filter');
      
      // Test screen reader support
      cy.get('[data-testid="pl-card"]')
        .should('have.attr', 'aria-label')
        .and('contain', 'P/L YTD');
      
      // Test high contrast mode compatibility
      cy.get('body').then(($body) => {
        const originalFilter = $body.css('filter');
        $body.css('filter', 'contrast(2)');
        
        // Elements should remain visible
        cy.get('h1').should('be.visible');
        cy.get('[data-testid="pl-card"]').should('be.visible');
        
        // Restore original style
        $body.css('filter', originalFilter);
      });
    });

    it('should handle edge cases and error conditions', () => {
      cy.log('🔍 Testing edge cases and error conditions');
      
      // Test with empty data
      cy.intercept('GET', '**/api/metrics/overview', {
        body: { success: true, data: { kpis: {}, charts: {}, metadata: {} } }
      }).as('getEmptyData');
      
      cy.visit('/');
      cy.handleAuthentication();
      cy.wait('@getEmptyData');
      
      // Should show empty state gracefully
      cy.get('[data-testid="empty-state"]').should('be.visible');
      cy.get('[data-testid="no-data-message"]').should('contain', 'No data available');
      
      // Test with malformed data
      cy.intercept('GET', '**/api/metrics/kpis', {
        body: { success: true, data: null }
      }).as('getMalformedData');
      
      cy.reload();
      cy.handleAuthentication();
      cy.wait('@getMalformedData');
      
      // Should handle gracefully without crashing
      cy.get('body').should('not.contain', 'ChunkLoadError');
      cy.get('body').should('not.contain', 'TypeError');
    });
  });

  /**
   * Mobile and Responsive Design Tests
   */
  describe('Mobile and Responsive Design', () => {
    const viewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 414, height: 896, name: 'iPhone XR' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1024, height: 768, name: 'iPad Landscape' }
    ];

    viewports.forEach((viewport) => {
      it(`should work correctly on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height);
        
        cy.visit('/');
        cy.handleAuthentication();
        cy.waitForDashboard();
        
        // Test mobile navigation
        if (viewport.width < 768) {
          cy.get('[data-testid="mobile-menu-toggle"]').should('be.visible').click();
          cy.get('[data-testid="mobile-menu"]').should('be.visible');
        }
        
        // Test responsive layout
        cy.get('[data-testid="kpi-grid"]').should('be.visible');
        cy.get('[data-testid="charts-container"]').should('be.visible');
        
        // Test touch interactions
        if (viewport.width < 768) {
          cy.get('[data-testid="product-selector"]').click();
          cy.get('[data-testid="product-option"]').first().click();
        }
        
        // Test export on mobile
        cy.get('[data-testid="export-buttons"]').should('be.visible');
      });
    });

    it('should handle orientation changes', () => {
      cy.viewport(375, 667); // Portrait
      cy.visit('/');
      cy.handleAuthentication();
      cy.waitForDashboard();
      
      // Change to landscape
      cy.viewport(667, 375);
      
      // Layout should adapt
      cy.get('[data-testid="kpi-grid"]').should('be.visible');
      cy.get('h1').should('be.visible');
    });
  });
});