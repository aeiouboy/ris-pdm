import React, { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';


const SprintBurndownChart = React.memo(({ 
  data = [], 
  loading = false, 
  height = 300, 
  showIdealLine = true,
  className = '' 
}) => {
  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    // Only show real data - don't fall back to sample data
    return data.length > 0 ? data : [];
  }, [data]);

  // Memoize calculated values
  const chartMetrics = useMemo(() => {
    if (!chartData.length) return { maxValue: 0, currentActual: 0, currentIdeal: 0, sprintProgress: 0 };
    
    const maxValue = Math.max(...chartData.map(d => Math.max(d.idealRemaining || 0, d.actualRemaining || 0)));
    const currentActual = chartData[chartData.length - 1]?.actualRemaining || 0;
    const currentIdeal = chartData[chartData.length - 1]?.idealRemaining || 0;
    const sprintProgress = ((chartData[0]?.actualRemaining || 0) - currentActual) / (chartData[0]?.actualRemaining || 1) * 100;
    
    return { maxValue, currentActual, currentIdeal, sprintProgress };
  }, [chartData]);

  // Memoize custom tooltip for better performance
  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.date || label}</p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-600">{entry.name}:</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {entry.value} pts
                </span>
              </div>
            ))}
          </div>
          {data.actualRemaining < data.idealRemaining && (
            <div className="mt-2 text-sm text-green-600">
              ✓ {(data.idealRemaining - data.actualRemaining).toFixed(1)} pts ahead
            </div>
          )}
          {data.actualRemaining > data.idealRemaining && (
            <div className="mt-2 text-sm text-red-600">
              ⚠ {(data.actualRemaining - data.idealRemaining).toFixed(1)} pts behind
            </div>
          )}
        </div>
      );
    }
    return null;
  }, []);

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3"></div>
        </div>
        <div className={`bg-gray-50 rounded animate-pulse`} style={{ height }}>
          <div className="flex items-end justify-between h-full p-4">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i}
                className="bg-gray-200 rounded-t animate-pulse"
                style={{ 
                  height: `${Math.random() * 80 + 20}%`,
                  width: '8px'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { currentActual, currentIdeal, sprintProgress } = chartMetrics;

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Sprint Burndown</h3>
          <p className="text-sm text-gray-500">Sprint burndown chart shows story point completion over time</p>
        </div>
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No burndown data available</p>
            <p className="text-gray-400 text-xs mt-1">Start a sprint to see burndown progress</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Sprint Burndown</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Actual</span>
            </div>
            {showIdealLine && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border-2 border-dashed border-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600">Ideal</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Progress Summary */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              Remaining: <span className="font-semibold text-gray-900">{currentActual} pts</span>
            </span>
            <span className="text-gray-600">
              Progress: <span className="font-semibold text-gray-900">{sprintProgress.toFixed(1)}%</span>
            </span>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            currentActual <= currentIdeal 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {currentActual <= currentIdeal ? 'On Track' : 'Behind Schedule'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="day"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
              label={{ value: 'Story Points', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Zero line reference */}
            <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="2 2" />
            
            {/* Ideal burndown line */}
            {showIdealLine && (
              <Line
                type="linear"
                dataKey="idealRemaining"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                name="Ideal Burndown"
                connectNulls={false}
              />
            )}
            
            {/* Actual burndown line */}
            <Line
              type="monotone"
              dataKey="actualRemaining"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              name="Actual Burndown"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{currentActual}</div>
            <div className="text-sm text-gray-500">Remaining</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {((chartData[0]?.actualRemaining || 0) - currentActual).toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{sprintProgress.toFixed(0)}%</div>
            <div className="text-sm text-gray-500">Progress</div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Set display name for better debugging
SprintBurndownChart.displayName = 'SprintBurndownChart';

export default SprintBurndownChart;