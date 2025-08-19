/**
 * Comprehensive Performance Testing Suite for RIS Performance Dashboard
 * Tests various load scenarios, stress conditions, and performance benchmarks
 */

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class PerformanceTestSuite extends EventEmitter {
  constructor() {
    super();
    this.results = [];
    this.server = null;
    this.baseUrl = 'http://localhost:3001';
    
    // Performance thresholds as per PRD requirements
    this.thresholds = {
      responseTime: {
        p95: 2000,    // 95th percentile < 2s
        p99: 5000,    // 99th percentile < 5s
        mean: 1000    // Average < 1s
      },
      throughput: {
        minimum: 100, // Minimum 100 req/s
        target: 500   // Target 500 req/s
      },
      errorRate: {
        maximum: 0.01 // Maximum 1% error rate
      },
      memory: {
        maximum: 512 * 1024 * 1024, // Maximum 512MB
        leakThreshold: 50 * 1024 * 1024 // 50MB leak threshold
      }
    };
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting test server...');
      
      this.server = spawn('node', ['server.js'], {
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          PORT: '3001',
          LOG_LEVEL: 'error'
        },
        stdio: 'pipe'
      });

      this.server.stdout.on('data', (data) => {
        if (data.toString().includes('Server running on port 3001')) {
          console.log('✅ Test server started successfully');
          setTimeout(resolve, 1000); // Give server time to fully initialize
        }
      });

      this.server.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.server.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);
    });
  }

  async stopServer() {
    if (this.server) {
      console.log('🛑 Stopping test server...');
      this.server.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async runLoadTest(config) {
    console.log(`\n🔄 Running load test: ${config.name}`);
    console.log(`Target: ${config.url}`);
    console.log(`Duration: ${config.duration}s, Connections: ${config.connections}`);

    const result = await autocannon({
      url: `${this.baseUrl}${config.url}`,
      connections: config.connections || 10,
      pipelining: config.pipelining || 1,
      duration: config.duration || 30,
      headers: config.headers || {},
      requests: config.requests || [],
      setupClient: config.setupClient,
      ...config.options
    });

    // Analyze results
    const analysis = this.analyzeResults(result, config);
    this.results.push({
      name: config.name,
      config,
      result,
      analysis,
      timestamp: new Date().toISOString()
    });

    this.logResults(config.name, result, analysis);
    return { result, analysis };
  }

  analyzeResults(result, config) {
    const analysis = {
      passed: true,
      issues: [],
      recommendations: []
    };

    // Check response time thresholds
    if (result.latency.p95 > this.thresholds.responseTime.p95) {
      analysis.passed = false;
      analysis.issues.push(`P95 response time too high: ${result.latency.p95}ms > ${this.thresholds.responseTime.p95}ms`);
    }

    if (result.latency.p99 > this.thresholds.responseTime.p99) {
      analysis.passed = false;
      analysis.issues.push(`P99 response time too high: ${result.latency.p99}ms > ${this.thresholds.responseTime.p99}ms`);
    }

    if (result.latency.mean > this.thresholds.responseTime.mean) {
      analysis.passed = false;
      analysis.issues.push(`Mean response time too high: ${result.latency.mean}ms > ${this.thresholds.responseTime.mean}ms`);
    }

    // Check throughput
    const avgThroughput = result.requests.total / (result.duration / 1000);
    if (avgThroughput < this.thresholds.throughput.minimum) {
      analysis.passed = false;
      analysis.issues.push(`Throughput too low: ${avgThroughput.toFixed(2)} req/s < ${this.thresholds.throughput.minimum} req/s`);
    }

    // Check error rate
    const errorRate = (result.errors + result.timeouts) / result.requests.total;
    if (errorRate > this.thresholds.errorRate.maximum) {
      analysis.passed = false;
      analysis.issues.push(`Error rate too high: ${(errorRate * 100).toFixed(2)}% > ${this.thresholds.errorRate.maximum * 100}%`);
    }

    // Add recommendations
    if (result.latency.p95 > result.latency.mean * 3) {
      analysis.recommendations.push('High latency variance detected - consider optimizing slow queries');
    }

    if (avgThroughput < this.thresholds.throughput.target) {
      analysis.recommendations.push('Consider implementing caching or connection pooling');
    }

    if (result.errors > 0) {
      analysis.recommendations.push('Investigate and fix application errors');
    }

    return analysis;
  }

  logResults(testName, result, analysis) {
    console.log(`\n📊 Results for ${testName}:`);
    console.log(`├─ Total Requests: ${result.requests.total}`);
    console.log(`├─ Duration: ${result.duration / 1000}s`);
    console.log(`├─ Throughput: ${(result.requests.total / (result.duration / 1000)).toFixed(2)} req/s`);
    console.log(`├─ Response Times:`);
    console.log(`│  ├─ Mean: ${result.latency.mean}ms`);
    console.log(`│  ├─ P95: ${result.latency.p95}ms`);
    console.log(`│  └─ P99: ${result.latency.p99}ms`);
    console.log(`├─ Errors: ${result.errors}`);
    console.log(`├─ Timeouts: ${result.timeouts}`);
    console.log(`└─ Status: ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (analysis.issues.length > 0) {
      console.log(`\n⚠️  Issues:`);
      analysis.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      analysis.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  async runMemoryStressTest() {
    console.log('\n🧠 Running memory stress test...');
    
    const initialMemory = process.memoryUsage();
    const memorySnapshots = [initialMemory];
    
    // Run intensive operations
    const intensiveConfig = {
      name: 'Memory Stress Test',
      url: '/api/workitems?limit=1000',
      connections: 20,
      duration: 60,
      pipelining: 10
    };

    // Monitor memory during test
    const memoryMonitor = setInterval(() => {
      memorySnapshots.push(process.memoryUsage());
    }, 5000);

    try {
      await this.runLoadTest(intensiveConfig);
    } finally {
      clearInterval(memoryMonitor);
    }

    // Analyze memory usage
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));

    console.log('\n🧠 Memory Analysis:');
    console.log(`├─ Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`├─ Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`├─ Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
    console.log(`├─ Peak Memory: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);

    const memoryAnalysis = {
      passed: true,
      issues: []
    };

    if (maxMemory > this.thresholds.memory.maximum) {
      memoryAnalysis.passed = false;
      memoryAnalysis.issues.push(`Peak memory usage too high: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);
    }

    if (memoryGrowth > this.thresholds.memory.leakThreshold) {
      memoryAnalysis.passed = false;
      memoryAnalysis.issues.push(`Potential memory leak detected: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB growth`);
    }

    console.log(`└─ Status: ${memoryAnalysis.passed ? '✅ PASSED' : '❌ FAILED'}`);

    return { memorySnapshots, analysis: memoryAnalysis };
  }

  async runComprehensiveTestSuite() {
    console.log('🎯 Starting Comprehensive Performance Test Suite');
    console.log('================================================');

    try {
      await this.startServer();

      // Test scenarios based on PRD requirements
      const testScenarios = [
        // 1. Basic API Performance Tests
        {
          name: 'Dashboard Overview - Light Load',
          url: '/api/metrics/overview',
          connections: 10,
          duration: 30,
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        },
        
        {
          name: 'Dashboard Overview - Medium Load',
          url: '/api/metrics/overview',
          connections: 50,
          duration: 60,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        {
          name: 'Dashboard Overview - High Load',
          url: '/api/metrics/overview',
          connections: 100,
          duration: 120,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        // 2. Work Items API Tests
        {
          name: 'Work Items List - Paginated',
          url: '/api/workitems?page=1&limit=50',
          connections: 25,
          duration: 45,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        {
          name: 'Work Items Search - Complex Query',
          url: '/api/workitems?search=user%20story&type=User%20Story&state=Active',
          connections: 20,
          duration: 60,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        // 3. Export Functionality Tests
        {
          name: 'Export Dashboard - Excel',
          url: '/api/exports/dashboard?format=xlsx',
          connections: 5,
          duration: 30,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        {
          name: 'Export Dashboard - PDF',
          url: '/api/exports/dashboard?format=pdf',
          connections: 3,
          duration: 45,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        // 4. Real-time Data Tests
        {
          name: 'KPI Metrics - High Frequency',
          url: '/api/metrics/kpis',
          connections: 30,
          duration: 90,
          pipelining: 5,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        },

        // 5. Mixed Workload Test
        {
          name: 'Mixed Workload Simulation',
          url: '/api/metrics/overview',
          connections: 40,
          duration: 180,
          requests: [
            {
              method: 'GET',
              path: '/api/metrics/overview',
              headers: { 'Authorization': 'Bearer test-token' }
            },
            {
              method: 'GET', 
              path: '/api/workitems?limit=20',
              headers: { 'Authorization': 'Bearer test-token' }
            },
            {
              method: 'GET',
              path: '/api/metrics/kpis',
              headers: { 'Authorization': 'Bearer test-token' }
            },
            {
              method: 'GET',
              path: '/api/users',
              headers: { 'Authorization': 'Bearer test-token' }
            }
          ]
        }
      ];

      // Run all test scenarios
      const testResults = [];
      for (const scenario of testScenarios) {
        try {
          const result = await this.runLoadTest(scenario);
          testResults.push(result);
          
          // Wait between tests to avoid interference
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.error(`❌ Test "${scenario.name}" failed:`, error.message);
          testResults.push({
            result: null,
            analysis: { passed: false, issues: [error.message] }
          });
        }
      }

      // Run memory stress test
      const memoryTest = await this.runMemoryStressTest();
      
      // Generate comprehensive report
      this.generateFinalReport(testResults, memoryTest);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.stopServer();
    }
  }

  generateFinalReport(testResults, memoryTest) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 COMPREHENSIVE PERFORMANCE TEST REPORT');
    console.log('='.repeat(80));

    const passedTests = testResults.filter(t => t.analysis.passed).length;
    const totalTests = testResults.length;
    const overallPass = passedTests === totalTests && memoryTest.analysis.passed;

    console.log(`\n📊 Summary:`);
    console.log(`├─ Total Tests: ${totalTests}`);
    console.log(`├─ Passed: ${passedTests}`);
    console.log(`├─ Failed: ${totalTests - passedTests}`);
    console.log(`├─ Memory Test: ${memoryTest.analysis.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`└─ Overall Result: ${overallPass ? '✅ PASSED' : '❌ FAILED'}`);

    console.log(`\n🎯 Performance Benchmarks:`);
    testResults.forEach((test, index) => {
      if (test.result) {
        const throughput = test.result.requests.total / (test.result.duration / 1000);
        console.log(`├─ ${this.results[index].name}:`);
        console.log(`│  ├─ Throughput: ${throughput.toFixed(2)} req/s`);
        console.log(`│  ├─ P95 Latency: ${test.result.latency.p95}ms`);
        console.log(`│  └─ Status: ${test.analysis.passed ? '✅' : '❌'}`);
      }
    });

    // Recommendations for improvements
    console.log(`\n💡 Performance Recommendations:`);
    const allRecommendations = new Set();
    testResults.forEach(test => {
      if (test.analysis.recommendations) {
        test.analysis.recommendations.forEach(rec => allRecommendations.add(rec));
      }
    });

    if (allRecommendations.size > 0) {
      Array.from(allRecommendations).forEach(rec => {
        console.log(`├─ ${rec}`);
      });
    } else {
      console.log('├─ No specific recommendations - performance meets requirements');
    }

    // Critical issues
    const allIssues = [];
    testResults.forEach(test => {
      if (test.analysis.issues) {
        allIssues.push(...test.analysis.issues);
      }
    });

    if (memoryTest.analysis.issues) {
      allIssues.push(...memoryTest.analysis.issues);
    }

    if (allIssues.length > 0) {
      console.log(`\n⚠️  Critical Issues:`);
      allIssues.forEach(issue => {
        console.log(`├─ ${issue}`);
      });
    }

    // Export detailed results
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        overallPass
      },
      testResults: this.results,
      memoryTest,
      thresholds: this.thresholds
    };

    require('fs').writeFileSync(
      `performance-report-${Date.now()}.json`,
      JSON.stringify(reportData, null, 2)
    );

    console.log(`\n📄 Detailed report saved to: performance-report-${Date.now()}.json`);
    console.log('='.repeat(80));

    if (!overallPass) {
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const suite = new PerformanceTestSuite();
  
  suite.runComprehensiveTestSuite()
    .then(() => {
      console.log('✅ Performance test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance test suite failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceTestSuite;