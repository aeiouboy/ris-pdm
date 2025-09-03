/**
 * KPI Cards Page Object Model
 * Specialized interactions for dashboard KPI cards testing
 */

class KPICards {
  constructor() {
    this.selectors = {
      // KPI Card containers
      kpiCardsGrid: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6',
      
      // Individual cards
      plCard: '[data-testid="pl-card"], .kpi-card:has-text("P/L YTD")',
      velocityCard: '[data-testid="velocity-card"], .kpi-card:has-text("Velocity")',
      bugCountCard: '[data-testid="bug-count-card"], .kpi-card:has-text("Bug Count")',
      satisfactionCard: '[data-testid="satisfaction-card"], .kpi-card:has-text("Satisfaction")',
      
      // Card elements
      cardValue: '.text-2xl.font-bold, .text-3xl.font-bold',
      cardTrend: '.text-green-600, .text-red-600, .text-gray-500',
      cardTrendIcon: '.fa-arrow-up, .fa-arrow-down, .fa-minus',
      cardLabel: '.text-sm.text-gray-600',
      cardStatus: '[data-testid="card-status"]',
      
      // Loading and error states
      loadingState: '.animate-pulse, .text-gray-500:has-text("Loading")',
      errorState: '.text-red-500',
      processingState: '.text-gray-500:has-text("Processing")'
    };

    // Expected KPI card structure based on spec
    this.expectedCards = {
      pl: {
        title: 'P/L YTD',
        format: 'currency',
        trendTypes: ['up', 'down', 'neutral']
      },
      velocity: {
        title: 'Velocity',
        format: 'number',
        unit: 'story points',
        trendTypes: ['up', 'down', 'neutral']
      },
      bugs: {
        title: 'Bug Count',
        format: 'number',
        trendTypes: ['up', 'down', 'neutral']
      },
      satisfaction: {
        title: 'Satisfaction',
        format: 'rating',
        scale: '1-5',
        trendTypes: ['up', 'down', 'neutral']
      }
    };
  }

