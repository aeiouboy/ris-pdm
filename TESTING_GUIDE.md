# 🧪 RIS Performance Dashboard Testing Guide

## Overview

This comprehensive testing guide covers all aspects of testing for the RIS Performance Dashboard, ensuring code quality, reliability, and performance as specified in the PRD requirements.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Test Types](#test-types)
3. [Coverage Requirements](#coverage-requirements)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Testing Strategy

Our testing strategy follows the test pyramid approach with comprehensive coverage at each level:

```
     /\
    /  \  E2E Tests (Cypress)
   /____\
  /      \  Integration Tests (API)
 /________\
/          \  Unit Tests (Jest/Vitest)
\__________/
```

### Coverage Targets (PRD Section E)

- **Minimum Coverage**: 80% for all metrics (statements, branches, functions, lines)
- **Test Types**: Unit, Integration, End-to-End, Performance
- **Frameworks**: Jest (Backend), Vitest (Frontend), Cypress (E2E)

## Test Types

### 1. Unit Tests 🔬

**Purpose**: Test individual components, functions, and services in isolation.

**Coverage**:
- Backend services (Azure DevOps, Metrics Calculator, Cache, Export, Performance Monitor)
- React components (Dashboard, KPI Cards, Charts, Individual Performance)
- Utility functions and helpers
- Data transformers and validators

**Tools**: Jest (Backend), Vitest (Frontend)

### 2. Integration Tests 🔗

**Purpose**: Test interactions between different components and external services.

**Coverage**:
- API endpoints with middleware
- Database operations
- Azure DevOps API integration
- WebSocket connections
- Cache layer integration

**Tools**: Jest with Supertest, Nock for API mocking

### 3. End-to-End (E2E) Tests 🎭

**Purpose**: Test complete user journeys and workflows.

**Critical User Journeys** (PRD Requirement):
1. **Login → Select Product → View Dashboard**
2. **Apply Filters → Export Report**
3. **View Individual Performance**

**Tools**: Cypress

### 4. Performance Tests ⚡

**Purpose**: Ensure application meets performance benchmarks.

**Scenarios**:
- Load testing (concurrent users)
- Stress testing (peak load conditions)
- Memory leak detection
- Response time validation

**Tools**: Autocannon, Artillery, Custom performance monitors

### 5. Accessibility Tests ♿

**Purpose**: Ensure WCAG compliance and screen reader compatibility.

**Coverage**:
- Keyboard navigation
- Screen reader support
- Color contrast
- ARIA labels

**Tools**: Cypress with axe-core, pa11y

### 6. Security Tests 🔒

**Purpose**: Validate security measures and prevent vulnerabilities.

**Coverage**:
- Input validation
- SQL injection prevention
- XSS protection
- Authentication/authorization

**Tools**: OWASP ZAP, Snyk, CodeQL

## Coverage Requirements

### Backend Coverage (Jest)

```bash
# Run with coverage
npm run test:coverage

# Coverage thresholds (jest.config.js)
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

### Frontend Coverage (Vitest)

```bash
# Run with coverage
npm run test:coverage

# Coverage thresholds (vitest.config.js)
thresholds: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

## Running Tests

### Local Development

#### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/services/azureDevOpsService.test.js

# Run in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

#### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific component tests
npm test -- KPICard.test.jsx

# Run UI tests
npm run test:ui
```

#### E2E Tests
```bash
cd frontend

# Run Cypress tests (headless)
npm run cypress:run

# Open Cypress GUI
npm run cypress:open

# Run specific test suite
npx cypress run --spec "cypress/e2e/comprehensive-user-journeys.cy.js"
```

### Comprehensive Test Suite

Run the complete test suite across all components:

```bash
# From project root
node backend/tests/comprehensive-test-runner.js

# With specific options
node backend/tests/comprehensive-test-runner.js --include-performance --continue-on-failure
```

### Coverage Reporting

Generate comprehensive coverage reports:

```bash
cd backend
node tests/coverage-reporter.js report

# Generate trend analysis
node tests/coverage-reporter.js trends

# Backend only
node tests/coverage-reporter.js backend

# Frontend only
node tests/coverage-reporter.js frontend
```

## Writing Tests

### Unit Test Structure

#### Backend (Jest)
```javascript
// tests/services/example.test.js
describe('ExampleService', () => {
  let service;
  
  beforeEach(() => {
    service = new ExampleService();
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    test('should handle success case', async () => {
      // Arrange
      const input = { test: 'data' };
      const expected = { result: 'success' };
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
    });

    test('should handle error case', async () => {
      // Arrange & Assert
      await expect(service.methodName(null))
        .rejects.toThrow('Invalid input');
    });
  });
});
```

#### Frontend (Vitest)
```javascript
// src/components/__tests__/Example.test.jsx
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@test/test-utils';
import Example from '../Example';

describe('Example Component', () => {
  test('should render with props', () => {
    const props = { title: 'Test Title', value: 100 };
    
    render(<Example {...props} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('should handle user interactions', async () => {
    const mockHandler = vi.fn();
    
    render(<Example onAction={mockHandler} />);
    
    await userEvent.click(screen.getByRole('button'));
    
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

### Integration Test Structure

```javascript
// tests/integration/api.test.js
describe('API Integration Tests', () => {
  let app;
  
  beforeAll(async () => {
    app = require('../../server');
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/metrics/overview', () => {
    test('should return dashboard metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/overview')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('kpis');
      expect(response.body.data).toHaveProperty('charts');
    });
  });
});
```

### E2E Test Structure

```javascript
// cypress/e2e/user-journey.cy.js
describe('Critical User Journey', () => {
  beforeEach(() => {
    cy.setupAPIIntercepts();
    cy.mockAuth();
  });

  it('should complete dashboard access journey', () => {
    // Step 1: Login
    cy.visit('/');
    cy.handleAuthentication();
    
    // Step 2: Select Product
    cy.selectProduct('Product A');
    
    // Step 3: Verify Dashboard
    cy.waitForDashboard();
    cy.verifyDashboardComponents();
    
    // Step 4: Validate Data
    cy.verifyKPICards({
      plYtd: { value: '$1.3M', trend: '+$180K' }
    });
  });
});
```

## CI/CD Integration

Our GitHub Actions workflow automatically runs the complete test suite:

### Workflow Stages

1. **Static Analysis** - Linting, security audits
2. **Unit Tests** - Backend and frontend unit tests
3. **Integration Tests** - API and service integration
4. **E2E Tests** - Critical user journeys
5. **Performance Tests** - Load and stress testing
6. **Coverage Analysis** - Comprehensive coverage reporting

### Triggers

- **Push** to main/develop branches
- **Pull Requests** to main/develop
- **Daily Schedule** (2 AM UTC)

### Quality Gates

Tests must pass with:
- ✅ 80% minimum coverage (all metrics)
- ✅ No high-severity security issues
- ✅ All critical user journeys working
- ✅ Performance benchmarks met

## Troubleshooting

### Common Issues

#### 1. Test Failures Due to Timing
```javascript
// Use proper async/await
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});

// Increase timeout for slow operations
cy.get('[data-testid="chart"]', { timeout: 10000 });
```

#### 2. Mock Issues
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Reset modules for fresh imports
beforeEach(() => {
  jest.resetModules();
});
```

#### 3. Memory Leaks in Tests
```javascript
// Cleanup after tests
afterEach(() => {
  cleanup(); // React Testing Library
  jest.clearAllTimers();
});

// Proper async cleanup
afterAll(async () => {
  await server.close();
  await database.disconnect();
});
```

#### 4. Flaky E2E Tests
```javascript
// Use proper waits
cy.wait('@apiCall');
cy.waitForStableDOM();

// Retry flaky tests
it('flaky test', { retries: 2 }, () => {
  // test implementation
});
```

### Debug Commands

```bash
# Debug specific test
npm test -- --verbose tests/specific.test.js

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Cypress debug mode
npx cypress open --browser chrome --headed

# Coverage debug
npm run test:coverage -- --verbose
```

## Best Practices

### 1. Test Structure

- **Arrange-Act-Assert** pattern
- **Descriptive test names** that explain the scenario
- **One assertion per test** when possible
- **Proper setup and teardown**

### 2. Test Data

```javascript
// Use factories for test data
const createUser = (overrides = {}) => ({
  id: 'test-user',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
});

// Use realistic test data
const mockMetrics = generateTestMetrics({
  plYtd: 1250000,
  velocity: 32,
  bugCount: 5
});
```

### 3. Mocking Strategy

```javascript
// Mock at the boundary
jest.mock('../../src/services/azureDevOpsService');

// Prefer dependency injection
class ServiceUnderTest {
  constructor(dependencies = {}) {
    this.azureService = dependencies.azureService || new AzureDevOpsService();
  }
}

// Mock external services, not internal logic
```

### 4. Async Testing

```javascript
// Proper async handling
test('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

// Use waitFor for React components
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### 5. Error Testing

```javascript
// Test error scenarios
test('should handle network errors', async () => {
  mockService.getData.mockRejectedValue(new Error('Network error'));
  
  await expect(service.fetchData()).rejects.toThrow('Network error');
});

// Test error boundaries in React
test('should display error fallback', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  
  render(<ComponentThatThrows />);
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});
```

### 6. Performance Testing

```javascript
// Test render performance
test('should render large dataset efficiently', () => {
  const largeDataset = generateLargeDataset(10000);
  
  const startTime = performance.now();
  render(<DataTable data={largeDataset} />);
  const renderTime = performance.now() - startTime;
  
  expect(renderTime).toBeLessThan(1000); // 1 second max
});
```

## Maintenance

### Regular Tasks

1. **Update test dependencies** monthly
2. **Review and update test data** quarterly
3. **Analyze coverage trends** monthly
4. **Performance benchmark validation** weekly
5. **Security scan updates** with each release

### Metrics to Monitor

- **Coverage trends** over time
- **Test execution time** increases
- **Flaky test frequency**
- **Performance benchmark degradation**

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Cypress Documentation](https://docs.cypress.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

### Tools
- [Testing Library](https://testing-library.com/) - Simple and complete testing utilities
- [MSW](https://mswjs.io/) - API mocking library
- [Axe](https://www.deque.com/axe/) - Accessibility testing
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Performance auditing

---

**Last Updated**: 2024-01-23  
**Version**: 1.0.0  
**Maintained By**: RIS Development Team