#!/usr/bin/env node

/**
 * Comprehensive Test Runner for RIS Performance Dashboard
 * This script orchestrates all test types: unit, integration, E2E, and performance tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const testConfig = {
  unit: {
    backend: 'npm run test:unit:backend',
    frontend: 'npm run test:unit:frontend'
  },
  integration: {
    api: 'npm run test:integration',
    e2e: 'npm run test:e2e'
  },
  performance: {
    load: 'npm run test:performance',
    stress: 'npm run test:stress'
  },
  coverage: {
    backend: 'npm run test:coverage:backend',
    frontend: 'npm run test:coverage:frontend'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: {}
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      this.log(`\n🔄 Running: ${command}`, 'cyan');
      
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        cwd,
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.log(`✅ Success: ${command}`, 'green');
          this.results.passed++;
          resolve(code);
        } else {
          this.log(`❌ Failed: ${command}`, 'red');
          this.results.failed++;
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.log(`❌ Error: ${command} - ${error.message}`, 'red');
        this.results.failed++;
        reject(error);
      });
    });
  }

  async runTestSuite(suiteName, commands, options = {}) {
    this.log(`\n${'='.repeat(60)}`, 'bright');
    this.log(`🧪 Running ${suiteName} Tests`, 'bright');
    this.log(`${'='.repeat(60)}`, 'bright');

    const results = [];
    
    for (const [testName, command] of Object.entries(commands)) {
      try {
        const startTime = Date.now();
        await this.runCommand(command, options.cwd);
        const duration = Date.now() - startTime;
        
        results.push({
          name: testName,
          status: 'passed',
          duration
        });
      } catch (error) {
        results.push({
          name: testName,
          status: 'failed',
          error: error.message
        });
        
        if (!options.continueOnFailure) {
          break;
        }
      }
    }

    return results;
  }

  async generateCoverageReport() {
    this.log('\n📊 Generating comprehensive coverage report...', 'yellow');
    
    try {
      // Backend coverage
      await this.runCommand('npm run test:coverage:backend');
      
      // Frontend coverage  
      const frontendPath = path.resolve(__dirname, '../../../frontend');
      if (fs.existsSync(frontendPath)) {
        await this.runCommand('npm run test:coverage', frontendPath);
      }
      
      this.log('✅ Coverage reports generated', 'green');
    } catch (error) {
      this.log(`❌ Coverage generation failed: ${error.message}`, 'red');
    }
  }

  async validateTestEnvironment() {
    this.log('\n🔍 Validating test environment...', 'yellow');
    
    const checks = [
      { name: 'Node.js version', command: 'node --version' },
      { name: 'NPM packages', command: 'npm list --depth=0' },
      { name: 'Test dependencies', command: 'npm list jest supertest cypress --depth=0' }
    ];

    for (const check of checks) {
      try {
        await this.runCommand(check.command);
        this.log(`✅ ${check.name} - OK`, 'green');
      } catch (error) {
        this.log(`❌ ${check.name} - FAILED`, 'red');
        throw new Error(`Environment validation failed: ${check.name}`);
      }
    }
  }

  generateSummaryReport() {
    const duration = Date.now() - this.startTime;
    const totalTests = this.results.passed + this.results.failed;
    
    this.log('\n' + '='.repeat(80), 'bright');
    this.log('📋 TEST EXECUTION SUMMARY', 'bright');
    this.log('='.repeat(80), 'bright');
    
    this.log(`⏱️  Total Duration: ${Math.round(duration / 1000)}s`, 'blue');
    this.log(`📊 Total Tests: ${totalTests}`, 'blue');
    this.log(`✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, 'red');
    this.log(`⏭️  Skipped: ${this.results.skipped}`, 'yellow');
    
    const successRate = totalTests > 0 ? Math.round((this.results.passed / totalTests) * 100) : 0;
    this.log(`📈 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    
    if (this.results.failed > 0) {
      this.log('\n❌ TESTS FAILED - See details above', 'red');
      process.exit(1);
    } else {
      this.log('\n✅ ALL TESTS PASSED!', 'green');
      process.exit(0);
    }
  }

  async run(options = {}) {
    try {
      this.log('🚀 Starting RIS Performance Dashboard Test Suite', 'bright');
      
      // Validate environment
      if (!options.skipValidation) {
        await this.validateTestEnvironment();
      }

      // Run unit tests
      if (!options.skipUnit) {
        await this.runTestSuite('Unit', testConfig.unit, { 
          continueOnFailure: options.continueOnFailure 
        });
      }

      // Run integration tests
      if (!options.skipIntegration) {
        await this.runTestSuite('Integration', testConfig.integration, { 
          continueOnFailure: options.continueOnFailure 
        });
      }

      // Run performance tests
      if (options.includePerformance) {
        await this.runTestSuite('Performance', testConfig.performance, { 
          continueOnFailure: true 
        });
      }

      // Generate coverage report
      if (!options.skipCoverage) {
        await this.generateCoverageReport();
      }

    } catch (error) {
      this.log(`\n❌ Test suite execution failed: ${error.message}`, 'red');
      this.results.failed++;
    }

    this.generateSummaryReport();
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    skipValidation: args.includes('--skip-validation'),
    skipUnit: args.includes('--skip-unit'),
    skipIntegration: args.includes('--skip-integration'),
    skipCoverage: args.includes('--skip-coverage'),
    includePerformance: args.includes('--include-performance'),
    continueOnFailure: args.includes('--continue-on-failure')
  };

  const runner = new TestRunner();
  runner.run(options);
}

module.exports = TestRunner;