/**
 * Comprehensive Test Coverage Reporter for RIS Performance Dashboard
 * Generates detailed coverage reports and enforces PRD requirements
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CoverageReporter {
  constructor() {
    this.thresholds = {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    };
    
    this.coverageDir = path.join(__dirname, '../coverage');
    this.reportsDir = path.join(__dirname, '../coverage-reports');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.coverageDir, this.reportsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async generateBackendCoverage() {
    console.log('📊 Generating backend test coverage...');
    
    try {
      // Run Jest with coverage
      const { stdout, stderr } = await execAsync('npm run test:coverage', {
        cwd: path.join(__dirname, '..')
      });
      
      console.log('✅ Backend coverage generated successfully');
      return this.parseCoverageOutput(stdout);
    } catch (error) {
      console.error('❌ Backend coverage generation failed:', error.message);
      throw error;
    }
  }

  async generateFrontendCoverage() {
    console.log('📊 Generating frontend test coverage...');
    
    const frontendDir = path.join(__dirname, '../../../frontend');
    
    if (!fs.existsSync(frontendDir)) {
      console.warn('⚠️ Frontend directory not found, skipping frontend coverage');
      return null;
    }

    try {
      const { stdout, stderr } = await execAsync('npm run test:coverage', {
        cwd: frontendDir
      });
      
      console.log('✅ Frontend coverage generated successfully');
      return this.parseCoverageOutput(stdout);
    } catch (error) {
      console.error('❌ Frontend coverage generation failed:', error.message);
      throw error;
    }
  }

  parseCoverageOutput(output) {
    // Parse Jest coverage output
    const lines = output.split('\n');
    const summaryLine = lines.find(line => line.includes('All files'));
    
    if (!summaryLine) {
      return null;
    }

    // Extract coverage percentages using regex
    const percentages = summaryLine.match(/(\d+\.?\d*)\s*%/g);
    
    if (!percentages || percentages.length < 4) {
      return null;
    }

    return {
      statements: parseFloat(percentages[0]),
      branches: parseFloat(percentages[1]),
      functions: parseFloat(percentages[2]),
      lines: parseFloat(percentages[3])
    };
  }

  validateCoverage(coverage, component) {
    if (!coverage) {
      return {
        passed: false,
        issues: [`${component} coverage data not available`]
      };
    }

    const issues = [];
    const passed = Object.entries(this.thresholds).every(([metric, threshold]) => {
      const actual = coverage[metric];
      if (actual < threshold) {
        issues.push(`${component} ${metric} coverage ${actual}% < ${threshold}% (threshold)`);
        return false;
      }
      return true;
    });

    return { passed, issues };
  }

  async generateDetailedReport() {
    console.log('📋 Generating detailed coverage report...');

    try {
      // Generate coverage for both backend and frontend
      const [backendCoverage, frontendCoverage] = await Promise.allSettled([
        this.generateBackendCoverage(),
        this.generateFrontendCoverage()
      ]);

      const report = {
        timestamp: new Date().toISOString(),
        thresholds: this.thresholds,
        backend: {
          coverage: backendCoverage.status === 'fulfilled' ? backendCoverage.value : null,
          validation: null
        },
        frontend: {
          coverage: frontendCoverage.status === 'fulfilled' ? frontendCoverage.value : null,
          validation: null
        },
        overall: {
          passed: true,
          issues: []
        }
      };

      // Validate backend coverage
      if (report.backend.coverage) {
        report.backend.validation = this.validateCoverage(report.backend.coverage, 'Backend');
      }

      // Validate frontend coverage
      if (report.frontend.coverage) {
        report.frontend.validation = this.validateCoverage(report.frontend.coverage, 'Frontend');
      }

      // Calculate overall status
      const allValidations = [report.backend.validation, report.frontend.validation].filter(Boolean);
      
      report.overall.passed = allValidations.every(v => v.passed);
      report.overall.issues = allValidations.flatMap(v => v.issues || []);

      // Generate HTML report
      await this.generateHTMLReport(report);
      
      // Generate JSON report
      await this.generateJSONReport(report);
      
      // Generate console summary
      this.printSummary(report);

      return report;

    } catch (error) {
      console.error('❌ Failed to generate detailed coverage report:', error);
      throw error;
    }
  }

  async generateHTMLReport(report) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RIS Performance Dashboard - Test Coverage Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
        }
        .timestamp {
            opacity: 0.9;
            margin-top: 10px;
        }
        .section {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        .section:last-child {
            border-bottom: none;
        }
        .section h2 {
            color: #333;
            margin-top: 0;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .coverage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .coverage-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #f9f9f9;
        }
        .coverage-card h3 {
            margin-top: 0;
            color: #555;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding: 8px 12px;
            border-radius: 4px;
            background: white;
        }
        .metric-label {
            font-weight: 500;
        }
        .metric-value {
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .metric-pass {
            background: #d4edda;
            color: #155724;
        }
        .metric-fail {
            background: #f8d7da;
            color: #721c24;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.8rem;
        }
        .status-pass {
            background: #d4edda;
            color: #155724;
        }
        .status-fail {
            background: #f8d7da;
            color: #721c24;
        }
        .issues-list {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 15px;
            margin-top: 15px;
        }
        .issues-list h4 {
            margin-top: 0;
            color: #856404;
        }
        .issues-list ul {
            margin-bottom: 0;
        }
        .issues-list li {
            color: #856404;
            margin: 5px 0;
        }
        .no-data {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .thresholds {
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .thresholds h4 {
            margin-top: 0;
            color: #1565c0;
        }
        footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Coverage Report</h1>
            <div class="timestamp">Generated on ${new Date(report.timestamp).toLocaleString()}</div>
        </div>

        <div class="section">
            <h2>📊 Overall Status</h2>
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge ${report.overall.passed ? 'status-pass' : 'status-fail'}">
                    ${report.overall.passed ? '✅ PASSED' : '❌ FAILED'}
                </span>
            </div>
            
            <div class="thresholds">
                <h4>Coverage Thresholds (PRD Requirement)</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    ${Object.entries(this.thresholds).map(([metric, threshold]) => 
                        `<div><strong>${metric}:</strong> ${threshold}%</div>`
                    ).join('')}
                </div>
            </div>

            ${report.overall.issues && report.overall.issues.length > 0 ? `
                <div class="issues-list">
                    <h4>⚠️ Issues Found</h4>
                    <ul>
                        ${report.overall.issues.map(issue => `<li>${issue}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>

        <div class="section">
            <h2>🔧 Backend Coverage</h2>
            ${this.generateCoverageSection(report.backend)}
        </div>

        <div class="section">
            <h2>🎨 Frontend Coverage</h2>
            ${this.generateCoverageSection(report.frontend)}
        </div>

        <footer>
            <p>RIS Performance Dashboard | Test Coverage Report</p>
            <p>Generated by automated testing pipeline</p>
        </footer>
    </div>
</body>
</html>`;

    const reportPath = path.join(this.reportsDir, 'coverage-report.html');
    fs.writeFileSync(reportPath, htmlContent);
    console.log(`📄 HTML report generated: ${reportPath}`);
  }

  generateCoverageSection(componentData) {
    if (!componentData.coverage) {
      return '<div class="no-data">📭 No coverage data available</div>';
    }

    const coverage = componentData.coverage;
    const validation = componentData.validation || { passed: true, issues: [] };

    return `
        <div class="coverage-card">
            <h3>Coverage Metrics</h3>
            ${Object.entries(coverage).map(([metric, value]) => {
                const threshold = this.thresholds[metric];
                const passed = value >= threshold;
                return `
                    <div class="metric">
                        <span class="metric-label">${metric.charAt(0).toUpperCase() + metric.slice(1)}:</span>
                        <span class="metric-value ${passed ? 'metric-pass' : 'metric-fail'}">
                            ${value.toFixed(1)}% / ${threshold}%
                        </span>
                    </div>
                `;
            }).join('')}
            
            <div style="margin-top: 15px;">
                <span class="status-badge ${validation.passed ? 'status-pass' : 'status-fail'}">
                    ${validation.passed ? 'PASSED' : 'FAILED'}
                </span>
            </div>
        </div>
    `;
  }

  async generateJSONReport(report) {
    const reportPath = path.join(this.reportsDir, 'coverage-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report generated: ${reportPath}`);
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📋 TEST COVERAGE SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n🎯 Overall Status: ${report.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (report.backend.coverage) {
      console.log('\n🔧 Backend Coverage:');
      Object.entries(report.backend.coverage).forEach(([metric, value]) => {
        const threshold = this.thresholds[metric];
        const status = value >= threshold ? '✅' : '❌';
        console.log(`  ${status} ${metric}: ${value.toFixed(1)}% (threshold: ${threshold}%)`);
      });
    }

    if (report.frontend.coverage) {
      console.log('\n🎨 Frontend Coverage:');
      Object.entries(report.frontend.coverage).forEach(([metric, value]) => {
        const threshold = this.thresholds[metric];
        const status = value >= threshold ? '✅' : '❌';
        console.log(`  ${status} ${metric}: ${value.toFixed(1)}% (threshold: ${threshold}%)`);
      });
    }

    if (report.overall.issues && report.overall.issues.length > 0) {
      console.log('\n⚠️ Issues Found:');
      report.overall.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

    console.log('\n📄 Reports generated in:', this.reportsDir);
    console.log('='.repeat(80));
  }

  async generateTrendReport() {
    console.log('📈 Generating coverage trend report...');
    
    const trendsFile = path.join(this.reportsDir, 'coverage-trends.json');
    let trends = [];
    
    // Load existing trends
    if (fs.existsSync(trendsFile)) {
      try {
        trends = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️ Could not load existing trends:', error.message);
      }
    }

    // Generate current coverage
    const currentReport = await this.generateDetailedReport();
    
    // Add to trends
    const trendEntry = {
      timestamp: currentReport.timestamp,
      backend: currentReport.backend.coverage,
      frontend: currentReport.frontend.coverage,
      overall: currentReport.overall.passed
    };
    
    trends.push(trendEntry);
    
    // Keep only last 30 entries
    trends = trends.slice(-30);
    
    // Save trends
    fs.writeFileSync(trendsFile, JSON.stringify(trends, null, 2));
    
    console.log('📈 Coverage trends updated');
    return trends;
  }
}

// CLI interface
if (require.main === module) {
  const reporter = new CoverageReporter();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'report';

  async function run() {
    try {
      switch (command) {
        case 'report':
          const report = await reporter.generateDetailedReport();
          process.exit(report.overall.passed ? 0 : 1);
          break;
          
        case 'trends':
          await reporter.generateTrendReport();
          process.exit(0);
          break;
          
        case 'backend':
          const backendCoverage = await reporter.generateBackendCoverage();
          console.log('Backend Coverage:', backendCoverage);
          process.exit(0);
          break;
          
        case 'frontend':
          const frontendCoverage = await reporter.generateFrontendCoverage();
          console.log('Frontend Coverage:', frontendCoverage);
          process.exit(0);
          break;
          
        default:
          console.error('Unknown command:', command);
          console.log('Available commands: report, trends, backend, frontend');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Coverage reporting failed:', error);
      process.exit(1);
    }
  }

  run();
}

module.exports = CoverageReporter;