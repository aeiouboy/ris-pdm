import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, ComposedChart, ReferenceLine } from 'recharts';

const TeamVelocityChart = ({ 
  data = [], 
  loading = false, 
  height = 300,
  showCommitmentLine = true,
  showTrendLine = true,
  className = '' 
}) => {

  // Only use real data - don't fall back to sample data
  const chartData = data.length > 0 ? data : [];
  
  // Calculate statistics only if we have data
  const averageVelocity = chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.velocity, 0) / chartData.length : 0;
  const lastThreeAvg = chartData.length >= 3 ? chartData.slice(-3).reduce((sum, item) => sum + item.velocity, 0) / 3 : averageVelocity;
  const trend = chartData.length > 1 ? 
    ((chartData[chartData.length - 1].velocity - chartData[0].velocity) / chartData[0].velocity) * 100 : 0;
  
  const predictability = chartData.length > 0 ? chartData.reduce((sum, item) => {
    return sum + (item.commitment ? (Math.min(item.velocity, item.commitment) / item.commitment) : 1);
  }, 0) / chartData.length * 100 : 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-600 capitalize">{entry.dataKey}:</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {entry.value} pts
                </span>
              </div>
            ))}
          </div>
          {payload[0].payload.commitment && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Achievement: {((payload[0].payload.velocity / payload[0].payload.commitment) * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3"></div>
        </div>
        <div className={`bg-gray-50 rounded animate-pulse`} style={{ height }}>
          <div className="flex items-end justify-between h-full p-4">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className="bg-gray-200 rounded-t animate-pulse"
                style={{ 
                  height: `${Math.random() * 80 + 20}%`,
                  width: '12px'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Team Velocity Trend</h3>
          <p className="text-sm text-gray-500">Track team velocity and delivery predictability over sprints</p>
        </div>
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No velocity data available</p>
            <p className="text-gray-400 text-xs mt-1">Complete some sprints to see velocity trends</p>
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
          <h3 className="text-lg font-semibold text-gray-900">Team Velocity Trend</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Velocity</span>
            </div>
            {showCommitmentLine && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Commitment</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              Avg: <span className="font-semibold text-gray-900">{averageVelocity.toFixed(1)} pts</span>
            </span>
            <span className="text-gray-600">
              Last 3: <span className="font-semibold text-gray-900">{lastThreeAvg.toFixed(1)} pts</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              trend >= 5 
                ? 'bg-green-100 text-green-800' 
                : trend <= -5
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              predictability >= 80 
                ? 'bg-green-100 text-green-800' 
                : predictability >= 60
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {predictability.toFixed(0)}% Predictable
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="sprint"
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
            
            {/* Average reference line */}
            <ReferenceLine 
              y={averageVelocity} 
              stroke="#9ca3af" 
              strokeDasharray="4 4"
              label={{ value: `Avg: ${averageVelocity.toFixed(1)}`, position: 'topRight' }}
            />
            
            {/* Commitment bars (background) */}
            {showCommitmentLine && (
              <Bar
                dataKey="commitment"
                fill="#10b981"
                opacity={0.3}
                name="Commitment"
                radius={[2, 2, 0, 0]}
              />
            )}
            
            {/* Velocity line */}
            <Line
              type="monotone"
              dataKey="velocity"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              name="Velocity"
            />
            
            {/* Commitment line */}
            {showCommitmentLine && (
              <Line
                type="monotone"
                dataKey="commitment"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                name="Commitment"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {chartData[chartData.length - 1]?.velocity || 0}
            </div>
            <div className="text-sm text-gray-500">Current</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {averageVelocity.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">Average</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">Trend</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{predictability.toFixed(0)}%</div>
            <div className="text-sm text-gray-500">Predictability</div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Insights: </span>
          {trend >= 10 && <span className="text-green-600">🚀 Strong upward trend in velocity.</span>}
          {trend < -10 && <span className="text-red-600">⚠️ Declining velocity trend needs attention.</span>}
          {Math.abs(trend) < 10 && <span className="text-blue-600">📊 Stable velocity pattern.</span>}
          {predictability >= 80 && <span className="ml-2 text-green-600">High delivery predictability.</span>}
          {predictability < 60 && <span className="ml-2 text-yellow-600">Consider improving sprint planning.</span>}
        </div>
      </div>
    </div>
  );
};

export default TeamVelocityChart;