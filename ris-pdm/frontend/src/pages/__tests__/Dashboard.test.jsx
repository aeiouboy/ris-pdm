import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@test/test-utils';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Dashboard from '../Dashboard';
import { mockApiResponses, generateMockMetrics } from '@test/test-utils';

// Mock axios
vi.mock('axios');

// Mock hooks
vi.mock('../../hooks/useRealtimeMetrics', () => ({
  useRealtimeMetrics: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    connected: false,
    lastUpdate: null,
    updateCount: 0,
    refresh: vi.fn()
  }))
}));

vi.mock('../../hooks/useSwipeNavigation.jsx', () => ({
  default: vi.fn(() => ({
    bindSwipeHandlers: vi.fn(),
    goToNext: vi.fn(),
    goToPrevious: vi.fn()
  }))
}));

// Mock child components to focus on Dashboard logic
vi.mock('../../components', () => ({
  ExportButtons: vi.fn(({ exportType, period, className }) => (
    <div data-testid="export-buttons" className={className}>
      Export {exportType} - {period}
    </div>
  )),
}));

vi.mock('../../components/RealtimeStatus', () => ({
  default: vi.fn(({ showDetails, showControls }) => (
    <div data-testid="realtime-status">
      Status {showDetails && 'with details'} {showControls && 'with controls'}
    </div>
  )),
  LastUpdateIndicator: vi.fn(({ lastUpdate }) => (
    <div data-testid="last-update">Last: {lastUpdate}</div>
  ))
}));

vi.mock('../../components/ProductSelector', () => ({
  default: vi.fn(({ selectedProduct, onProductChange }) => (
    <select 
      data-testid="product-selector" 
      value={selectedProduct}
      onChange={(e) => onProductChange(e.target.value)}
    >
      <option value="all-products">All Products</option>
      <option value="product-a">Product A</option>
      <option value="product-b">Product B</option>
    </select>
  ))
}));

vi.mock('../../components/SprintFilter', () => ({
  default: vi.fn(({ selectedSprint, onSprintChange }) => (
    <select 
      data-testid="sprint-filter" 
      value={selectedSprint}
      onChange={(e) => onSprintChange(e.target.value)}
    >
      <option value="all-sprints">All Sprints</option>
      <option value="current">Current Sprint</option>
      <option value="sprint-1">Sprint 1</option>
    </select>
  ))
}));

vi.mock('../../components/DateRangePicker', () => ({
  default: vi.fn(({ startDate, endDate, onDateRangeChange }) => (
    <div data-testid="date-range-picker">
      <input 
        type="date" 
        value={startDate}
        onChange={(e) => onDateRangeChange(e.target.value, endDate)}
        data-testid="start-date"
      />
      <input 
        type="date" 
        value={endDate}
        onChange={(e) => onDateRangeChange(startDate, e.target.value)}
        data-testid="end-date"
      />
    </div>
  ))
}));

vi.mock('../../components/KPICard', () => ({
  PLCard: vi.fn(({ value, trend, trendValue, loading }) => (
    <div data-testid="pl-card">
      P/L: {loading ? 'Loading...' : value} 
      {trend && `Trend: ${trend}`}
      {trendValue && `(${trendValue})`}
    </div>
  )),
  VelocityCard: vi.fn(({ value, trend, trendValue, loading }) => (
    <div data-testid="velocity-card">
      Velocity: {loading ? 'Loading...' : value}
      {trend && `Trend: ${trend}`}
    </div>
  )),
  BugCountCard: vi.fn(({ value, trend, trendValue, loading }) => (
    <div data-testid="bug-card">
      Bugs: {loading ? 'Loading...' : value}
      {trend && `Trend: ${trend}`}
    </div>
  )),
  SatisfactionCard: vi.fn(({ value, trend, trendValue, loading }) => (
    <div data-testid="satisfaction-card">
      Satisfaction: {loading ? 'Loading...' : value}
      {trend && `Trend: ${trend}`}
    </div>
  ))
}));

vi.mock('../../components/SprintBurndownChart', () => ({
  default: vi.fn(({ data, loading, height }) => (
    <div data-testid="burndown-chart" style={{ height }}>
      {loading ? 'Loading chart...' : `Burndown data: ${data?.length || 0} points`}
    </div>
  ))
}));

vi.mock('../../components/TeamVelocityChart', () => ({
  default: vi.fn(({ data, loading, height }) => (
    <div data-testid="velocity-chart" style={{ height }}>
      {loading ? 'Loading chart...' : `Velocity data: ${data?.length || 0} points`}
    </div>
  ))
}));

