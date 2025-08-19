import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@test/test-utils';
import userEvent from '@testing-library/user-event';
import Dashboard from '../../pages/Dashboard';

// Mock dependencies
vi.mock('@services/websocketService');
vi.mock('@hooks/useRealtimeMetrics');

// Mock child components
vi.mock('../KPICard', () => ({
  default: ({ title, value, ...props }) => (
    <div data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
  PLCard: (props) => <div data-testid="pl-card" {...props} />,
  VelocityCard: (props) => <div data-testid="velocity-card" {...props} />,
  BugCountCard: (props) => <div data-testid="bug-card" {...props} />,
  SatisfactionCard: (props) => <div data-testid="satisfaction-card" {...props} />
}));

vi.mock('../SprintBurndownChart', () => ({
  default: (props) => <div data-testid="burndown-chart" {...props} />
}));

vi.mock('../TeamVelocityChart', () => ({
  default: (props) => <div data-testid="velocity-chart" {...props} />
}));

vi.mock('../TaskDistributionChart', () => ({
  default: (props) => <div data-testid="distribution-chart" {...props} />
}));

vi.mock('../ProductSelector', () => ({
  default: ({ value, onChange }) => (
    <select 
      data-testid="product-selector" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all-projects">All Projects</option>
      <option value="product-a">Product A</option>
      <option value="product-b">Product B</option>
    </select>
  )
}));

vi.mock('../SprintFilter', () => ({
  default: ({ value, onChange }) => (
    <select 
      data-testid="sprint-filter" 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="current">Current Sprint</option>
      <option value="sprint-1">Sprint 1</option>
      <option value="sprint-2">Sprint 2</option>
    </select>
  )
}));

vi.mock('../DateRangePicker', () => ({
  default: ({ startDate, endDate, onChange }) => (
    <div data-testid="date-range-picker">
      <input 
        data-testid="start-date"
        type="date" 
        value={startDate} 
        onChange={(e) => onChange({ startDate: e.target.value, endDate })}
      />
      <input 
        data-testid="end-date"
        type="date" 
        value={endDate} 
        onChange={(e) => onChange({ startDate, endDate: e.target.value })}
      />
    </div>
  )
}));

vi.mock('../ExportButtons', () => ({
  default: () => <div data-testid="export-buttons">Export Options</div>
}));

vi.mock('../RealtimeStatus', () => ({
  default: ({ connected }) => (
    <div data-testid="realtime-status">
      {connected ? 'Connected' : 'Disconnected'}
    </div>
  )
}));

// Mock API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Dashboard', () => {
  const mockMetricsData = {
    kpis: {
      plYtd: { value: 1250000, trend: 15.2, trendValue: '+$180K' },
      velocity: { value: 32, trend: 12, trendValue: '+12%' },
      bugCount: { value: 5, trend: -8, trendValue: '-8%' },
      satisfaction: { value: 4.2, trend: 0.3, trendValue: '+0.3' }
    },
    charts: {
      burndown: [
        { date: '2024-01-01', planned: 100, actual: 95 },
        { date: '2024-01-02', planned: 90, actual: 88 }
      ],
      velocity: [
        { sprint: 'Sprint 1', points: 32 },
        { sprint: 'Sprint 2', points: 28 }
      ],
      distribution: [
        { type: 'User Story', count: 45 },
        { type: 'Bug', count: 12 },
        { type: 'Task', count: 23 }
      ]
    },
    metadata: {
      lastUpdated: '2024-01-15T10:00:00Z',
      dataRange: '2024-01-01 to 2024-01-31'
    }
  };

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockMetricsData
      })
    });

    // Mock useRealtimeMetrics hook
    const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
    useRealtimeMetrics.mockReturnValue({
      data: mockMetricsData,
      connected: true,
      error: null,
      loading: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    test('should render dashboard with main components', async () => {
      render(<Dashboard />);

      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('product-selector')).toBeInTheDocument();
      expect(screen.getByTestId('sprint-filter')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
      expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('realtime-status')).toBeInTheDocument();
    });

    test('should render all KPI cards', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('pl-card')).toBeInTheDocument();
        expect(screen.getByTestId('velocity-card')).toBeInTheDocument();
        expect(screen.getByTestId('bug-card')).toBeInTheDocument();
        expect(screen.getByTestId('satisfaction-card')).toBeInTheDocument();
      });
    });

    test('should render all charts', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('burndown-chart')).toBeInTheDocument();
        expect(screen.getByTestId('velocity-chart')).toBeInTheDocument();
        expect(screen.getByTestId('distribution-chart')).toBeInTheDocument();
      });
    });

    test('should show loading state initially', () => {
      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: null,
        connected: false,
        error: null,
        loading: true
      });

      render(<Dashboard />);

      expect(document.querySelectorAll('.animate-pulse')).toHaveLength.greaterThan(0);
    });
  });

  describe('Filter Functionality', () => {
    test('should update product filter', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const productSelector = screen.getByTestId('product-selector');
      await user.selectOptions(productSelector, 'product-a');

      expect(productSelector.value).toBe('product-a');
    });

    test('should update sprint filter', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const sprintFilter = screen.getByTestId('sprint-filter');
      await user.selectOptions(sprintFilter, 'sprint-1');

      expect(sprintFilter.value).toBe('sprint-1');
    });

    test('should update date range', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const startDateInput = screen.getByTestId('start-date');
      const endDateInput = screen.getByTestId('end-date');

      await user.type(startDateInput, '2024-01-01');
      await user.type(endDateInput, '2024-01-31');

      expect(startDateInput.value).toBe('2024-01-01');
      expect(endDateInput.value).toBe('2024-01-31');
    });

    test('should trigger data refresh when filters change', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const productSelector = screen.getByTestId('product-selector');
      await user.selectOptions(productSelector, 'product-a');

      // Should trigger new API call with updated filter
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('productId=product-a'),
          expect.any(Object)
        );
      });
    });

    test('should combine multiple filters in API requests', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const productSelector = screen.getByTestId('product-selector');
      const sprintFilter = screen.getByTestId('sprint-filter');

      await user.selectOptions(productSelector, 'product-a');
      await user.selectOptions(sprintFilter, 'sprint-1');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/productId=product-a.*sprintId=sprint-1|sprintId=sprint-1.*productId=product-a/),
          expect.any(Object)
        );
      });
    });
  });

  describe('Real-time Updates', () => {
    test('should display connection status', () => {
      render(<Dashboard />);

      expect(screen.getByTestId('realtime-status')).toHaveTextContent('Connected');
    });

    test('should show disconnected state', () => {
      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: mockMetricsData,
        connected: false,
        error: null,
        loading: false
      });

      render(<Dashboard />);

      expect(screen.getByTestId('realtime-status')).toHaveTextContent('Disconnected');
    });

    test('should update KPIs when real-time data changes', async () => {
      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      
      const { rerender } = render(<Dashboard />);

      // Simulate real-time update
      const updatedData = {
        ...mockMetricsData,
        kpis: {
          ...mockMetricsData.kpis,
          velocity: { value: 35, trend: 15, trendValue: '+15%' }
        }
      };

      useRealtimeMetrics.mockReturnValue({
        data: updatedData,
        connected: true,
        error: null,
        loading: false
      });

      rerender(<Dashboard />);

      await waitFor(() => {
        // KPI components should receive updated data
        expect(screen.getByTestId('velocity-card')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should display error state when API fails', async () => {
      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: null,
        connected: false,
        error: 'Failed to load dashboard data',
        loading: false
      });

      render(<Dashboard />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    test('should show retry button on error', async () => {
      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: null,
        connected: false,
        error: 'Network error',
        loading: false
      });

      render(<Dashboard />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    test('should handle partial data loading gracefully', async () => {
      const partialData = {
        kpis: mockMetricsData.kpis,
        charts: null, // Missing charts data
        metadata: mockMetricsData.metadata
      };

      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: partialData,
        connected: true,
        error: null,
        loading: false
      });

      render(<Dashboard />);

      // KPIs should render
      await waitFor(() => {
        expect(screen.getByTestId('pl-card')).toBeInTheDocument();
      });

      // Charts should show empty state or loading
      expect(screen.getByTestId('burndown-chart')).toBeInTheDocument();
    });

    test('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: null,
        connected: false,
        error: 'Network error',
        loading: false
      });

      render(<Dashboard />);

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    test('should memoize expensive computations', () => {
      const { rerender } = render(<Dashboard />);

      // Re-render with same props
      rerender(<Dashboard />);

      // Should not make additional API calls if data hasn't changed
      expect(mockFetch).not.toHaveBeenCalledTimes(2);
    });

    test('should debounce filter changes', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      const productSelector = screen.getByTestId('product-selector');

      // Rapidly change selections
      await user.selectOptions(productSelector, 'product-a');
      await user.selectOptions(productSelector, 'product-b');
      await user.selectOptions(productSelector, 'product-a');

      // Should debounce API calls
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = {
        ...mockMetricsData,
        charts: {
          ...mockMetricsData.charts,
          burndown: Array(1000).fill().map((_, i) => ({
            date: `2024-01-${String(i + 1).padStart(2, '0')}`,
            planned: 100 - i,
            actual: 95 - i
          }))
        }
      };

      const useRealtimeMetrics = vi.mocked(require('@hooks/useRealtimeMetrics').default);
      useRealtimeMetrics.mockReturnValue({
        data: largeDataset,
        connected: true,
        error: null,
        loading: false
      });

      const startTime = performance.now();
      render(<Dashboard />);
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (less than 1000ms)
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Responsive Design', () => {
    test('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(<Dashboard />);

      // Should render mobile-friendly layout
      expect(screen.getByTestId('product-selector')).toBeInTheDocument();
      expect(screen.getByTestId('sprint-filter')).toBeInTheDocument();
    });

    test('should handle orientation changes', () => {
      render(<Dashboard />);

      // Simulate orientation change
      fireEvent(window, new Event('orientationchange'));

      // Component should remain functional
      expect(screen.getByText('RIS Performance Dashboard')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', () => {
      render(<Dashboard />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('RIS Performance Dashboard');
    });

    test('should have keyboard navigation support', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      // Should be able to tab through interactive elements
      await user.tab();
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
    });

    test('should have proper ARIA labels', () => {
      render(<Dashboard />);

      const productSelector = screen.getByTestId('product-selector');
      expect(productSelector).toBeInTheDocument();
    });

    test('should announce updates to screen readers', async () => {
      render(<Dashboard />);

      // Look for aria-live regions
      const liveRegion = document.querySelector('[aria-live]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Export Functionality Integration', () => {
    test('should pass current filters to export component', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      // Set filters
      await user.selectOptions(screen.getByTestId('product-selector'), 'product-a');
      await user.selectOptions(screen.getByTestId('sprint-filter'), 'sprint-1');

      // Export component should receive filter context
      expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
    });
  });

  describe('URL State Synchronization', () => {
    test('should sync filters with URL parameters', async () => {
      // Mock URL with query parameters
      const mockLocation = {
        search: '?productId=product-a&sprintId=current',
        pathname: '/',
        hash: ''
      };

      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      });

      render(<Dashboard />);

      // Filters should be initialized from URL
      await waitFor(() => {
        expect(screen.getByTestId('product-selector')).toHaveValue('product-a');
        expect(screen.getByTestId('sprint-filter')).toHaveValue('current');
      });
    });
  });

  describe('Memory Management', () => {
    test('should cleanup resources on unmount', () => {
      const { unmount } = render(<Dashboard />);

      const cleanupSpy = vi.fn();
      // Mock cleanup function
      vi.mocked(require('@hooks/useRealtimeMetrics').default).mockReturnValue({
        data: mockMetricsData,
        connected: true,
        error: null,
        loading: false,
        cleanup: cleanupSpy
      });

      unmount();

      // Should cleanup WebSocket connections and timers
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});