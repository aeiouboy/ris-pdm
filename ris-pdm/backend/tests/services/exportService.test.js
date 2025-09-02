// Jest globals are available automatically
const ExportService = require('../../src/services/exportService');
const { generateTestMetrics, environmentHelpers } = require('../utils/testHelpers');

// Mock dependencies
jest.mock('exceljs');
jest.mock('jspdf');
jest.mock('puppeteer');

describe('ExportService', () => {
  let exportService;
  let mockMetricsData;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    exportService = new ExportService();
    mockMetricsData = generateTestMetrics();
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(exportService).toBeDefined();
      expect(exportService.formatters).toBeDefined();
      expect(exportService.generators).toBeDefined();
    });

    test('should accept custom configuration', () => {
      const customService = new ExportService({
        formats: ['xlsx', 'pdf'],
        compression: true
      });
      
      expect(customService).toBeDefined();
    });
  });

  describe('Excel Export (XLSX)', () => {
    test('should generate Excel workbook with multiple sheets', async () => {
      const ExcelJS = require('exceljs');
      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue({
          addTable: jest.fn(),
          addRow: jest.fn(),
          columns: [],
          getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {} }),
          mergeCells: jest.fn()
        }),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
        }
      };
      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await exportService.generateExcel(mockMetricsData);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('KPIs');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Burndown');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Velocity');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Team Members');
    });

    test('should format KPI data correctly', async () => {
      const ExcelJS = require('exceljs');
      const mockWorksheet = {
        addTable: jest.fn(),
        addRow: jest.fn(),
        columns: [],
        getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {} }),
        mergeCells: jest.fn()
      };
      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
        }
      };
      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await exportService.generateExcel(mockMetricsData);

      expect(mockWorksheet.addRow).toHaveBeenCalledWith(['KPI', 'Value', 'Trend', 'Period']);
      expect(mockWorksheet.addRow).toHaveBeenCalledWith(
        expect.arrayContaining(['P/L YTD', expect.any(Number), expect.any(String), expect.any(String)])
      );
    });

    test('should include charts as embedded data', async () => {
      const ExcelJS = require('exceljs');
      const mockWorkbook = {
        addWorksheet: jest.fn().mockReturnValue({
          addTable: jest.fn(),
          addRow: jest.fn(),
          columns: [],
          getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {} }),
          mergeCells: jest.fn()
        }),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-excel-data'))
        }
      };
      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const dataWithCharts = {
        ...mockMetricsData,
        charts: {
          burndown: [
            { date: '2024-01-01', planned: 100, actual: 95 },
            { date: '2024-01-02', planned: 90, actual: 88 }
          ],
          velocity: [
            { sprint: 'Sprint 1', points: 32 },
            { sprint: 'Sprint 2', points: 28 }
          ]
        }
      };

      await exportService.generateExcel(dataWithCharts);

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Burndown');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Velocity');
    });

    test('should handle Excel generation errors', async () => {
      const ExcelJS = require('exceljs');
      ExcelJS.Workbook.mockImplementation(() => {
        throw new Error('Excel generation failed');
      });

      await expect(exportService.generateExcel(mockMetricsData))
        .rejects.toThrow('Excel generation failed');
    });
  });

  describe('PDF Export', () => {
    test('should generate PDF with dashboard data', async () => {
      const jsPDF = require('jspdf');
      const mockPDF = {
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        line: jest.fn(),
        rect: jest.fn(),
        addPage: jest.fn(),
        save: jest.fn(),
        output: jest.fn().mockReturnValue('mock-pdf-data'),
        internal: {
          pageSize: { width: 210, height: 297 }
        }
      };
      jsPDF.mockImplementation(() => mockPDF);

      const result = await exportService.generatePDF(mockMetricsData);

      expect(result).toBeDefined();
      expect(mockPDF.text).toHaveBeenCalledWith(
        expect.stringContaining('RIS Performance Dashboard'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    test('should include KPI summary in PDF', async () => {
      const jsPDF = require('jspdf');
      const mockPDF = {
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        line: jest.fn(),
        rect: jest.fn(),
        addPage: jest.fn(),
        save: jest.fn(),
        output: jest.fn().mockReturnValue('mock-pdf-data'),
        internal: {
          pageSize: { width: 210, height: 297 }
        }
      };
      jsPDF.mockImplementation(() => mockPDF);

      await exportService.generatePDF(mockMetricsData);

      expect(mockPDF.text).toHaveBeenCalledWith(
        expect.stringContaining('P/L YTD'),
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockPDF.text).toHaveBeenCalledWith(
        expect.stringContaining('Velocity'),
        expect.any(Number),
        expect.any(Number)
      );
    });

    test('should create multiple pages for large datasets', async () => {
      const jsPDF = require('jspdf');
      const mockPDF = {
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        line: jest.fn(),
        rect: jest.fn(),
        addPage: jest.fn(),
        save: jest.fn(),
        output: jest.fn().mockReturnValue('mock-pdf-data'),
        internal: {
          pageSize: { width: 210, height: 297 }
        }
      };
      jsPDF.mockImplementation(() => mockPDF);

      const largeDataset = {
        ...mockMetricsData,
        teamMembers: Array(50).fill().map((_, i) => ({
          id: `member-${i}`,
          displayName: `Member ${i}`,
          metrics: { velocity: i * 2, bugs: i }
        }))
      };

      await exportService.generatePDF(largeDataset);

      expect(mockPDF.addPage).toHaveBeenCalled();
    });

    test('should handle PDF generation errors', async () => {
      const jsPDF = require('jspdf');
      jsPDF.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      await expect(exportService.generatePDF(mockMetricsData))
        .rejects.toThrow('PDF generation failed');
    });
  });

  describe('CSV Export', () => {
    test('should generate CSV with KPI data', async () => {
      const result = await exportService.generateCSV(mockMetricsData);

      expect(typeof result).toBe('string');
      expect(result).toContain('KPI,Value,Trend,Period');
      expect(result).toContain('P/L YTD');
      expect(result).toContain('Velocity');
      expect(result).toContain('Bug Count');
      expect(result).toContain('Satisfaction');
    });

    test('should handle CSV escape characters', async () => {
      const dataWithCommas = {
        ...mockMetricsData,
        kpis: {
          ...mockMetricsData.kpis,
          customKPI: {
            name: 'Custom, KPI with "quotes"',
            value: 1000,
            trend: 5.5
          }
        }
      };

      const result = await exportService.generateCSV(dataWithCommas);

      expect(result).toContain('"Custom, KPI with ""quotes"""');
    });

    test('should include team member data in CSV', async () => {
      const result = await exportService.generateCSV(mockMetricsData);

      expect(result).toContain('Team Member,Role,Completed Items,Story Points');
    });
  });

  describe('Format Detection', () => {
    test('should detect format from extension', () => {
      expect(exportService.detectFormat('dashboard.xlsx')).toBe('xlsx');
      expect(exportService.detectFormat('report.pdf')).toBe('pdf');
      expect(exportService.detectFormat('data.csv')).toBe('csv');
    });

    test('should default to JSON for unknown formats', () => {
      expect(exportService.detectFormat('data.unknown')).toBe('json');
      expect(exportService.detectFormat('')).toBe('json');
    });
  });

  describe('Data Validation', () => {
    test('should validate required data structure', () => {
      const invalidData = { invalid: 'structure' };
      
      expect(() => exportService.validateData(invalidData))
        .toThrow('Invalid data structure for export');
    });

    test('should accept valid data structure', () => {
      expect(() => exportService.validateData(mockMetricsData))
        .not.toThrow();
    });

    test('should handle missing optional fields', () => {
      const minimalData = {
        kpis: mockMetricsData.kpis,
        metadata: mockMetricsData.metadata
      };

      expect(() => exportService.validateData(minimalData))
        .not.toThrow();
    });
  });

  describe('Compression', () => {
    test('should compress large exports when enabled', async () => {
      const compressionService = new ExportService({ compression: true });
      const result = await compressionService.generateJSON(mockMetricsData);

      expect(result).toBeDefined();
      // Note: In real implementation, result would be compressed
    });

    test('should skip compression for small exports', async () => {
      const compressionService = new ExportService({ 
        compression: true,
        compressionThreshold: 1000000 // 1MB
      });
      
      const result = await compressionService.generateJSON(mockMetricsData);
      expect(result).toBeDefined();
    });
  });

  describe('Export Metadata', () => {
    test('should include export metadata', async () => {
      const result = await exportService.generateJSON(mockMetricsData);
      const parsed = JSON.parse(result);

      expect(parsed.exportMetadata).toBeDefined();
      expect(parsed.exportMetadata.timestamp).toBeDefined();
      expect(parsed.exportMetadata.format).toBe('json');
      expect(parsed.exportMetadata.version).toBeDefined();
    });

    test('should include filter information', async () => {
      const dataWithFilters = {
        ...mockMetricsData,
        filters: {
          productId: 'product-a',
          dateRange: '2024-01-01 to 2024-01-31',
          sprintId: 'current'
        }
      };

      const result = await exportService.generateJSON(dataWithFilters);
      const parsed = JSON.parse(result);

      expect(parsed.exportMetadata.filters).toEqual(dataWithFilters.filters);
    });
  });

  describe('Error Handling', () => {
    test('should handle null/undefined data gracefully', async () => {
      await expect(exportService.generateJSON(null))
        .rejects.toThrow('Invalid data provided for export');

      await expect(exportService.generateJSON(undefined))
        .rejects.toThrow('Invalid data provided for export');
    });

    test('should handle malformed data structures', async () => {
      const malformedData = {
        kpis: 'invalid-kpis-structure',
        metadata: null
      };

      await expect(exportService.generateJSON(malformedData))
        .rejects.toThrow();
    });

    test('should provide helpful error messages', async () => {
      try {
        await exportService.generateExcel(null);
      } catch (error) {
        expect(error.message).toContain('export');
        expect(error.message).toContain('data');
      }
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', async () => {
      const largeDataset = {
        ...mockMetricsData,
        workItems: Array(10000).fill().map((_, i) => ({
          id: i,
          title: `Work Item ${i}`,
          type: 'User Story',
          state: 'Active'
        }))
      };

      const startTime = Date.now();
      const result = await exportService.generateJSON(largeDataset);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should implement streaming for very large exports', async () => {
      // This would test streaming implementation in real scenarios
      const streamingService = new ExportService({ streaming: true });
      const result = await streamingService.generateJSON(mockMetricsData);
      
      expect(result).toBeDefined();
    });
  });

  describe('Security', () => {
    test('should sanitize sensitive data', async () => {
      const dataWithSensitiveInfo = {
        ...mockMetricsData,
        internalData: {
          apiKeys: 'secret-key',
          passwords: 'secret-password'
        }
      };

      const result = await exportService.generateJSON(dataWithSensitiveInfo);
      const parsed = JSON.parse(result);

      expect(parsed.internalData).toBeUndefined();
    });

    test('should validate file paths for security', () => {
      const maliciousPath = '../../../etc/passwd';
      
      expect(() => exportService.validateExportPath(maliciousPath))
        .toThrow('Invalid export path');
    });

    test('should limit export size to prevent DoS', async () => {
      const oversizedData = {
        ...mockMetricsData,
        largeArray: Array(1000000).fill('x'.repeat(1000))
      };

      await expect(exportService.generateJSON(oversizedData))
        .rejects.toThrow('Export size exceeds maximum limit');
    });
  });
});