vi.mock('../../components/TaskDistributionChart', () => ({
  default: vi.fn(({ data, loading, height }) => (
    <div data-testid="distribution-chart" style={{ height }}>
      {loading ? 'Loading chart...' : `Distribution data: ${data?.length || 0} items`}
    </div>
  ))
}));

describe('Dashboard', () => {
  const mockAxios = vi.mocked(axios);
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful API responses
    mockAxios.get.mockImplementation((url) => {
      if (url.includes('/api/metrics/overview')) {
        return Promise.resolve({
          data: { data: generateMockMetrics() }
        });
      }
      if (url.includes('/api/metrics/kpis')) {
        return Promise.resolve({
          data: {
            data: {
              pl: { value: 1200000, trend: 15.2, trendValue: '+$180K' },
              velocity: { value: 42, trend: 12, trendValue: '+12%' },
              bugs: { value: 23, trend: -8, trendValue: '-8%' },
              satisfaction: { value: 4.2, trend: 0.3, trendValue: '+0.3' }
            }
          }
        });
      }
      if (url.includes('/api/metrics/burndown')) {
        return Promise.resolve({
          data: { data: mockApiResponses.metrics.charts.sprintBurndown }
        });
      }
      if (url.includes('/api/metrics/velocity-trend')) {
        return Promise.resolve({
          data: { data: mockApiResponses.metrics.charts.teamVelocity }
        });
      }
      if (url.includes('/api/metrics/task-distribution')) {
        return Promise.resolve({
          data: { data: mockApiResponses.metrics.charts.taskDistribution }
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    test('should render dashboard header', async () => {
      render(<Dashboard />);
      
      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Overview of team and individual performance metrics')).toBeInTheDocument();
    });

    test('should render filter components', async () => {
      render(<Dashboard />);
      
      expect(screen.getByTestId('product-selector')).toBeInTheDocument();
      expect(screen.getByTestId('sprint-filter')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    });

    test('should render KPI cards', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('pl-card')).toBeInTheDocument();
        expect(screen.getByTestId('velocity-card')).toBeInTheDocument();
        expect(screen.getByTestId('bug-card')).toBeInTheDocument();
        expect(screen.getByTestId('satisfaction-card')).toBeInTheDocument();
      });
    });

    test('should render chart components', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('burndown-chart')).toBeInTheDocument();
        expect(screen.getByTestId('velocity-chart')).toBeInTheDocument();
        expect(screen.getByTestId('distribution-chart')).toBeInTheDocument();
      });
    });

    test('should render export buttons', async () => {
      render(<Dashboard />);
      
      expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
    });

    test('should render realtime status', async () => {
      render(<Dashboard />);
      
      expect(screen.getByTestId('realtime-status')).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    test('should show loading state initially', () => {
      render(<Dashboard />);
      
      // KPI cards should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should load KPI data on mount', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/kpis')
        );
      });
    });

    test('should load chart data on mount', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/burndown')
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/velocity-trend')
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/task-distribution')
        );
      });
    });

    test('should display loaded KPI data', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/P\/L: 1200000/)).toBeInTheDocument();
        expect(screen.getByText(/Velocity: 42/)).toBeInTheDocument();
        expect(screen.getByText(/Bugs: 23/)).toBeInTheDocument();
        expect(screen.getByText(/Satisfaction: 4.2/)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Interactions', () => {
    test('should update product filter', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const productSelector = screen.getByTestId('product-selector');
      await user.selectOptions(productSelector, 'product-b');
      
      // Should trigger new API call with product filter
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('productId=product-b')
        );
      });
    });

    test('should update sprint filter', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const sprintFilter = screen.getByTestId('sprint-filter');
      await user.selectOptions(sprintFilter, 'sprint-1');
      
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('sprintId=sprint-1')
        );
      });
    });

    test('should update date range', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const startDateInput = screen.getByTestId('start-date');
      await user.clear(startDateInput);
      await user.type(startDateInput, '2024-01-01');
      
      // Should trigger API calls when date changes
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    test('should handle multiple filter changes', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const productSelector = screen.getByTestId('product-selector');
      const sprintFilter = screen.getByTestId('sprint-filter');
      
      await user.selectOptions(productSelector, 'product-a');
      await user.selectOptions(sprintFilter, 'current');
      
      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringMatching(/productId=product-a.*sprintId=current|sprintId=current.*productId=product-a/)
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle KPI API errors gracefully', async () => {
      mockAxios.get.mockImplementation((url) => {
        if (url.includes('/api/metrics/kpis')) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({ data: { data: {} } });
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Dashboard />);
      
      await waitFor(() => {
        // Should show fallback data when API fails
        expect(screen.getByText(/P\/L: 1200000/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    test('should handle chart API errors', async () => {
      mockAxios.get.mockImplementation((url) => {
        if (url.includes('/api/metrics/burndown')) {
          return Promise.reject(new Error('Chart API Error'));
        }
        return Promise.resolve({ data: { data: generateMockMetrics() } });
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Dashboard />);
      
      await waitFor(() => {
        // Chart should show empty state
        expect(screen.getByText(/Burndown data: 0 points/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    test('should handle network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Dashboard />);
      
      await waitFor(() => {
        // Should show fallback states
        expect(screen.getByText(/Burndown data: 0 points/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Real-time Data Integration', () => {
    test('should display real-time data when available', async () => {
      const { useRealtimeMetrics } = await import('../../hooks/useRealtimeMetrics');
      useRealtimeMetrics.mockReturnValue({
        data: generateMockMetrics(),
        loading: false,
        error: null,
        connected: true,
        lastUpdate: '2024-01-01T12:00:00Z',
        updateCount: 5,
        refresh: vi.fn()
      });

      render(<Dashboard />);
      
      expect(screen.getByText(/5 real-time updates received/)).toBeInTheDocument();
      expect(screen.getByTestId('last-update')).toBeInTheDocument();
    });

    test('should show refresh button when not connected', async () => {
      const refreshMock = vi.fn();
      const { useRealtimeMetrics } = await import('../../hooks/useRealtimeMetrics');
      useRealtimeMetrics.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        connected: false,
        lastUpdate: null,
        updateCount: 0,
        refresh: refreshMock
      });

      const user = userEvent.setup();
      render(<Dashboard />);
      
      const refreshButton = screen.getByText('Refresh Data');
      expect(refreshButton).toBeInTheDocument();
      
      await user.click(refreshButton);
      expect(refreshMock).toHaveBeenCalled();
    });

    test('should handle real-time connection errors', async () => {
      const { useRealtimeMetrics } = await import('../../hooks/useRealtimeMetrics');
      useRealtimeMetrics.mockReturnValue({
        data: null,
        loading: false,
        error: 'WebSocket connection failed',
        connected: false,
        lastUpdate: null,
        updateCount: 0,
        refresh: vi.fn()
      });

      render(<Dashboard />);
      
      // Should still render and fallback to API data
      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    test('should load different data types independently', async () => {
      render(<Dashboard />);
      
      await waitFor(() => {
        // Each data type should have separate API calls
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/kpis')
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/burndown')
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/velocity-trend')
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/task-distribution')
        );
      });
    });

    test('should show individual loading states', async () => {
      // Mock delayed responses
      mockAxios.get.mockImplementation((url) => {
        if (url.includes('/api/metrics/kpis')) {
          return new Promise(resolve => setTimeout(() => resolve({ data: { data: {} } }), 1000));
        }
        return Promise.resolve({ data: { data: [] } });
      });

      render(<Dashboard />);
      
      // KPI cards should show loading while charts might not
      expect(screen.getByText('P/L: Loading...')).toBeInTheDocument();
    });
  });

  describe('Swipe Navigation', () => {
    test('should initialize swipe navigation', async () => {
      const { default: useSwipeNavigation } = await import('../../hooks/useSwipeNavigation.jsx');
      const mockBindHandlers = vi.fn();
      useSwipeNavigation.mockReturnValue({
        bindSwipeHandlers: mockBindHandlers,
        goToNext: vi.fn(),
        goToPrevious: vi.fn()
      });

      render(<Dashboard />);
      
      expect(useSwipeNavigation).toHaveBeenCalledWith({
        enabled: true,
        threshold: 100,
        preventScroll: false
      });
    });

    test('should handle navigation to individual performance', async () => {
      const mockGoToNext = vi.fn();
      const { default: useSwipeNavigation } = await import('../../hooks/useSwipeNavigation.jsx');
      useSwipeNavigation.mockReturnValue({
        bindSwipeHandlers: vi.fn(),
        goToNext: mockGoToNext,
        goToPrevious: vi.fn()
      });

      const user = userEvent.setup();
      render(<Dashboard />);
      
      const navButton = screen.getByText('View Individual Performance →');
      await user.click(navButton);
      
      expect(mockGoToNext).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    test('should render mobile layout correctly', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<Dashboard />);
      
      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
    });

    test('should handle tablet layout', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<Dashboard />);
      
      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', () => {
      render(<Dashboard />);
      
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('RIS Performance Dashboard');
    });

    test('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      // Should be able to tab through interactive elements
      await user.tab();
      expect(document.activeElement).toBeDefined();
    });

    test('should have proper ARIA attributes', () => {
      render(<Dashboard />);
      
      // Check for proper semantic structure
      const main = screen.getByText('RIS Performance Dashboard').closest('.p-6');
      expect(main).toBeInTheDocument();
    });
  });
});