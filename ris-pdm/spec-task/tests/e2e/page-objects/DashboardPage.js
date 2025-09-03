/**
 * Dashboard Page Object Model
 * Encapsulates dashboard page interactions for Playwright MCP testing
 */

class DashboardPage {
  constructor() {
    this.url = '/';
    
    // Page elements selectors
    this.selectors = {
      // Header elements
      title: 'h1:has-text("RIS Performance Dashboard")',
      realtimeStatus: '[data-testid="realtime-status"]',
      exportButtons: '[data-testid="export-buttons"]',
      refreshButton: 'button:has-text("Refresh Data")',
      
      // Filter elements
      filterBar: '.bg-white.p-4.rounded-lg.shadow-dashboard.border',
      productSelector: 'select[name="product"], [data-testid="product-selector"]',
      sprintFilter: 'select[name="sprint"], [data-testid="sprint-filter"]',
      dateRangePicker: '[data-testid="date-range-picker"]',
      startDateInput: 'input[name="startDate"], [data-testid="start-date"]',
      endDateInput: 'input[name="endDate"], [data-testid="end-date"]',
      
      // KPI Cards
      kpiCards: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6',
      plCard: '[data-testid="pl-card"], .kpi-card:has-text("P/L YTD")',
      velocityCard: '[data-testid="velocity-card"], .kpi-card:has-text("Velocity")',
      bugCountCard: '[data-testid="bug-count-card"], .kpi-card:has-text("Bug Count")',
      satisfactionCard: '[data-testid="satisfaction-card"], .kpi-card:has-text("Satisfaction")',
      
      // Charts
      chartsSection: '.grid.grid-cols-1.lg\\:grid-cols-2.gap-6',
      burndownChart: '[data-testid="burndown-chart"]',
      velocityTrendChart: '[data-testid="velocity-trend-chart"]',
      
      // Loading states
      loadingSpinner: '.text-gray-500:has-text("Loading")',
      kpiLoadingState: '[data-testid="kpi-loading"]',
      chartLoadingState: '[data-testid="chart-loading"]',
      
      // Error states
      errorMessage: '.text-red-500',
      noDataMessage: '.text-gray-500:has-text("No data")',
      
      // Task Distribution
      taskDistributionDashboard: '[data-testid="task-distribution-dashboard"]',
      
      // Navigation
      individualPerformanceButton: 'button:has-text("View Individual Performance")'
    };
  }

  /**
   * Navigate to dashboard page using Playwright MCP
   */
  async navigate(sessionId) {
    console.log('🔄 Navigating to Dashboard page via MCP');
    return await global.playwrightMCP.navigate_session({
      sessionId,
      url: `http://localhost:3000${this.url}`
    });
  }

