import React, { useMemo } from 'react';

// Memoized color variants for better performance
const COLOR_VARIANTS = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    value: 'text-blue-600'
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    value: 'text-green-600'
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-600',
    value: 'text-orange-600'
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    value: 'text-purple-600'
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-100 text-red-600',
    value: 'text-red-600'
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'bg-gray-100 text-gray-600',
    value: 'text-gray-600'
  }
};

const KPICard = React.memo(({ 
  title, 
  value, 
  trend, 
  trendValue, 
  suffix = '', 
  prefix = '', 
  format = 'number', 
  icon, 
  color = 'blue',
  loading = false,
  className = '' 
}) => {
  // Memoize color selection
  const colors = useMemo(() => COLOR_VARIANTS[color] || COLOR_VARIANTS.blue, [color]);

  // Memoize formatted value to prevent unnecessary recalculations
  const formattedValue = useMemo(() => {
    if (loading || value === null || value === undefined) return '--';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: value >= 1000000 ? 1 : 0,
          maximumFractionDigits: value >= 1000000 ? 1 : 0
        }).format(value >= 1000000 ? value / 1000000 : value) + (value >= 1000000 ? 'M' : '');
      case 'percentage':
        return `${parseFloat(value).toFixed(1)}%`;
      case 'decimal':
        return parseFloat(value).toFixed(1);
      case 'rating':
        return `${parseFloat(value).toFixed(1)}/5`;
      default:
        return value.toLocaleString();
    }
  }, [value, format, loading]);

  // Memoize trend indicator to prevent unnecessary re-renders
  const trendIcon = useMemo(() => {
    if (!trend || loading) return null;
    
    const isPositive = trend > 0;
    const isNegative = trend < 0;
    
    if (isPositive) {
      return (
        <div className="flex items-center text-green-600">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L10 4.414 4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">
            {trendValue || `+${Math.abs(trend).toFixed(1)}%`}
          </span>
        </div>
      );
    }
    
    if (isNegative) {
      return (
        <div className="flex items-center text-red-600">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 15.586l5.293-5.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">
            {trendValue || `${trend.toFixed(1)}%`}
          </span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-gray-500">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">0%</span>
      </div>
    );
  }, [trend, trendValue, loading]);

  return (
    <div className={`bg-white p-6 rounded-lg shadow-dashboard border hover:shadow-lg transition-shadow ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
          <div className="flex items-baseline space-x-2">
            <p className={`text-3xl font-bold ${colors.value} ${loading ? 'animate-pulse' : ''}`}>
              {loading ? (
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <>
                  {prefix}
                  {formattedValue}
                  {suffix}
                </>
              )}
            </p>
          </div>
          
          {/* Trend Indicator */}
          {!loading && trendIcon && (
            <div className="mt-2">
              {trendIcon}
            </div>
          )}
        </div>
        
        {/* Icon */}
        {icon && (
          <div className={`flex-shrink-0 w-12 h-12 ${colors.icon} rounded-lg flex items-center justify-center ml-4`}>
            {typeof icon === 'string' ? (
              <span className="text-2xl">{icon}</span>
            ) : (
              <div className="w-6 h-6">{icon}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Set display names for better debugging
KPICard.displayName = 'KPICard';

// Pre-configured KPI cards matching PRD specifications with optimizations
export const PLCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="P/L YTD"
    value={value}
    trend={trend}
    trendValue={trendValue}
    format="currency"
    prefix="$"
    icon="💰"
    color="green"
    loading={loading}
  />
));

export const VelocityCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Velocity"
    value={value}
    trend={trend}
    trendValue={trendValue}
    suffix=" pts/spr"
    icon="🚀"
    color="blue"
    loading={loading}
  />
));

export const BugCountCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Bug Count"
    value={value}
    trend={trend}
    trendValue={trendValue}
    icon="🐛"
    color="red"
    loading={loading}
  />
));

export const SatisfactionCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Satisfaction"
    value={value}
    trend={trend}
    trendValue={trendValue}
    format="rating"
    icon="⭐"
    color="orange"
    loading={loading}
  />
));

// Set display names
PLCard.displayName = 'PLCard';
VelocityCard.displayName = 'VelocityCard';
BugCountCard.displayName = 'BugCountCard';
SatisfactionCard.displayName = 'SatisfactionCard';

export default KPICard;