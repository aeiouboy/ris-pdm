import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const TaskDistributionChart = ({ 
  data = [], 
  loading = false, 
  height = 320,
  showLegend = false, // Disabled to reduce redundancy
  showPercentages = true,
  showDetailedBreakdown = false, // New prop to control detailed view
  className = '' 
}) => {
  // Color palette for different task types
  const COLORS = [
    '#3B82F6', // Blue - Development
    '#10B981', // Green - Testing
    '#F59E0B', // Orange - Documentation
    '#EF4444', // Red - Bug Fixes
    '#8B5CF6', // Purple - Research
    '#6B7280', // Gray - Other
    '#EC4899', // Pink - Design
    '#14B8A6'  // Teal - DevOps
  ];


  // Debug logging
  console.log('TaskDistributionChart data received:', { data, loading, dataLength: data?.length });
  
  // Only use real data - don't fall back to sample data
  const chartData = data.length > 0 ? data : [];
  const isUsingSampleData = data.length === 0;
  const totalTasks = chartData.length > 0 ? chartData.reduce((sum, item) => sum + (item.count || item.value), 0) : 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg max-w-xs">
          <div className="flex items-center space-x-2 mb-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: payload[0].color }}
            />
            <span className="font-medium text-gray-900">{data.name}</span>
            {data.icon && <span className="text-lg">{data.icon}</span>}
          </div>
          
          {data.description && (
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">{data.description}</p>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between space-x-4">
              <span className="text-gray-600">Tasks:</span>
              <span className="font-semibold text-gray-900">{data.count || data.value}</span>
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-gray-600">Percentage:</span>
              <span className="font-semibold text-gray-900">
                {((data.count || data.value) / totalTasks * 100).toFixed(1)}%
              </span>
            </div>
            
            {data.storyPoints && (
              <div className="flex justify-between space-x-4">
                <span className="text-gray-600">Story Points:</span>
                <span className="font-semibold text-gray-900">{data.storyPoints}</span>
              </div>
            )}
            
            {data.completionRate !== undefined && (
              <div className="flex justify-between space-x-4">
                <span className="text-gray-600">Completion:</span>
                <span className="font-semibold text-gray-900">{data.completionRate}%</span>
              </div>
            )}
            
            {(data.completed || data.inProgress || data.remaining) && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Status Breakdown:</div>
                <div className="space-y-1 text-xs">
                  {data.completed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-600">✓ Done:</span>
                      <span className="text-green-600 font-medium">{data.completed}</span>
                    </div>
                  )}
                  {data.inProgress > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">⚡ In Progress:</span>
                      <span className="text-blue-600 font-medium">{data.inProgress}</span>
                    </div>
                  )}
                  {data.remaining > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">⏳ Remaining:</span>
                      <span className="text-gray-600 font-medium">{data.remaining}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, icon }) => {
    if (percent < 0.05) return null; // Don't show labels for slices less than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-medium"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
      >
        {showPercentages && `${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom legend
  const CustomLegend = ({ payload }) => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => {
        const item = chartData.find(d => d.name === entry.value);
        return (
          <div key={`legend-${index}`} className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700">
              {item?.icon && <span className="mr-1">{item.icon}</span>}
              {entry.value}
              <span className="text-gray-500 ml-1">
                ({item?.count || item?.value})
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3"></div>
        </div>
        <div className={`bg-gray-50 rounded animate-pulse flex items-center justify-center`} style={{ height }}>
          <div className="w-32 h-32 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Task Distribution</h3>
          <p className="text-sm text-gray-500">Distribution of work items by type and category</p>
        </div>
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No task distribution data available</p>
            <p className="text-gray-400 text-xs mt-1">Work on some tasks to see distribution patterns</p>
          </div>
        </div>
      </div>
    );
  }

  const topTask = chartData.length > 0 ? chartData.reduce((max, item) => 
    (item.count || item.value) > (max.count || max.value) ? item : max
  ) : null;

  return (
    <div className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">Task Distribution</h3>
            {isUsingSampleData && !loading && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                Sample Data
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500">Total:</div>
            <div className="text-sm font-semibold text-gray-900">{totalTasks} tasks</div>
          </div>
        </div>
        
        {/* Top Task Highlight */}
        {topTask && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Primary focus:</span>
              <span className="font-semibold text-gray-900">
                {topTask.icon && <span className="mr-1">{topTask.icon}</span>}
                {topTask.name}
              </span>
            </div>
            <div className="text-blue-600 font-medium">
              {((topTask.count || topTask.value) / totalTasks * 100).toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Streamlined Chart with Integrated Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-8">
        {/* Pie Chart */}
        <div className="flex-1" style={{ height: height - 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={(height - 40) * 0.4}
                innerRadius={(height - 40) * 0.15} // Make it a donut for modern look
                fill="#8884d8"
                dataKey="count"
                stroke="#fff"
                strokeWidth={2}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Compact Legend */}
        <div className="lg:w-64 mt-4 lg:mt-0">
          <div className="space-y-2">
            {chartData
              .sort((a, b) => (b.count || b.value) - (a.count || a.value))
              .map((item, index) => {
                const percentage = ((item.count || item.value) / totalTasks * 100);
                return (
                  <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        {item.icon && <span className="text-sm">{item.icon}</span>}
                        <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-900">{item.count || item.value}</span>
                      <span className="text-xs text-gray-500 w-10 text-right">{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Optional Detailed Breakdown - only if explicitly requested */}
      {showDetailedBreakdown && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-3">Detailed Analysis</div>
          <div className="space-y-2">
            {chartData
              .sort((a, b) => (b.count || b.value) - (a.count || a.value))
              .map((item, index) => {
                const percentage = ((item.count || item.value) / totalTasks * 100);
                return (
                  <div key={index} className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50">
                    <div className="flex items-center space-x-2">
                      {item.icon && <span>{item.icon}</span>}
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-gray-600">
                      {item.completed > 0 && <span className="text-green-600">✓{item.completed}</span>}
                      {item.inProgress > 0 && <span className="text-blue-600">⚡{item.inProgress}</span>}
                      {item.remaining > 0 && <span className="text-gray-500">⏳{item.remaining}</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Concise Insight */}
      {topTask && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 text-center">
            Primary focus: <span className="font-semibold text-gray-700">{topTask.name}</span> 
            ({((topTask.count || topTask.value) / totalTasks * 100).toFixed(0)}% of work)
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDistributionChart;