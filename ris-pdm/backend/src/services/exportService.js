const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const AzureDevOpsService = require('./azureDevOpsService');
const MetricsCalculatorService = require('./metricsCalculator');
const { azureDevOpsConfig } = require('../config/azureDevOpsConfig');
const logger = require('../../utils/logger');

class ExportService {
  constructor() {
    this.azureService = new AzureDevOpsService(azureDevOpsConfig);
    this.metricsCalculator = new MetricsCalculatorService(this.azureService);
  }

  /**
   * Generate Dashboard PDF Report
   */
  async generateDashboardPDF(options) {
    const { period, startDate, endDate, user } = options;
    
    try {
      // Get dashboard data
      const dashboardData = await this.metricsCalculator.calculateOverviewMetrics({
        period,
        startDate,
        endDate
      });

      // Generate HTML for PDF
      const html = this.generateDashboardHTML(dashboardData, period);
      
      // Convert to PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        },
        printBackground: true,
        preferCSSPageSize: true
      });
      
      await browser.close();
      
      logger.info(`Dashboard PDF generated successfully`, {
        period,
        bufferSize: pdfBuffer.length,
        userId: user?.id
      });
      
      return pdfBuffer;
      
    } catch (error) {
      logger.error('Dashboard PDF generation failed:', error);
      throw new Error(`Failed to generate dashboard PDF: ${error.message}`);
    }
  }

  /**
   * Generate Dashboard Excel Report
   */
  async generateDashboardExcel(options) {
    const { period, startDate, endDate, user } = options;
    
    try {
      // Get dashboard data
      const dashboardData = await this.metricsCalculator.calculateOverviewMetrics({
        period,
        startDate,
        endDate
      });

      // Get team members data for detailed sheet
      const teamMembers = await this.metricsCalculator.getTeamMembersList();
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Dashboard Summary');
      await this.createDashboardSummarySheet(summarySheet, dashboardData, period);
      
      // KPI Details Sheet
      const kpiSheet = workbook.addWorksheet('KPI Details');
      await this.createKPIDetailsSheet(kpiSheet, dashboardData);
      
      // Team Overview Sheet
      const teamSheet = workbook.addWorksheet('Team Overview');
      await this.createTeamOverviewSheet(teamSheet, teamMembers);
      
      // Generate buffer
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      logger.info(`Dashboard Excel generated successfully`, {
        period,
        bufferSize: excelBuffer.length,
        userId: user?.id
      });
      
      return excelBuffer;
      
    } catch (error) {
      logger.error('Dashboard Excel generation failed:', error);
      throw new Error(`Failed to generate dashboard Excel: ${error.message}`);
    }
  }

  /**
   * Generate Individual Performance PDF
   */
  async generateIndividualPDF(options) {
    const { userId, period, startDate, endDate, user } = options;
    
    try {
      // Get individual metrics
      const individualData = await this.metricsCalculator.calculateIndividualMetrics(userId, {
        period,
        startDate,
        endDate
      });

      // Generate HTML for PDF
      const html = this.generateIndividualHTML(individualData, period);
      
      // Convert to PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        },
        printBackground: true,
        preferCSSPageSize: true
      });
      
      await browser.close();
      
      logger.info(`Individual PDF generated successfully`, {
        userId,
        period,
        bufferSize: pdfBuffer.length,
        requesterId: user?.id
      });
      
      return pdfBuffer;
      
    } catch (error) {
      logger.error('Individual PDF generation failed:', error);
      throw new Error(`Failed to generate individual PDF: ${error.message}`);
    }
  }

  /**
   * Generate Individual Performance Excel
   */
  async generateIndividualExcel(options) {
    const { userId, period, startDate, endDate, user } = options;
    
    try {
      // Get individual metrics
      const individualData = await this.metricsCalculator.calculateIndividualMetrics(userId, {
        period,
        startDate,
        endDate
      });
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Individual Summary Sheet
      const summarySheet = workbook.addWorksheet('Performance Summary');
      await this.createIndividualSummarySheet(summarySheet, individualData, period);
      
      // Work Items Detail Sheet
      const workItemsSheet = workbook.addWorksheet('Work Items');
      await this.createWorkItemsSheet(workItemsSheet, individualData.workItems);
      
      // Performance Trends Sheet
      const trendsSheet = workbook.addWorksheet('Trends');
      await this.createTrendsSheet(trendsSheet, individualData.trends);
      
      // Generate buffer
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      logger.info(`Individual Excel generated successfully`, {
        userId,
        period,
        bufferSize: excelBuffer.length,
        requesterId: user?.id
      });
      
      return excelBuffer;
      
    } catch (error) {
      logger.error('Individual Excel generation failed:', error);
      throw new Error(`Failed to generate individual Excel: ${error.message}`);
    }
  }

  /**
   * Generate Complete Team Data Excel
   */
  async generateTeamDataExcel(options) {
    const { period, startDate, endDate, user } = options;
    
    try {
      // Get all team members
      const teamMembers = await this.metricsCalculator.getTeamMembersList();
      
      // Get individual metrics for each team member
      const teamPerformanceData = [];
      for (const member of teamMembers.members || []) {
        try {
          const individualData = await this.metricsCalculator.calculateIndividualMetrics(member.email, {
            period,
            startDate,
            endDate
          });
          teamPerformanceData.push({
            member,
            performance: individualData
          });
        } catch (error) {
          logger.warn(`Failed to get metrics for ${member.email}:`, error.message);
        }
      }
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Team Summary Sheet
      const teamSummarySheet = workbook.addWorksheet('Team Summary');
      await this.createTeamSummarySheet(teamSummarySheet, teamPerformanceData, period);
      
      // Individual Performance Comparison Sheet
      const comparisonSheet = workbook.addWorksheet('Performance Comparison');
      await this.createPerformanceComparisonSheet(comparisonSheet, teamPerformanceData);
      
      // All Work Items Sheet
      const allWorkItemsSheet = workbook.addWorksheet('All Work Items');
      await this.createAllWorkItemsSheet(allWorkItemsSheet, teamPerformanceData);
      
      // Generate buffer
      const excelBuffer = await workbook.xlsx.writeBuffer();
      
      logger.info(`Team data Excel generated successfully`, {
        period,
        teamMembersCount: teamPerformanceData.length,
        bufferSize: excelBuffer.length,
        userId: user?.id
      });
      
      return excelBuffer;
      
    } catch (error) {
      logger.error('Team data Excel generation failed:', error);
      throw new Error(`Failed to generate team data Excel: ${error.message}`);
    }
  }

  /**
   * Generate HTML for Dashboard PDF
   */
  generateDashboardHTML(data, period) {
    const currentDate = new Date().toLocaleDateString();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>RIS Performance Dashboard - ${period.toUpperCase()}</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f8f9fa; 
                color: #333; 
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 { 
                color: #3b82f6; 
                margin: 0; 
                font-size: 32px; 
                font-weight: 700; 
            }
            .header p { 
                color: #6b7280; 
                margin: 10px 0 0 0; 
                font-size: 16px; 
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #3b82f6;
            }
            .metric-value {
                font-size: 28px;
                font-weight: 700;
                color: #1f2937;
                margin: 10px 0;
            }
            .metric-label {
                color: #6b7280;
                font-size: 14px;
                font-weight: 500;
            }
            .kpi-section {
                background: white;
                border-radius: 8px;
                padding: 25px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 30px;
            }
            .kpi-section h2 {
                color: #1f2937;
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 24px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
            }
            .kpi-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            .kpi-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background-color: #f9fafb;
                border-radius: 6px;
                border-left: 3px solid #10b981;
            }
            .kpi-label {
                font-weight: 500;
                color: #374151;
            }
            .kpi-value {
                font-weight: 700;
                color: #059669;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 12px;
            }
            @media print {
                body { background-color: white; }
                .metric-card, .kpi-section { 
                    break-inside: avoid; 
                    box-shadow: none;
                    border: 1px solid #e5e7eb;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>RIS Performance Dashboard</h1>
            <p>Period: ${period.toUpperCase()} | Generated: ${currentDate}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Total Team Members</div>
                <div class="metric-value">${data.summary?.totalTeamMembers || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Quality Score</div>
                <div class="metric-value">${data.summary?.avgQualityScore || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Active Projects</div>
                <div class="metric-value">${data.summary?.activeProjects || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Completed Work Items</div>
                <div class="metric-value">${data.summary?.completedWorkItems || 0}</div>
            </div>
        </div>

        <div class="kpi-section">
            <h2>Key Performance Indicators</h2>
            <div class="kpi-grid">
                <div class="kpi-item">
                    <span class="kpi-label">Delivery Predictability</span>
                    <span class="kpi-value">${data.kpis?.deliveryPredictability || 0}%</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-label">Team Satisfaction</span>
                    <span class="kpi-value">${data.kpis?.teamSatisfaction || 0}/10</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-label">Code Quality</span>
                    <span class="kpi-value">${data.kpis?.codeQuality || 0}/10</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-label">Cycle Time</span>
                    <span class="kpi-value">${data.kpis?.cycleTime || 0} days</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-label">Lead Time</span>
                    <span class="kpi-value">${data.kpis?.leadTime || 0} days</span>
                </div>
                <div class="kpi-item">
                    <span class="kpi-label">Defect Escape Rate</span>
                    <span class="kpi-value">${data.kpis?.defectEscapeRate || 0}%</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>RIS Performance Dashboard | Generated on ${currentDate}</p>
            <p>This report contains performance metrics from Azure DevOps integration</p>
        </div>
    </body>
    </html>`;
  }

  /**
   * Generate HTML for Individual PDF
   */
  generateIndividualHTML(data, period) {
    const currentDate = new Date().toLocaleDateString();
    const userName = data.userInfo?.name || 'Unknown User';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Individual Performance Report - ${userName}</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f8f9fa; 
                color: #333; 
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #3b82f6;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .header h1 { 
                color: #3b82f6; 
                margin: 0; 
                font-size: 28px; 
                font-weight: 700; 
            }
            .header p { 
                color: #6b7280; 
                margin: 10px 0 0 0; 
                font-size: 16px; 
            }
            .user-info {
                background: white;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
            }
            .user-avatar {
                width: 60px;
                height: 60px;
                background: #3b82f6;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
                margin-right: 20px;
            }
            .user-details h2 {
                margin: 0;
                color: #1f2937;
                font-size: 24px;
            }
            .user-details p {
                margin: 5px 0 0 0;
                color: #6b7280;
            }
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #10b981;
            }
            .metric-value {
                font-size: 24px;
                font-weight: 700;
                color: #1f2937;
                margin: 10px 0;
            }
            .metric-label {
                color: #6b7280;
                font-size: 14px;
                font-weight: 500;
            }
            .work-items-section {
                background: white;
                border-radius: 8px;
                padding: 25px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 30px;
            }
            .work-items-section h2 {
                color: #1f2937;
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 20px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
            }
            .work-item {
                padding: 12px;
                border-bottom: 1px solid #f3f4f6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .work-item:last-child {
                border-bottom: none;
            }
            .work-item-title {
                font-weight: 500;
                color: #1f2937;
            }
            .work-item-meta {
                color: #6b7280;
                font-size: 12px;
            }
            .work-item-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            .status-done {
                background-color: #d1fae5;
                color: #065f46;
            }
            .status-inprogress {
                background-color: #dbeafe;
                color: #1e40af;
            }
            .status-todo {
                background-color: #f3f4f6;
                color: #374151;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Individual Performance Report</h1>
            <p>Period: ${period.toUpperCase()} | Generated: ${currentDate}</p>
        </div>

        <div class="user-info">
            <div class="user-avatar">
                ${userName.charAt(0).toUpperCase()}
            </div>
            <div class="user-details">
                <h2>${userName}</h2>
                <p>${data.userInfo?.email || ''}</p>
                <p>Role: ${data.userInfo?.role || 'Developer'}</p>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Task Completion Rate</div>
                <div class="metric-value">${data.performance?.taskCompletionRate?.toFixed(1) || 0}%</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Story Points Delivered</div>
                <div class="metric-value">${data.performance?.storyPointsDelivered || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Quality Score</div>
                <div class="metric-value">${data.performance?.qualityScore || 0}/10</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Cycle Time</div>
                <div class="metric-value">${data.performance?.cycleTime || 0} days</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Bugs Created/Fixed</div>
                <div class="metric-value">${data.quality?.bugsCreated || 0}/${data.quality?.bugsFixed || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Productivity Score</div>
                <div class="metric-value">${data.performance?.productivity || 0}</div>
            </div>
        </div>

        <div class="work-items-section">
            <h2>Recent Work Items</h2>
            ${(data.workItems?.recent || []).slice(0, 10).map(item => `
            <div class="work-item">
                <div>
                    <div class="work-item-title">#${item.id}: ${item.title}</div>
                    <div class="work-item-meta">${item.type} | ${item.storyPoints || 0} SP</div>
                </div>
                <div class="work-item-status ${this.getStatusClass(item.state)}">
                    ${item.state}
                </div>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>RIS Individual Performance Report | Generated on ${currentDate}</p>
            <p>Data sourced from Azure DevOps integration</p>
        </div>
    </body>
    </html>`;
  }

  /**
   * Create Dashboard Summary Sheet for Excel
   */
  async createDashboardSummarySheet(sheet, data, period) {
    // Set column widths
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Unit', key: 'unit', width: 15 }
    ];

    // Add header
    sheet.addRow(['RIS Performance Dashboard Summary', '', '']);
    sheet.addRow(['Period:', period.toUpperCase(), '']);
    sheet.addRow(['Generated:', new Date().toLocaleDateString(), '']);
    sheet.addRow(['', '', '']); // Empty row

    // Style header
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: '3B82F6' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add summary metrics
    const summaryData = [
      ['Total Team Members', data.summary?.totalTeamMembers || 0, 'members'],
      ['Average Quality Score', data.summary?.avgQualityScore || 0, 'score'],
      ['Active Projects', data.summary?.activeProjects || 0, 'projects'],
      ['Completed Work Items', data.summary?.completedWorkItems || 0, 'items'],
      ['Average Velocity', data.summary?.avgVelocity || 0, 'points/sprint'],
      ['Total Work Items', data.summary?.totalWorkItems || 0, 'items']
    ];

    summaryData.forEach(row => {
      sheet.addRow(row);
    });

    // Add KPI section
    sheet.addRow(['', '', '']); // Empty row
    sheet.addRow(['Key Performance Indicators', '', '']);
    
    const kpiData = [
      ['Delivery Predictability', data.kpis?.deliveryPredictability || 0, '%'],
      ['Team Satisfaction', data.kpis?.teamSatisfaction || 0, '/10'],
      ['Code Quality', data.kpis?.codeQuality || 0, '/10'],
      ['Cycle Time', data.kpis?.cycleTime || 0, 'days'],
      ['Lead Time', data.kpis?.leadTime || 0, 'days'],
      ['Defect Escape Rate', data.kpis?.defectEscapeRate || 0, '%']
    ];

    kpiData.forEach(row => {
      sheet.addRow(row);
    });

    // Apply styling
    this.applyExcelStyling(sheet);
  }

  /**
   * Create KPI Details Sheet for Excel
   */
  async createKPIDetailsSheet(sheet, data) {
    sheet.columns = [
      { header: 'KPI Category', key: 'category', width: 25 },
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Current Value', key: 'current', width: 15 },
      { header: 'Previous Value', key: 'previous', width: 15 },
      { header: 'Trend', key: 'trend', width: 10 },
      { header: 'Target', key: 'target', width: 15 }
    ];

    const kpiDetails = [
      ['Delivery', 'Delivery Predictability', data.kpis?.deliveryPredictability || 0, 75, '▲', '≥80%'],
      ['Team', 'Team Satisfaction', data.kpis?.teamSatisfaction || 0, 7.5, '▲', '≥8.0'],
      ['Quality', 'Code Quality Score', data.kpis?.codeQuality || 0, 8.8, '▲', '≥8.5'],
      ['Process', 'Cycle Time', data.kpis?.cycleTime || 0, 14, '▼', '≤10 days'],
      ['Process', 'Lead Time', data.kpis?.leadTime || 0, 18, '▼', '≤15 days'],
      ['Quality', 'Defect Escape Rate', data.kpis?.defectEscapeRate || 0, 0.8, '▼', '≤0.5%']
    ];

    kpiDetails.forEach(row => {
      sheet.addRow(row);
    });

    this.applyExcelStyling(sheet);
  }

  /**
   * Create Team Overview Sheet for Excel
   */
  async createTeamOverviewSheet(sheet, teamData) {
    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    if (teamData.members && teamData.members.length > 0) {
      teamData.members.forEach(member => {
        sheet.addRow({
          name: member.name || 'Unknown',
          email: member.email || '',
          role: member.role || 'Developer',
          status: 'Active'
        });
      });
    }

    this.applyExcelStyling(sheet);
  }

  /**
   * Helper function to apply Excel styling
   */
  applyExcelStyling(sheet) {
    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '3B82F6' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Apply borders to all cells with data
    sheet.eachRow((row, rowIndex) => {
      if (rowIndex > 1) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'E5E7EB' } },
            left: { style: 'thin', color: { argb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
            right: { style: 'thin', color: { argb: 'E5E7EB' } }
          };
        });
      }
    });
  }

  /**
   * Helper functions for individual reports
   */
  async createIndividualSummarySheet(sheet, data, period) {
    const userName = data.userInfo?.name || 'Unknown User';
    
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    // Add header info
    sheet.addRow(['Individual Performance Report', '']);
    sheet.addRow(['Name:', userName]);
    sheet.addRow(['Email:', data.userInfo?.email || '']);
    sheet.addRow(['Role:', data.userInfo?.role || 'Developer']);
    sheet.addRow(['Period:', period.toUpperCase()]);
    sheet.addRow(['Generated:', new Date().toLocaleDateString()]);
    sheet.addRow(['', '']); // Empty row

    // Performance metrics
    const metrics = [
      ['Task Completion Rate', `${data.performance?.taskCompletionRate?.toFixed(1) || 0}%`],
      ['Story Points Delivered', data.performance?.storyPointsDelivered || 0],
      ['Average Velocity', data.performance?.averageVelocity || 0],
      ['Quality Score', `${data.performance?.qualityScore || 0}/10`],
      ['Cycle Time', `${data.performance?.cycleTime || 0} days`],
      ['Productivity Score', data.performance?.productivity || 0],
      ['Bugs Created', data.quality?.bugsCreated || 0],
      ['Bugs Fixed', data.quality?.bugsFixed || 0],
      ['Bug Ratio', `${(data.quality?.bugRatio * 100)?.toFixed(1) || 0}%`]
    ];

    metrics.forEach(row => {
      sheet.addRow(row);
    });

    this.applyExcelStyling(sheet);
  }

  async createWorkItemsSheet(sheet, workItemsData) {
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Story Points', key: 'storyPoints', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 }
    ];

    if (workItemsData.recent && workItemsData.recent.length > 0) {
      workItemsData.recent.forEach(item => {
        sheet.addRow({
          id: item.id,
          title: item.title,
          type: item.type,
          state: item.state,
          storyPoints: item.storyPoints || 0,
          priority: item.priority || 'Medium'
        });
      });
    }

    this.applyExcelStyling(sheet);
  }

  async createTrendsSheet(sheet, trendsData) {
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Velocity', key: 'velocity', width: 12 },
      { header: 'Quality', key: 'quality', width: 12 },
      { header: 'Productivity', key: 'productivity', width: 15 }
    ];

    if (trendsData.velocity && trendsData.velocity.length > 0) {
      trendsData.velocity.forEach((item, index) => {
        sheet.addRow({
          date: item.date || `Period ${index + 1}`,
          velocity: item.value || 0,
          quality: trendsData.quality?.[index]?.value || 0,
          productivity: trendsData.productivity?.[index]?.value || 0
        });
      });
    }

    this.applyExcelStyling(sheet);
  }

  // Additional helper methods for team data export
  async createTeamSummarySheet(sheet, teamPerformanceData, period) {
    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Completion Rate', key: 'completionRate', width: 18 },
      { header: 'Story Points', key: 'storyPoints', width: 15 },
      { header: 'Quality Score', key: 'qualityScore', width: 15 },
      { header: 'Cycle Time', key: 'cycleTime', width: 12 }
    ];

    teamPerformanceData.forEach(({ member, performance }) => {
      sheet.addRow({
        name: member.name,
        email: member.email,
        role: member.role || 'Developer',
        completionRate: `${performance?.performance?.taskCompletionRate?.toFixed(1) || 0}%`,
        storyPoints: performance?.performance?.storyPointsDelivered || 0,
        qualityScore: `${performance?.performance?.qualityScore || 0}/10`,
        cycleTime: `${performance?.performance?.cycleTime || 0} days`
      });
    });

    this.applyExcelStyling(sheet);
  }

  async createPerformanceComparisonSheet(sheet, teamPerformanceData) {
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Team Average', key: 'teamAvg', width: 15 },
      { header: 'Best Performer', key: 'best', width: 20 },
      { header: 'Value', key: 'bestValue', width: 15 }
    ];

    // Calculate team averages and best performers
    const metrics = this.calculateTeamMetrics(teamPerformanceData);
    
    Object.entries(metrics).forEach(([key, data]) => {
      sheet.addRow({
        metric: data.label,
        teamAvg: data.average.toFixed(1),
        best: data.bestPerformer,
        bestValue: data.bestValue.toFixed(1)
      });
    });

    this.applyExcelStyling(sheet);
  }

  async createAllWorkItemsSheet(sheet, teamPerformanceData) {
    sheet.columns = [
      { header: 'Assignee', key: 'assignee', width: 25 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Story Points', key: 'storyPoints', width: 15 }
    ];

    teamPerformanceData.forEach(({ member, performance }) => {
      if (performance?.workItems?.recent) {
        performance.workItems.recent.forEach(item => {
          sheet.addRow({
            assignee: member.name,
            id: item.id,
            title: item.title,
            type: item.type,
            state: item.state,
            storyPoints: item.storyPoints || 0
          });
        });
      }
    });

    this.applyExcelStyling(sheet);
  }

  calculateTeamMetrics(teamPerformanceData) {
    const validData = teamPerformanceData.filter(item => item.performance && item.performance.performance);
    
    if (validData.length === 0) {
      return {};
    }

    const metrics = {
      taskCompletionRate: { label: 'Task Completion Rate (%)', values: [] },
      storyPointsDelivered: { label: 'Story Points Delivered', values: [] },
      qualityScore: { label: 'Quality Score', values: [] },
      cycleTime: { label: 'Cycle Time (days)', values: [] }
    };

    validData.forEach(({ member, performance }) => {
      const perf = performance.performance;
      metrics.taskCompletionRate.values.push({ name: member.name, value: perf.taskCompletionRate || 0 });
      metrics.storyPointsDelivered.values.push({ name: member.name, value: perf.storyPointsDelivered || 0 });
      metrics.qualityScore.values.push({ name: member.name, value: perf.qualityScore || 0 });
      metrics.cycleTime.values.push({ name: member.name, value: perf.cycleTime || 0 });
    });

    // Calculate averages and best performers
    Object.keys(metrics).forEach(key => {
      const values = metrics[key].values;
      const sum = values.reduce((acc, item) => acc + item.value, 0);
      metrics[key].average = sum / values.length;
      
      const best = values.reduce((prev, curr) => {
        if (key === 'cycleTime') {
          return curr.value < prev.value ? curr : prev;
        }
        return curr.value > prev.value ? curr : prev;
      });
      
      metrics[key].bestPerformer = best.name;
      metrics[key].bestValue = best.value;
    });

    return metrics;
  }

  getStatusClass(state) {
    const lowerState = state?.toLowerCase() || '';
    if (['closed', 'done', 'resolved'].includes(lowerState)) {
      return 'status-done';
    }
    if (['active', 'in progress'].includes(lowerState)) {
      return 'status-inprogress';
    }
    return 'status-todo';
  }
}

module.exports = new ExportService();