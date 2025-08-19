#!/usr/bin/env node

/**
 * Comprehensive Test Runner for RIS Performance Dashboard
 * Runs all test suites and generates coverage reports
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const process = require('process');

class TestRunner {
  constructor() {
    this.backendPath = path.join(__dirname, 'backend');
    this.frontendPath = path.join(__dirname, 'frontend');
    this.resultsDir = path.join(__dirname, 'test-results');
    this.coverageDir = path.join(__dirname, 'coverage');
    this.results = {
      backend: { passed: 0, failed: 0, coverage: null },
      frontend: { passed: 0, failed: 0, coverage: null },
      e2e: { passed: 0, failed: 0 },
      performance: { passed: 0, failed: 0 }
    };
  }

  async init() {
    // Create results directories
    await this.ensureDirectories();
    console.log('🚀 RIS Performance Dashboard - Comprehensive Test Suite');
    console.log('=' .repeat(60));
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.resultsDir, { recursive: true });
      await fs.mkdir(this.coverageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directories:', error.message);
    }
  }

  async runCommand(command, args, cwd, description) {
    return new Promise((resolve, reject) => {
      console.log(`\n📋 ${description}`);
      console.log(`Running: ${command} ${args.join(' ')}`);
      console.log('-'.repeat(40));

      const child = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${description} completed successfully`);
          resolve({ code, stdout, stderr });
        } else {
          console.log(`❌ ${description} failed with code ${code}`);
          resolve({ code, stdout, stderr }); // Don't reject, let caller decide
        }
      });

      child.on('error', (error) => {
        console.error(`❌ ${description} error:`, error.message);
        reject(error);
      });
    });
  }

  parseTestResults(output) {
    const results = { passed: 0, failed: 0, total: 0 };
    
    // Jest/Vitest output parsing
    const testRegex = /Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/i;
    const match = output.match(testRegex);
    
    if (match) {
      results.failed = parseInt(match[1]) || 0;
      results.passed = parseInt(match[2]) || 0;
      results.total = parseInt(match[3]) || 0;
    } else {
      // Alternative parsing for different output formats
      const passedMatch = output.match(/(\d+)\s*passing/i);
      const failedMatch = output.match(/(\d+)\s*failing/i);
      
      if (passedMatch) results.passed = parseInt(passedMatch[1]);
      if (failedMatch) results.failed = parseInt(failedMatch[1]);
      results.total = results.passed + results.failed;
    }
    
    return results;
  }

  parseCoverageInfo(output) {
    const coverage = { statements: 0, branches: 0, functions: 0, lines: 0 };
    
    // Look for coverage summary
    const coverageRegex = /All files\s*\|\s*(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)\s*\|\s*(\d+\.?\d*)/;
    const match = output.match(coverageRegex);
    
    if (match) {
      coverage.statements = parseFloat(match[1]);
      coverage.branches = parseFloat(match[2]);
      coverage.functions = parseFloat(match[3]);
      coverage.lines = parseFloat(match[4]);
    }
    
    return coverage;
  }

  async runBackendTests() {
    try {
      console.log('\n🔧 Backend Tests');
      console.log('=' .repeat(30));

      // Install dependencies if needed
      console.log('📦 Ensuring dependencies are installed...');
      await this.runCommand('npm', ['ci'], this.backendPath, 'Installing backend dependencies');

      // Run unit tests with coverage
      const unitResult = await this.runCommand(
        'npm', 
        ['run', 'test:coverage'], 
        this.backendPath,
        'Backend Unit Tests'
      );

      this.results.backend = {
        ...this.parseTestResults(unitResult.stdout),
        coverage: this.parseCoverageInfo(unitResult.stdout)
      };

      // Run integration tests
      const integrationResult = await this.runCommand(
        'npx',
        ['jest', 'tests/integration', '--verbose', '--detectOpenHandles'],
        this.backendPath,
        'Backend Integration Tests'
      );

      // Run performance tests
      const performanceResult = await this.runCommand(
        'npx',
        ['jest', 'tests/performance', '--verbose', '--detectOpenHandles', '--timeout=60000'],
        this.backendPath,
        'Backend Performance Tests'
      );

      this.results.performance = this.parseTestResults(performanceResult.stdout);

      return {
        unit: unitResult.code === 0,
        integration: integrationResult.code === 0,
        performance: performanceResult.code === 0
      };

    } catch (error) {
      console.error('Backend tests failed:', error.message);
      return { unit: false, integration: false, performance: false };
    }
  }

  async runFrontendTests() {
    try {
      console.log('\n⚛️  Frontend Tests');
      console.log('=' .repeat(30));

      // Install dependencies if needed
      console.log('📦 Ensuring dependencies are installed...');
      await this.runCommand('npm', ['ci'], this.frontendPath, 'Installing frontend dependencies');

      // Run unit tests with coverage
      const result = await this.runCommand(
        'npm',
        ['run', 'test:coverage'],
        this.frontendPath,
        'Frontend Unit Tests'
      );

      this.results.frontend = {
        ...this.parseTestResults(result.stdout),
        coverage: this.parseCoverageInfo(result.stdout)
      };

      return result.code === 0;

    } catch (error) {
      console.error('Frontend tests failed:', error.message);
      return false;
    }
  }

  async runE2ETests() {
    try {
      console.log('\n🌐 End-to-End Tests');
      console.log('=' .repeat(30));

      // Start backend server in background
      console.log('🚀 Starting backend server...');
      const backendProcess = spawn('npm', ['start'], {
        cwd: this.backendPath,
        stdio: 'pipe',
        detached: true
      });

      // Wait for backend to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Start frontend dev server in background
      console.log('🚀 Starting frontend dev server...');
      const frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: this.frontendPath,
        stdio: 'pipe',
        detached: true
      });

      // Wait for frontend to start
      await new Promise(resolve => setTimeout(resolve, 10000));

      try {
        // Run Cypress tests
        const result = await this.runCommand(
          'npm',
          ['run', 'cypress:run', '--', '--headless'],
          this.frontendPath,
          'Cypress E2E Tests'
        );

        this.results.e2e = this.parseTestResults(result.stdout);
        return result.code === 0;

      } finally {
        // Clean up processes
        if (backendProcess && !backendProcess.killed) {
          process.kill(-backendProcess.pid);
        }
        if (frontendProcess && !frontendProcess.killed) {
          process.kill(-frontendProcess.pid);
        }
      }

    } catch (error) {
      console.error('E2E tests failed:', error.message);
      return false;
    }
  }

  async generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));

    const totalPassed = this.results.backend.passed + this.results.frontend.passed + this.results.e2e.passed;
    const totalFailed = this.results.backend.failed + this.results.frontend.failed + this.results.e2e.failed;
    const totalTests = totalPassed + totalFailed;

    console.log('\n🔧 Backend Results:');
    console.log(`   Unit Tests: ${this.results.backend.passed} passed, ${this.results.backend.failed} failed`);
    if (this.results.backend.coverage) {
      console.log(`   Coverage: ${this.results.backend.coverage.statements}% statements, ${this.results.backend.coverage.lines}% lines`);
    }

    console.log('\n⚛️  Frontend Results:');
    console.log(`   Unit Tests: ${this.results.frontend.passed} passed, ${this.results.frontend.failed} failed`);
    if (this.results.frontend.coverage) {
      console.log(`   Coverage: ${this.results.frontend.coverage.statements}% statements, ${this.results.frontend.coverage.lines}% lines`);
    }

    console.log('\n🌐 E2E Results:');
    console.log(`   Tests: ${this.results.e2e.passed} passed, ${this.results.e2e.failed} failed`);

    console.log('\n🚀 Performance Results:');
    console.log(`   Tests: ${this.results.performance.passed} passed, ${this.results.performance.failed} failed`);

    console.log('\n📈 Overall Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} (${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%)`);
    console.log(`   Failed: ${totalFailed} (${totalTests > 0 ? Math.round((totalFailed / totalTests) * 100) : 0}%)`);

    // Check coverage thresholds
    const backendCoverage = this.results.backend.coverage?.statements || 0;
    const frontendCoverage = this.results.frontend.coverage?.statements || 0;
    const overallCoverage = (backendCoverage + frontendCoverage) / 2;

    console.log(`\n📊 Overall Coverage: ${overallCoverage.toFixed(1)}%`);
    
    if (overallCoverage >= 80) {
      console.log('✅ Coverage threshold met (80%+)');
    } else {
      console.log(`❌ Coverage below threshold. Target: 80%, Current: ${overallCoverage.toFixed(1)}%`);
    }

    // Write JSON report
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalTests,
        totalPassed,
        totalFailed,
        passRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
        overallCoverage
      }
    };

    const reportPath = path.join(this.resultsDir, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return {
      success: totalFailed === 0 && overallCoverage >= 80,
      report
    };
  }

  async run() {
    await this.init();

    const args = process.argv.slice(2);
    const runAll = args.length === 0 || args.includes('--all');
    const runBackend = runAll || args.includes('--backend');
    const runFrontend = runAll || args.includes('--frontend');
    const runE2E = runAll || args.includes('--e2e');

    try {
      if (runBackend) {
        await this.runBackendTests();
      }

      if (runFrontend) {
        await this.runFrontendTests();
      }

      if (runE2E) {
        await this.runE2ETests();
      }

      const result = await this.generateReport();
      
      if (result.success) {
        console.log('\n🎉 All tests passed and coverage threshold met!');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed or coverage below threshold');
        process.exit(1);
      }

    } catch (error) {
      console.error('\n💥 Test runner failed:', error.message);
      process.exit(1);
    }
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
RIS Performance Dashboard Test Runner

Usage: node test-runner.js [options]

Options:
  --all         Run all test suites (default)
  --backend     Run backend tests only
  --frontend    Run frontend tests only
  --e2e         Run E2E tests only
  --help, -h    Show this help message

Examples:
  node test-runner.js                 # Run all tests
  node test-runner.js --backend       # Run backend tests only
  node test-runner.js --frontend --e2e # Run frontend and E2E tests
`);
  process.exit(0);
}

// Run the test runner
const runner = new TestRunner();
runner.run().catch(error => {
  console.error('Test runner crashed:', error);
  process.exit(1);
});