  /**
   * Wait for dashboard to load completely
   */
  async waitForLoad(sessionId) {
    console.log('⏳ Waiting for dashboard to load');
    
    // Wait for title to appear
    await global.playwrightMCP.observe_session({
      sessionId,
      instruction: `Wait for the page title "${this.selectors.title}" to be visible`,
      returnAction: false
    });
    
    // Wait for loading spinner to disappear
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Wait for loading spinner to disappear'
    });

    console.log('✅ Dashboard loaded successfully');
  }

  /**
   * Verify dashboard page elements are visible
   */
  async verifyPageElements(sessionId) {
    console.log('🔍 Verifying dashboard page elements');
    
    const elements = await global.playwrightMCP.observe_session({
      sessionId,
      instruction: 'Find all main dashboard elements: title, filter bar, KPI cards, and charts',
      returnAction: false
    });

    // Verify critical elements are present
    const criticalElements = [
      'RIS Performance Dashboard title',
      'Filter bar with product and sprint selectors',
      'KPI cards section with 4 cards',
      'Charts section with burndown and velocity charts'
    ];

    console.log('📊 Dashboard elements verification:', {
      elementsFound: elements?.length || 0,
      criticalElements: criticalElements.length
    });

    return elements;
  }

  /**
   * Get current KPI values from the dashboard
   */
  async getKPIValues(sessionId) {
    console.log('📊 Extracting KPI values from dashboard');
    
    const kpiData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract current KPI values from all 4 KPI cards:
        - P/L YTD value and trend
        - Velocity value and trend  
        - Bug Count value and trend
        - Satisfaction value and trend
        Include any loading states or error messages`
    });

    console.log('📈 Extracted KPI data:', kpiData);
    return kpiData;
  }

  /**
   * Apply filters to the dashboard
   */
  async applyFilters(sessionId, { product, sprint, startDate, endDate }) {
    console.log('🔧 Applying dashboard filters:', { product, sprint, startDate, endDate });
    
    if (product) {
      await global.playwrightMCP.act_session({
        sessionId,
        action: `Select "${product}" from the product dropdown`
      });
    }

    if (sprint) {
      await global.playwrightMCP.act_session({
        sessionId,
        action: `Select "${sprint}" from the sprint filter dropdown`
      });
    }

    if (startDate) {
      await global.playwrightMCP.act_session({
        sessionId,
        action: `Enter "${startDate}" in the start date field`
      });
    }

    if (endDate) {
      await global.playwrightMCP.act_session({
        sessionId,
        action: `Enter "${endDate}" in the end date field`
      });
    }

    // Wait for data to update after filter changes
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Wait for dashboard data to refresh after filter changes'
    });

    console.log('✅ Filters applied successfully');
  }

  /**
   * Check for error states
   */
  async checkForErrors(sessionId) {
    console.log('❌ Checking for error states on dashboard');
    
    const errors = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Find any error messages, failed loading states, or "No data" messages on the dashboard.
        Look for red error text, failed API calls, or empty chart states.`
    });

    if (errors && errors.length > 0) {
      console.log('⚠️ Errors detected on dashboard:', errors);
      return errors;
    }

    console.log('✅ No errors detected');
    return null;
  }

  /**
   * Validate chart rendering
   */
  async validateCharts(sessionId) {
    console.log('📈 Validating chart rendering');
    
    const chartData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Check if charts are properly rendered:
        - Sprint Burndown Chart: should show ideal vs actual lines
        - Team Velocity Chart: should show velocity trend over sprints
        - Both charts should have data points and proper axes labels
        - Look for any "No data" or loading states`
    });

    console.log('📊 Chart validation results:', chartData);
    return chartData;
  }

  /**
   * Test real-time updates functionality
   */
  async testRealtimeUpdates(sessionId) {
    console.log('🔄 Testing real-time updates functionality');
    
    // Get initial KPI values
    const initialValues = await this.getKPIValues(sessionId);
    
    // Wait for potential real-time updates
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Wait 30 seconds and observe any real-time data updates or connection status changes'
    });
    
    // Get updated values
    const updatedValues = await this.getKPIValues(sessionId);
    
    // Check real-time status indicator
    const realtimeStatus = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Extract the real-time connection status and last update timestamp'
    });

    console.log('🔄 Real-time update test results:', {
      initialValues,
      updatedValues,
      realtimeStatus,
      valuesChanged: JSON.stringify(initialValues) !== JSON.stringify(updatedValues)
    });

    return {
      initialValues,
      updatedValues,
      realtimeStatus,
      updateDetected: JSON.stringify(initialValues) !== JSON.stringify(updatedValues)
    };
  }

  /**
   * Export functionality test
   */
  async testExportFunctionality(sessionId) {
    console.log('📁 Testing export functionality');
    
    const exportButtons = await global.playwrightMCP.observe_session({
      sessionId,
      instruction: 'Find all export buttons (PDF, Excel, CSV) in the dashboard header',
      returnAction: true
    });

    if (exportButtons) {
      // Test PDF export
      await global.playwrightMCP.act_session({
        sessionId,
        action: 'Click the PDF export button'
      });

      // Check for download or export confirmation
      const exportResult = await global.playwrightMCP.extract_session({
        sessionId,
        instruction: 'Check if export was triggered successfully - look for download dialogs or success messages'
      });

      console.log('📄 Export test result:', exportResult);
      return exportResult;
    }

    console.log('❌ No export buttons found');
    return null;
  }

  /**
   * Navigate to individual performance page
   */
  async navigateToIndividualPerformance(sessionId) {
    console.log('👤 Navigating to Individual Performance page');
    
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Click the "View Individual Performance →" button'
    });

    // Verify navigation
    const currentUrl = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get the current page URL to verify navigation to individual performance page'
    });

    console.log('🔗 Navigation result:', currentUrl);
    return currentUrl;
  }

  /**
   * Test responsive design
   */
  async testResponsiveDesign(sessionId) {
    console.log('📱 Testing responsive design');
    
    // Test mobile viewport
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Resize browser window to mobile size (375x667)'
    });

    const mobileLayout = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Check if dashboard layout adapts properly to mobile: single column layout, readable text, accessible buttons'
    });

    // Test desktop viewport
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Resize browser window to desktop size (1920x1080)'
    });

    const desktopLayout = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Check if dashboard layout shows properly on desktop: multi-column KPI cards, side-by-side charts'
    });

    console.log('📐 Responsive design test results:', {
      mobile: mobileLayout,
      desktop: desktopLayout
    });

    return { mobile: mobileLayout, desktop: desktopLayout };
  }
}

module.exports = DashboardPage;