  /**
   * Validate all KPI cards are present and rendered correctly
   */
  async validateKPICardsStructure(sessionId) {
    console.log('📊 Validating KPI cards structure');
    
    const cardsData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract complete KPI cards information:
        - Count total number of KPI cards (should be 4)
        - For each card, extract: title, main value, trend arrow, trend percentage
        - Check for any loading states or error messages
        - Verify cards are in proper grid layout`
    });

    console.log('📈 KPI cards structure:', cardsData);
    return cardsData;
  }

  /**
   * Test specific velocity card for the bug we fixed
   */
  async testVelocityCard(sessionId) {
    console.log('⚡ Testing Velocity card specifically (bug fix validation)');
    
    const velocityData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Focus on the Velocity card and extract:
        - Current velocity value (should be completed story points, not total committed)
        - Trend direction (up/down arrow)
        - Trend percentage
        - Period indicator (should show "Current Sprint")
        - Any target or benchmark information
        - Check if value appears realistic (not inflated by bug)`
    });

    console.log('📊 Velocity card data (post-bug-fix):', velocityData);
    return velocityData;
  }

  /**
   * Validate P/L YTD card formatting and data
   */
  async testPLCard(sessionId) {
    console.log('💰 Testing P/L YTD card');
    
    const plData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract P/L YTD card information:
        - Value format (should be currency with $ symbol)
        - Trend indicator and percentage
        - Period (should be "YTD")
        - Check for "Processing..." state if real data not available`
    });

    console.log('💲 P/L card data:', plData);
    return plData;
  }

  /**
   * Validate Bug Count card accuracy
   */
  async testBugCountCard(sessionId) {
    console.log('🐛 Testing Bug Count card');
    
    const bugData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract Bug Count card information:
        - Current bug count value
        - Trend direction (ideally down is good)
        - Trend percentage change
        - Period (should be "Current Sprint")
        - Check if number seems reasonable`
    });

    console.log('🔍 Bug count data:', bugData);
    return bugData;
  }

  /**
   * Validate Satisfaction card rating
   */
  async testSatisfactionCard(sessionId) {
    console.log('😊 Testing Team Satisfaction card');
    
    const satisfactionData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Extract Team Satisfaction card information:
        - Rating value (should be on 1-5 scale)
        - Trend direction
        - Trend percentage
        - Check for "Processing..." state if survey data not available`
    });

    console.log('📊 Satisfaction data:', satisfactionData);
    return satisfactionData;
  }

  /**
   * Test KPI cards loading states
   */
  async testKPILoadingStates(sessionId) {
    console.log('⏳ Testing KPI cards loading behavior');
    
    // Trigger a fresh data load by refreshing
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Refresh the page to observe KPI loading states'
    });

    const loadingBehavior = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Observe KPI cards loading behavior:
        - Do cards show loading spinners initially?
        - Do they load data progressively?
        - Are there any loading errors or timeouts?
        - How long does loading take?`
    });

    console.log('⏳ KPI loading behavior:', loadingBehavior);
    return loadingBehavior;
  }

  /**
   * Test KPI cards responsiveness to filter changes
   */
  async testKPIFilterResponsiveness(sessionId, filters) {
    console.log('🔄 Testing KPI responsiveness to filter changes');
    
    // Get initial KPI values
    const initialValues = await this.validateKPICardsStructure(sessionId);
    
    // Apply filters
    await global.playwrightMCP.act_session({
      sessionId,
      action: `Change product filter to "${filters.product || 'different product'}"`
    });

    // Wait for update
    await global.playwrightMCP.act_session({
      sessionId,
      action: 'Wait for KPI cards to update with new filter data'
    });

    // Get updated values
    const updatedValues = await this.validateKPICardsStructure(sessionId);

    const responsiveness = {
      initialValues,
      updatedValues,
      dataChanged: JSON.stringify(initialValues) !== JSON.stringify(updatedValues),
      filterApplied: filters
    };

    console.log('🔄 KPI filter responsiveness:', responsiveness);
    return responsiveness;
  }

  /**
   * Validate KPI card accessibility
   */
  async testKPIAccessibility(sessionId) {
    console.log('♿ Testing KPI cards accessibility');
    
    const accessibilityData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Check KPI cards accessibility features:
        - Do cards have proper ARIA labels?
        - Are values readable by screen readers?
        - Is there sufficient color contrast for trends?
        - Are cards keyboard navigable?
        - Do cards have meaningful alt text or descriptions?`
    });

    console.log('♿ KPI accessibility results:', accessibilityData);
    return accessibilityData;
  }

  /**
   * Test KPI trend calculations accuracy
   */
  async testKPITrendAccuracy(sessionId) {
    console.log('📈 Testing KPI trend calculation accuracy');
    
    const trendData = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Analyze KPI trend indicators for accuracy:
        - Are trend arrows consistent with percentage changes?
        - Do positive percentages show up arrows and vice versa?
        - Are trend percentages formatted correctly (e.g., "+5.2%", "-3.1%")?
        - Do trend colors match direction (green=up, red=down, gray=neutral)?`
    });

    console.log('📊 KPI trend accuracy:', trendData);
    return trendData;
  }

  /**
   * Test KPI card error handling
   */
  async testKPIErrorHandling(sessionId) {
    console.log('❌ Testing KPI error handling');
    
    // Simulate network issues (if possible) or check existing error states
    const errorStates = await global.playwrightMCP.extract_session({
      sessionId,
      instruction: `Check for KPI error handling:
        - Are there any cards showing error messages?
        - How are API failures displayed to users?
        - Are there "Processing..." or "No data" states?
        - Do cards degrade gracefully when data is unavailable?`
    });

    console.log('🚨 KPI error handling:', errorStates);
    return errorStates;
  }

  /**
   * Comprehensive KPI validation combining all tests
   */
  async runComprehensiveKPITests(sessionId, options = {}) {
    console.log('🔍 Running comprehensive KPI card tests');
    
    const testResults = {
      structure: await this.validateKPICardsStructure(sessionId),
      velocity: await this.testVelocityCard(sessionId),
      pl: await this.testPLCard(sessionId),
      bugs: await this.testBugCountCard(sessionId),
      satisfaction: await this.testSatisfactionCard(sessionId),
      loading: await this.testKPILoadingStates(sessionId),
      accessibility: await this.testKPIAccessibility(sessionId),
      trends: await this.testKPITrendAccuracy(sessionId),
      errorHandling: await this.testKPIErrorHandling(sessionId)
    };

    if (options.testFilters) {
      testResults.filterResponsiveness = await this.testKPIFilterResponsiveness(sessionId, options.filters);
    }

    console.log('📋 Comprehensive KPI test results:', testResults);
    return testResults;
  }
}

module.exports = KPICards;