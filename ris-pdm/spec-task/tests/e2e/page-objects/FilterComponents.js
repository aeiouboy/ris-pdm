/**
 * Filter Components Page Object Model
 * Handles dashboard filter interactions and validation
 */

class FilterComponents {
  constructor() {
    this.selectors = {
      // Filter bar container
      filterBar: '.bg-white.p-4.rounded-lg.shadow-dashboard.border',
      filterGrid: '.grid.grid-cols-1.md\\:grid-cols-3.gap-4',
      
      // Product selector
      productSelector: 'select[name="product"], [data-testid="product-selector"]',
      productDropdown: '[data-testid="product-selector"] select',
      productLabel: 'label:has-text("Product"), .product-label',
      
      // Sprint filter
      sprintFilter: 'select[name="sprint"], [data-testid="sprint-filter"]',
      sprintDropdown: '[data-testid="sprint-filter"] select',
      sprintLabel: 'label:has-text("Sprint"), .sprint-label',
      
      // Date range picker
      dateRangePicker: '[data-testid="date-range-picker"]',
      startDateInput: 'input[name="startDate"], [data-testid="start-date"]',
      endDateInput: 'input[name="endDate"], [data-testid="end-date"]',
      dateLabel: 'label:has-text("Date Range"), .date-label',
      
      // Filter actions
      clearFiltersButton: 'button:has-text("Clear Filters")',
      applyFiltersButton: 'button:has-text("Apply Filters")',
      
      // Loading states during filter updates
      filterLoadingSpinner: '[data-testid="filter-loading"]',
      dataRefreshingIndicator: '.text-gray-500:has-text("Refreshing")'
    };

    // Expected filter options based on the application
    this.expectedFilters = {
      products: [
        'all-projects',
        'Product - Partner Management Platform',
        'Product - Data as a Service',
        'Product - Supplier Connect',
        'Product - CFG Workflow',
        'Product - RTS-On-Prem'
      ],
      sprints: [
        'all-sprints',
        'current',
        'Sprint 25',
        'Sprint 24',
        'Sprint 23'
      ]
    };
  }

