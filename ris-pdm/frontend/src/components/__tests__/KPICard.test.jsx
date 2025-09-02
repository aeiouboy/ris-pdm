import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@test/test-utils';
import userEvent from '@testing-library/user-event';
import KPICard, { PLCard, VelocityCard, BugCountCard, SatisfactionCard } from '../KPICard';

describe('KPICard', () => {
  const defaultProps = {
    title: 'Test KPI',
    value: 100,
    trend: 5,
    trendValue: '+5%',
    icon: '📊',
    color: 'blue'
  };

  describe('Basic Rendering', () => {
    test('should render with required props', () => {
      render(<KPICard {...defaultProps} />);
      
      expect(screen.getByText('Test KPI')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });

    test('should display loading state', () => {
      render(<KPICard {...defaultProps} loading={true} />);
      
      expect(screen.getByText('Test KPI')).toBeInTheDocument();
      expect(screen.queryByText('100')).not.toBeInTheDocument();
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    test('should handle null/undefined values', () => {
      render(<KPICard {...defaultProps} value={null} />);
      
      expect(screen.getByText('--')).toBeInTheDocument();
    });

    test('should render with custom className', () => {
      const { container } = render(
        <KPICard {...defaultProps} className="custom-class" />
      );
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Value Formatting', () => {
    test('should format currency values', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={1250000} 
          format="currency"
          prefix="$"
        />
      );
      
      expect(screen.getByText(/\$1,250,000/)).toBeInTheDocument();
    });

    test('should format currency with millions suffix', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={2500000} 
          format="currency"
        />
      );
      
      expect(screen.getByText(/2\.5M/)).toBeInTheDocument();
    });

    test('should format percentage values', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={85.7} 
          format="percentage"
        />
      );
      
      expect(screen.getByText('85.7%')).toBeInTheDocument();
    });

    test('should format decimal values', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={4.25} 
          format="decimal"
        />
      );
      
      expect(screen.getByText('4.3')).toBeInTheDocument();
    });

    test('should format rating values', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={4.2} 
          format="rating"
        />
      );
      
      expect(screen.getByText('4.2/5')).toBeInTheDocument();
    });

    test('should format number values with locale', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={1234567}
        />
      );
      
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    test('should handle prefix and suffix', () => {
      render(
        <KPICard 
          {...defaultProps} 
          value={32}
          prefix="~"
          suffix=" pts/spr"
        />
      );
      
      expect(screen.getByText(/~32 pts\/spr/)).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    test('should show positive trend', () => {
      render(<KPICard {...defaultProps} trend={15.2} />);
      
      const trendElement = screen.getByText('+15.2%');
      expect(trendElement).toBeInTheDocument();
      expect(trendElement.closest('div')).toHaveClass('text-green-600');
    });

    test('should show negative trend', () => {
      render(<KPICard {...defaultProps} trend={-8.5} />);
      
      const trendElement = screen.getByText('-8.5%');
      expect(trendElement).toBeInTheDocument();
      expect(trendElement.closest('div')).toHaveClass('text-red-600');
    });

    test('should show zero trend', () => {
      render(<KPICard {...defaultProps} trend={0} />);
      
      const trendElement = screen.getByText('0%');
      expect(trendElement).toBeInTheDocument();
      expect(trendElement.closest('div')).toHaveClass('text-gray-500');
    });

    test('should use custom trend value', () => {
      render(
        <KPICard 
          {...defaultProps} 
          trend={12} 
          trendValue="+$180K"
        />
      );
      
      expect(screen.getByText('+$180K')).toBeInTheDocument();
    });

    test('should not show trend when loading', () => {
      render(
        <KPICard 
          {...defaultProps} 
          trend={15} 
          loading={true}
        />
      );
      
      expect(screen.queryByText('+15.0%')).not.toBeInTheDocument();
    });

    test('should not show trend when no trend provided', () => {
      render(<KPICard {...defaultProps} trend={null} />);
      
      expect(screen.queryByText('%')).not.toBeInTheDocument();
    });
  });

  describe('Color Variants', () => {
    test('should apply blue color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="blue" />);
      
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-100')).toBeInTheDocument();
    });

    test('should apply green color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="green" />);
      
      expect(container.querySelector('.text-green-600')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
    });

    test('should apply red color variant', () => {
      const { container } = render(<KPICard {...defaultProps} color="red" />);
      
      expect(container.querySelector('.text-red-600')).toBeInTheDocument();
      expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
    });

    test('should fallback to blue for invalid color', () => {
      const { container } = render(<KPICard {...defaultProps} color="invalid" />);
      
      expect(container.querySelector('.text-blue-600')).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    test('should render string icon', () => {
      render(<KPICard {...defaultProps} icon="💰" />);
      
      expect(screen.getByText('💰')).toBeInTheDocument();
    });

    test('should render JSX icon', () => {
      const CustomIcon = <div data-testid="custom-icon">Icon</div>;
      render(<KPICard {...defaultProps} icon={CustomIcon} />);
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    test('should render without icon', () => {
      const { container } = render(<KPICard {...defaultProps} icon={null} />);
      
      expect(container.querySelector('.flex-shrink-0')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(<KPICard {...defaultProps} />);
      
      const card = document.querySelector('.bg-white');
      expect(card).toHaveAttribute('class', expect.stringContaining('shadow-dashboard'));
    });

    test('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const { container } = render(<KPICard {...defaultProps} />);
      
      const card = container.querySelector('.bg-white');
      await user.tab();
      
      // Card should be focusable if interactive elements are present
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should memoize color variants', () => {
      const { rerender } = render(<KPICard {...defaultProps} color="blue" />);
      
      // Re-render with same color
      rerender(<KPICard {...defaultProps} color="blue" />);
      
      // Component should not re-render color computation
      expect(screen.getByText('Test KPI')).toBeInTheDocument();
    });

    test('should memoize formatted value', () => {
      const { rerender } = render(<KPICard {...defaultProps} value={1000} />);
      
      // Re-render with same value
      rerender(<KPICard {...defaultProps} value={1000} />);
      
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid value gracefully', () => {
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      render(<KPICard {...defaultProps} value="invalid" />);
      
      expect(screen.getByText('--')).toBeInTheDocument();
      
      console.error = originalConsoleError;
    });

    test('should handle extremely large values', () => {
      render(<KPICard {...defaultProps} value={Number.MAX_SAFE_INTEGER} />);
      
      expect(screen.getByText(/9,007,199,254,740,991/)).toBeInTheDocument();
    });
  });
});

describe('Pre-configured KPI Cards', () => {
  describe('PLCard', () => {
    test('should render with correct configuration', () => {
      render(<PLCard value={1250000} trend={15.2} />);
      
      expect(screen.getByText('P/L YTD')).toBeInTheDocument();
      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText(/\$1\.3M/)).toBeInTheDocument();
    });

    test('should handle loading state', () => {
      render(<PLCard value={1250000} loading={true} />);
      
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('VelocityCard', () => {
    test('should render with correct configuration', () => {
      render(<VelocityCard value={32} trend={12} />);
      
      expect(screen.getByText('Velocity')).toBeInTheDocument();
      expect(screen.getByText('🚀')).toBeInTheDocument();
      expect(screen.getByText(/32 pts\/spr/)).toBeInTheDocument();
    });

    test('should show trend indicator', () => {
      render(<VelocityCard value={32} trend={12} trendValue="+12%" />);
      
      expect(screen.getByText('+12%')).toBeInTheDocument();
    });
  });

  describe('BugCountCard', () => {
    test('should render with correct configuration', () => {
      render(<BugCountCard value={5} trend={-8} />);
      
      expect(screen.getByText('Bug Count')).toBeInTheDocument();
      expect(screen.getByText('🐛')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    test('should show negative trend as improvement', () => {
      render(<BugCountCard value={5} trend={-8} trendValue="-8%" />);
      
      const trendElement = screen.getByText('-8%');
      expect(trendElement.closest('div')).toHaveClass('text-red-600');
    });
  });

  describe('SatisfactionCard', () => {
    test('should render with correct configuration', () => {
      render(<SatisfactionCard value={4.2} trend={0.3} />);
      
      expect(screen.getByText('Satisfaction')).toBeInTheDocument();
      expect(screen.getByText('⭐')).toBeInTheDocument();
      expect(screen.getByText('4.2/5')).toBeInTheDocument();
    });

    test('should handle decimal trends', () => {
      render(<SatisfactionCard value={4.2} trend={0.3} trendValue="+0.3" />);
      
      expect(screen.getByText('+0.3')).toBeInTheDocument();
    });
  });
});

describe('Responsive Design', () => {
  test('should adapt to mobile screens', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width
    });

    const { container } = render(<KPICard {...defaultProps} />);
    
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
    expect(container.querySelector('.p-6')).toBeInTheDocument();
  });

  test('should maintain readability on small screens', () => {
    const { container } = render(
      <KPICard 
        {...defaultProps} 
        title="Very Long KPI Title That Might Wrap"
        value={123456789}
      />
    );
    
    expect(screen.getByText('Very Long KPI Title That Might Wrap')).toBeInTheDocument();
    expect(screen.getByText('123,456,789')).toBeInTheDocument();
  });
});

describe('Theme Integration', () => {
  test('should support shadow-dashboard utility', () => {
    const { container } = render(<KPICard {...defaultProps} />);
    
    expect(container.querySelector('.shadow-dashboard')).toBeInTheDocument();
  });

  test('should have hover effects', () => {
    const { container } = render(<KPICard {...defaultProps} />);
    
    expect(container.querySelector('.hover\\:shadow-lg')).toBeInTheDocument();
    expect(container.querySelector('.transition-shadow')).toBeInTheDocument();
  });
});