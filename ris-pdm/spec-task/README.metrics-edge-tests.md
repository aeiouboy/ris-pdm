# RIS Dashboard Metrics Edge Case Testing

## Overview
This directory contains comprehensive testing specifications and implementation for the RIS Performance Dashboard, with specific focus on Playwright MCP integration and calculation error detection.

## Files Structure

### Specifications
- `dashboard-playwright-testing-specification.md` - Complete testing strategy and implementation plan
- `bug-classification-fallback-test-plan.md` - Specific test plan for endpoint fallback behavior  

### Configuration  
- `package.json` - Testing dependencies and scripts
- `jest.config.js` - Jest configuration for backend integration tests

### Implementation
- `../backend/tests/integration/bug-classification-fallback.test.js` - Complete Jest test suite

## Key Testing Scenarios

### 1. Dashboard Calculation Accuracy
- **Velocity Calculation Bug**: Tests for incorrect velocity metric showing total committed vs completed story points
- **KPI Card Validation**: Comprehensive testing of P/L, Velocity, Bug Count, and Satisfaction calculations
- **Trend Calculation Edge Cases**: Handling of null/zero previous values

### 2. Fallback Logic Testing  
- **Primary Path**: Azure DevOps API available and responding correctly
- **Secondary Fallback**: Primary fails, task distribution service provides fallback data
- **Tertiary Fallback**: All services fail, safe empty structure returned (no 500 errors)

### 3. Playwright End-to-End Validation
- **Real-time Data Sync**: WebSocket updates and cache invalidation
- **Filter Interactions**: Product, sprint, and date range filtering
- **Cross-Browser Compatibility**: Chrome, Firefox, Safari, Edge testing
- **Performance Monitoring**: Load times and response benchmarks

## Identified Critical Issues

### High Priority: Velocity Calculation Error
**Location**: `backend/src/services/metricsCalculator.js:calculateDetailedKPIs()`
**Issue**: Returns `totalCommittedStoryPoints` instead of `velocity.storyPoints` 
**Impact**: Misleading team performance metrics in dashboard
**Fix**: Change line to use `velocity.storyPoints` for completed story points only

### Medium Priority: Currency Formatting
**Location**: `frontend/src/components/KPICard.jsx`
**Issue**: May not handle negative values or very large numbers correctly
**Impact**: P/L display inconsistencies

## Running Tests

### Backend Integration Tests
```bash
cd spec-task
npm install
npm run test:bug-classification
```

### Playwright End-to-End Tests  
```bash
npm run playwright:install
npm run playwright:test
```

### Coverage Reports
```bash
npm run test:coverage
```

## Test-Driven Development Approach

1. **Red Phase**: Write failing tests that demonstrate the bug
2. **Green Phase**: Implement minimal fix to make tests pass  
3. **Verify Phase**: Ensure no regression in existing functionality
4. **Refactor Phase**: Optimize code while maintaining test coverage

## Performance Benchmarks

- **Dashboard Load**: <3 seconds initial load
- **Filter Response**: <1 second for filter application  
- **API Response**: <500ms for KPI calculations
- **Fallback Response**: <100ms for tertiary fallback

## Success Criteria

✅ **Zero 500 Errors**: All fallback scenarios return 200 with safe data  
✅ **Calculation Accuracy**: All identified math errors resolved and verified  
✅ **Test Coverage**: 95%+ coverage on critical calculation functions  
✅ **Cross-Browser Compatibility**: Consistent behavior across major browsers  
✅ **Performance Maintained**: No degradation in dashboard response times  

## Next Steps

1. **Implement Bug Fix**: Correct velocity calculation in metricsCalculator.js
2. **Run Integration Tests**: Validate fix with comprehensive test suite
3. **Execute E2E Tests**: Verify end-to-end dashboard functionality with Playwright
4. **Performance Testing**: Benchmark before/after fix implementation
5. **Documentation Update**: Update technical documentation with testing procedures

This comprehensive testing approach ensures robust dashboard functionality and accurate business metrics reporting.
