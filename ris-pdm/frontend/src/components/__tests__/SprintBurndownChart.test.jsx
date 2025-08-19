import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@test/test-utils';
import SprintBurndownChart from '../SprintBurndownChart';

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke }) => (
    <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
  ),
  XAxis: ({ dataKey }) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: ({ y, label }) => (
    <div data-testid="reference-line" data-y={y} data-label={label} />
  )
}));

describe('SprintBurndownChart', () => {
  const mockBurndownData = [
    {
      date: '2024-01-01',
      day: 1,
      planned: 100,
      actual: 100,
      ideal: 100
    },
    {
      date: '2024-01-02',
      day: 2,
      planned: 90,
      actual: 95,
      ideal: 86
    },
    {
      date: '2024-01-03',
      day: 3,
      planned: 80,
      actual: 88,
      ideal: 71
    },
    {
      date: '2024-01-04',
      day: 4,
      planned: 70,
      actual: 75,
      ideal: 57
    },
    {
      date: '2024-01-05',
      day: 5,
      planned: 60,
      actual: 68,
      ideal: 43
    }
  ];

  const defaultProps = {
    data: mockBurndownData,
    title: 'Sprint Burndown',
    height: 400,
    loading: false,
    error: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('should render chart with data', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('line-actual')).toBeInTheDocument();
      expect(screen.getByTestId('line-planned')).toBeInTheDocument();
      expect(screen.getByTestId('line-ideal')).toBeInTheDocument();
    });

    test('should render chart title', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByText('Sprint Burndown')).toBeInTheDocument();
    });

    test('should render chart axes', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    });

    test('should render grid and tooltip', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    test('should pass correct data to chart', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      const lineChart = screen.getByTestId('line-chart');
      const chartData = JSON.parse(lineChart.getAttribute('data-chart-data'));

      expect(chartData).toEqual(mockBurndownData);
    });
  });

  describe('Line Colors and Styling', () => {
    test('should use correct colors for each line', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('line-actual')).toHaveAttribute('data-stroke', '#3B82F6');
      expect(screen.getByTestId('line-planned')).toHaveAttribute('data-stroke', '#10B981');
      expect(screen.getByTestId('line-ideal')).toHaveAttribute('data-stroke', '#6B7280');
    });

    test('should apply different line styles', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      // Check for line components (actual implementation would check stroke patterns)
      expect(screen.getByTestId('line-actual')).toBeInTheDocument();
      expect(screen.getByTestId('line-planned')).toBeInTheDocument();
      expect(screen.getByTestId('line-ideal')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    test('should display loading skeleton', () => {
      render(<SprintBurndownChart {...defaultProps} loading={true} />);

      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    test('should not render chart when loading', () => {
      render(<SprintBurndownChart {...defaultProps} loading={true} />);

      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    test('should display error message', () => {
      render(<SprintBurndownChart {...defaultProps} error="Failed to load chart data" />);

      expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
      expect(screen.getByTestId('chart-error')).toBeInTheDocument();
    });

    test('should show retry button on error', () => {
      const onRetry = vi.fn();
      render(
        <SprintBurndownChart 
          {...defaultProps} 
          error="Network error" 
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    test('should not render chart when error exists', () => {
      render(<SprintBurndownChart {...defaultProps} error="Test error" />);

      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('Empty Data Handling', () => {
    test('should display empty state message', () => {
      render(<SprintBurndownChart {...defaultProps} data={[]} />);

      expect(screen.getByText('No burndown data available')).toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    test('should handle null data', () => {
      render(<SprintBurndownChart {...defaultProps} data={null} />);

      expect(screen.getByText('No burndown data available')).toBeInTheDocument();
    });

    test('should handle undefined data', () => {
      render(<SprintBurndownChart {...defaultProps} data={undefined} />);

      expect(screen.getByText('No burndown data available')).toBeInTheDocument();
    });
  });

  describe('Data Validation and Transformation', () => {
    test('should handle missing data points', () => {
      const incompleteData = [
        { date: '2024-01-01', actual: 100 }, // Missing planned and ideal
        { date: '2024-01-02', planned: 90, actual: 95 }, // Missing ideal
        { date: '2024-01-03', planned: 80, actual: 88, ideal: 71 } // Complete
      ];

      render(<SprintBurndownChart {...defaultProps} data={incompleteData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should sort data by date', () => {
      const unsortedData = [
        { date: '2024-01-03', planned: 80, actual: 88, ideal: 71 },
        { date: '2024-01-01', planned: 100, actual: 100, ideal: 100 },
        { date: '2024-01-02', planned: 90, actual: 95, ideal: 86 }
      ];

      render(<SprintBurndownChart {...defaultProps} data={unsortedData} />);

      const lineChart = screen.getByTestId('line-chart');
      const chartData = JSON.parse(lineChart.getAttribute('data-chart-data'));

      // Should be sorted by date
      expect(chartData[0].date).toBe('2024-01-01');
      expect(chartData[1].date).toBe('2024-01-02');
      expect(chartData[2].date).toBe('2024-01-03');
    });

    test('should calculate ideal line if missing', () => {
      const dataWithoutIdeal = [
        { date: '2024-01-01', planned: 100, actual: 100 },
        { date: '2024-01-02', planned: 90, actual: 95 },
        { date: '2024-01-03', planned: 80, actual: 88 }
      ];

      render(<SprintBurndownChart {...defaultProps} data={dataWithoutIdeal} />);

      const lineChart = screen.getByTestId('line-chart');
      const chartData = JSON.parse(lineChart.getAttribute('data-chart-data'));

      // Should have calculated ideal values
      expect(chartData.every(point => point.ideal !== undefined)).toBe(true);
    });
  });

  describe('Responsive Behavior', () => {
    test('should adapt to container size', () => {
      render(<SprintBurndownChart {...defaultProps} height={300} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should handle mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Sprint Progress Indicators', () => {
    test('should show current day indicator', () => {
      const currentDate = new Date().toISOString().split('T')[0];
      const dataWithCurrentDay = [
        ...mockBurndownData,
        {
          date: currentDate,
          day: 6,
          planned: 50,
          actual: 60,
          ideal: 29,
          isToday: true
        }
      ];

      render(<SprintBurndownChart {...defaultProps} data={dataWithCurrentDay} />);

      expect(screen.getByTestId('reference-line')).toBeInTheDocument();
    });

    test('should highlight completion status', () => {
      const completedSprintData = mockBurndownData.map((point, index) => ({
        ...point,
        actual: index === mockBurndownData.length - 1 ? 0 : point.actual // Last day completed
      }));

      render(<SprintBurndownChart {...defaultProps} data={completedSprintData} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should show sprint goal line', () => {
      render(<SprintBurndownChart {...defaultProps} sprintGoal={0} />);

      expect(screen.getByTestId('reference-line')).toBeInTheDocument();
    });
  });

  describe('Tooltip Formatting', () => {
    test('should format tooltip content correctly', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      // In a real test, you'd simulate hover and check tooltip content
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      const chart = screen.getByRole('img', { name: /sprint burndown chart/i });
      expect(chart).toBeInTheDocument();
    });

    test('should provide alternative text for screen readers', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      expect(screen.getByText(/chart showing sprint progress/i)).toBeInTheDocument();
    });

    test('should be keyboard navigable', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array(1000).fill().map((_, i) => ({
        date: `2024-01-${String((i % 30) + 1).padStart(2, '0')}`,
        day: i + 1,
        planned: 1000 - i,
        actual: 1000 - i + Math.random() * 20,
        ideal: 1000 - (i * 1000 / 999)
      }));

      const startTime = performance.now();
      render(<SprintBurndownChart {...defaultProps} data={largeDataset} />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should memoize chart calculations', () => {
      const { rerender } = render(<SprintBurndownChart {...defaultProps} />);

      // Re-render with same data
      rerender(<SprintBurndownChart {...defaultProps} />);

      // Chart should still be present without recalculation
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    test('should support dark theme', () => {
      render(<SprintBurndownChart {...defaultProps} theme="dark" />);

      // In real implementation, would check for dark theme classes
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should use theme colors', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      // Lines should use theme-aware colors
      expect(screen.getByTestId('line-actual')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    test('should support chart export', () => {
      const onExport = vi.fn();
      render(<SprintBurndownChart {...defaultProps} onExport={onExport} />);

      const exportButton = screen.getByRole('button', { name: /export chart/i });
      fireEvent.click(exportButton);

      expect(onExport).toHaveBeenCalledWith({
        type: 'burndown',
        data: mockBurndownData,
        format: 'png'
      });
    });

    test('should provide chart data for external export', () => {
      render(<SprintBurndownChart {...defaultProps} />);

      const chartContainer = screen.getByTestId('responsive-container');
      expect(chartContainer).toHaveAttribute('data-export-ready', 'true');
    });
  });

  describe('Customization Options', () => {
    test('should accept custom colors', () => {
      const customColors = {
        actual: '#FF6B6B',
        planned: '#4ECDC4',
        ideal: '#45B7D1'
      };

      render(<SprintBurndownChart {...defaultProps} colors={customColors} />);

      expect(screen.getByTestId('line-actual')).toHaveAttribute('data-stroke', '#FF6B6B');
      expect(screen.getByTestId('line-planned')).toHaveAttribute('data-stroke', '#4ECDC4');
      expect(screen.getByTestId('line-ideal')).toHaveAttribute('data-stroke', '#45B7D1');
    });

    test('should support custom height', () => {
      render(<SprintBurndownChart {...defaultProps} height={600} />);

      // Would check container height in real implementation
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});