  /**
   * Validate filter bar structure and components
   */
  async validateFilterBarStructure(sessionId) {
    console.log('🔧 Validating filter bar structure');
    
    const filterBarData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract filter bar information:
        - Verify filter bar is visible with 3-column layout
        - Check if Product selector dropdown is present with options
        - Check if Sprint filter dropdown is present with options  
        - Check if Date range picker inputs are present
        - Verify all labels and components are properly aligned`
    });

    console.log('🔧 Filter bar structure:', filterBarData);
    return filterBarData;
  }

  /**
   * Test Product selector functionality
   */
  async testProductSelector(sessionId) {
    console.log('📦 Testing Product selector');
    
    // Get current product selection
    const initialSelection = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get the currently selected product from the product dropdown'
    });

    // Open product dropdown and get options
    const productOptions = await global.playwrightMCP.observe_session({
      sessionId,
      instruction: 'Click on the product selector dropdown and observe all available options',
      returnAction: true
    });

    if (productOptions) {
      await global.playwrightMCP.act_session({
        sessionId,
        action: 'Click on the product selector dropdown to open it'
      });

      const availableProducts = await global.playwrightMCP.extract_session({
        sessionId,
        instruction: 'Extract all available product options from the dropdown menu'
      });

      // Test selecting a different product
      await global.playwrightMCP.act_session({
        sessionId,
        action: 'Select "Product - Data as a Service" from the product dropdown'
      });

      // Verify selection changed
      const newSelection = await global.playwrightMCP.extract_session({
        sessionId,
        instruction: 'Get the newly selected product to confirm the change'
      });

      const testResult = {
        initialSelection,
        availableProducts,
        newSelection,
        selectionChanged: initialSelection !== newSelection
      };

      console.log('📦 Product selector test:', testResult);
      return testResult;
    }

    console.log('❌ Could not interact with product selector');
    return null;
  }

  /**
   * Test Sprint filter functionality
   */
  async testSprintFilter(sessionId) {
    console.log('🏃 Testing Sprint filter');
    
    // Get current sprint selection
    const initialSprint = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get the currently selected sprint from the sprint dropdown'
    });

    // Test sprint dropdown
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Click on the sprint filter dropdown to open it'
    });

    const availableSprints = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Extract all available sprint options from the dropdown menu'
    });

    // Test selecting a different sprint
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Select "Sprint 24" from the sprint dropdown'
    });

    // Verify selection changed
    const newSprint = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get the newly selected sprint to confirm the change'
    });

    const testResult = {
      initialSprint,
      availableSprints,
      newSprint,
      selectionChanged: initialSprint !== newSprint
    };

    console.log('🏃 Sprint filter test:', testResult);
    return testResult;
  }

  /**
   * Test Date range picker functionality
   */
  async testDateRangePicker(sessionId) {
    console.log('📅 Testing Date range picker');
    
    // Get initial date values
    const initialDates = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get current start date and end date values from the date range picker inputs'
    });

    // Test start date input
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Clear and enter "2024-01-01" in the start date input field'
    });

    // Test end date input
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Clear and enter "2024-01-31" in the end date input field'
    });

    // Get updated date values
    const updatedDates = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get the updated start date and end date values after changes'
    });

    const testResult = {
      initialDates,
      updatedDates,
      datesChanged: JSON.stringify(initialDates) !== JSON.stringify(updatedDates)
    };

    console.log('📅 Date range picker test:', testResult);
    return testResult;
  }

  /**
   * Test filter combination scenarios
   */
  async testFilterCombinations(sessionId) {
    console.log('🔗 Testing filter combinations');
    
    const testScenarios = [
      {
        name: 'Product + Sprint filter',
        product: 'Product - Partner Management Platform',
        sprint: 'current'
      },
      {
        name: 'Product + Date range',
        product: 'Product - Data as a Service',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      },
      {
        name: 'All filters combined',
        product: 'Product - Supplier Connect',
        sprint: 'Sprint 25',
        startDate: '2024-02-01',
        endDate: '2024-02-29'
      }
    ];

    const scenarioResults = [];

    for (const scenario of testScenarios) {
      console.log(`🧪 Testing scenario: ${scenario.name}`);
      
      // Apply filter combination
      if (scenario.product) {
        await global.playwrightMCP.act_session({
          sessionId,
          action: `Select "${scenario.product}" from product dropdown`
        });
      }

      if (scenario.sprint) {
        await global.playwrightMCP.act_session({
          sessionId,
          action: `Select "${scenario.sprint}" from sprint dropdown`
        });
      }

      if (scenario.startDate) {
        await global.playwrightMCP.act_session({
          sessionId,
          action: `Enter "${scenario.startDate}" in start date field`
        });
      }

      if (scenario.endDate) {
        await global.playwrightMCP.act_session({
          sessionId,
          action: `Enter "${scenario.endDate}" in end date field`
        });
      }

      // Wait for data to update
      await global.playwrightMCP.act_session({
        sessionId,
        action: 'Wait for dashboard data to refresh with new filter combination'
      });

      // Capture result
      const scenarioResult = await global.playwrightMCP.extract_session({
        sessionId,
        instruction: `Check if dashboard updated correctly with filter combination:
          - Are KPI values different from previous state?
          - Do charts reflect the filtered data?
          - Are there any error messages or loading issues?`
      });

      scenarioResults.push({
        scenario: scenario.name,
        filters: scenario,
        result: scenarioResult
      });
    }

    console.log('🔗 Filter combination test results:', scenarioResults);
    return scenarioResults;
  }

  /**
   * Test filter data persistence across page interactions
   */
  async testFilterPersistence(sessionId) {
    console.log('💾 Testing filter persistence');
    
    // Apply specific filters
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Select "Product - CFG Workflow" from product dropdown'
    });

    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Select "Sprint 23" from sprint dropdown'
    });

    // Get filter state
    const appliedFilters = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get current filter selections: product and sprint'
    });

    // Navigate to individual performance and back
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Click "View Individual Performance →" button to navigate away'
    });

    // Navigate back to dashboard
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Navigate back to dashboard page'
    });

    // Check if filters persisted
    const persistedFilters = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: 'Get filter selections after navigation to check persistence'
    });

    const persistenceResult = {
      appliedFilters,
      persistedFilters,
      filtersPreserved: JSON.stringify(appliedFilters) === JSON.stringify(persistedFilters)
    };

    console.log('💾 Filter persistence test:', persistenceResult);
    return persistenceResult;
  }

  /**
   * Test filter responsiveness and performance
   */
  async testFilterPerformance(sessionId) {
    console.log('⚡ Testing filter performance');
    
    const performanceResults = [];

    // Test each filter type's response time
    const filterTests = [
      { type: 'product', action: 'Select "Product - RTS-On-Prem" from product dropdown' },
      { type: 'sprint', action: 'Select "current" from sprint dropdown' },
      { type: 'date', action: 'Enter "2024-03-01" in start date and "2024-03-31" in end date' }
    ];

    for (const test of filterTests) {
      console.log(`⏱️ Testing ${test.type} filter performance`);
      
      const startTime = Date.now();
      
      // Apply filter
      await global.playwrightMCP.act_session({
        sessionId,
        action: test.action
      });

      // Wait for data refresh
      await global.playwrightMCP.act_session({
        sessionId,
        action: 'Wait for dashboard data to complete refresh'
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Check for loading indicators
      const loadingBehavior = await global.playwrightMCP.extract_session({
        sessionId,
        instruction: `Check filter response behavior:
          - Were loading indicators shown during data refresh?
          - Did the UI remain responsive during filter application?
          - Are there any performance issues or delays?`
      });

      performanceResults.push({
        filterType: test.type,
        responseTime: responseTime,
        loadingBehavior,
        performanceRating: responseTime < 2000 ? 'Good' : responseTime < 5000 ? 'Acceptable' : 'Slow'
      });
    }

    console.log('⚡ Filter performance results:', performanceResults);
    return performanceResults;
  }

  /**
   * Comprehensive filter testing combining all scenarios
   */
  async runComprehensiveFilterTests(sessionId) {
    console.log('🔍 Running comprehensive filter tests');
    
    const testResults = {
      structure: await this.validateFilterBarStructure(sessionId),
      productSelector: await this.testProductSelector(sessionId),
      sprintFilter: await this.testSprintFilter(sessionId),
      dateRangePicker: await this.testDateRangePicker(sessionId),
      combinations: await this.testFilterCombinations(sessionId),
      persistence: await this.testFilterPersistence(sessionId),
      performance: await this.testFilterPerformance(sessionId)
    };

    console.log('📋 Comprehensive filter test results:', testResults);
    return testResults;
  }
}

module.exports = FilterComponents;