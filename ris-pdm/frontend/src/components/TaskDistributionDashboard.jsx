import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import BugClassificationWidget from './BugClassificationWidget';

const COLORS = {
  tasks: '#4F46E5', // Indigo
  bugs: '#EF4444',  // Red
  design: '#8B5CF6', // Purple
  others: '#6B7280'  // Gray
};

const TaskDistributionDashboard = ({ 
  productId, 
  iterationPath = null, 
  assignedTo = null,
  className = '' 
}) => {
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    includeRemoved: false,
    dateRange: null
  });

  useEffect(() => {
    fetchDistributionData();
  }, [productId, iterationPath, assignedTo, filters]);

  const fetchDistributionData = async () => {
    if (!productId) return;
    
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        productId,
        ...(iterationPath && { iterationPath }),
        ...(assignedTo && { assignedTo }),
        includeRemoved: filters.includeRemoved.toString(),
        ...(filters.dateRange && { dateRange: `${filters.dateRange.start},${filters.dateRange.end}` })
      });

      const response = await fetch(`/api/metrics/task-distribution-enhanced?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      setDistributionData(data.data);
    } catch (err) {
      console.error('Error fetching task distribution data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const preparePieChartData = () => {
    if (!distributionData?.distribution) return [];

    return Object.entries(distributionData.distribution).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: data.count,
      percentage: data.percentage,
      storyPoints: data.storyPoints || 0,
      color: COLORS[type] || '#6B7280'
    }));
  };

  const prepareBarChartData = () => {
    if (!distributionData?.distribution) return [];

    return Object.entries(distributionData.distribution).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      count: data.count,
      storyPoints: data.storyPoints || 0,
      percentage: data.percentage
    }));
  };

  // Custom label function for pie chart
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    // Don't show labels for slices less than 3% to avoid overcrowding
    if (percent < 0.03) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.2; // Position outside the pie
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-medium"
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-sm text-gray-600">Count: {data.value || data.count}</p>
          <p className="text-sm text-gray-600">Percentage: {data.percentage}%</p>
          {data.storyPoints > 0 && (
            <p className="text-sm text-gray-600">Story Points: {data.storyPoints}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white p-6 rounded-lg border border-red-200 ${className}`}>
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p className="text-sm">{error}</p>
          <button 
            onClick={fetchDistributionData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!distributionData) {
    return (
      <div className={`bg-white p-6 rounded-lg border border-gray-200 ${className}`}>
        <p className="text-gray-500 text-center">No data available</p>
      </div>
    );
  }

  const pieData = preparePieChartData();
  const barData = prepareBarChartData();
  const totalItems = distributionData.metadata?.totalItems || 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Task Distribution Analysis</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Total Items: {totalItems.toLocaleString()}
            </span>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filters.includeRemoved}
                  onChange={(e) => setFilters(prev => ({ ...prev, includeRemoved: e.target.checked }))}
                  className="mr-1"
                />
                Include Removed
              </label>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(distributionData.distribution).map(([type, data]) => (
            <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold mb-1" style={{ color: COLORS[type] }}>
                {data.count}
              </div>
              <div className="text-sm font-medium text-gray-700 capitalize mb-1">
                {type}
              </div>
              <div className="text-xs text-gray-500">
                {data.percentage}%
              </div>
              {data.storyPoints > 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  {data.storyPoints} SP
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Distribution Breakdown</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend for small slices */}
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700">
                    {entry.name}: {entry.value} ({entry.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Count vs Story Points</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  yAxisId="left" 
                  dataKey="count" 
                  fill="#4F46E5" 
                  name="Count" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  yAxisId="right" 
                  dataKey="storyPoints" 
                  fill="#10B981" 
                  name="Story Points"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights */}
        {distributionData.bugClassification && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Key Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Bug Ratio:</span> 
                <span className="ml-2">
                  {Math.round((distributionData.distribution.bugs.count / totalItems) * 100)}%
                </span>
                {distributionData.distribution.bugs.count / totalItems > 0.15 && (
                  <span className="ml-2 text-red-600 text-xs">(High)</span>
                )}
              </div>
              <div>
                <span className="font-medium">Total Bugs:</span> 
                <span className="ml-2">{distributionData.bugClassification.totalBugs}</span>
              </div>
              <div>
                <span className="font-medium">Classified Bugs:</span> 
                <span className="ml-2">
                  {distributionData.bugClassification.totalBugs - distributionData.bugClassification.unclassified}
                </span>
              </div>
              <div>
                <span className="font-medium">Classification Rate:</span> 
                <span className="ml-2">{distributionData.bugClassification.classificationRate}%</span>
                {distributionData.bugClassification.classificationRate < 80 && (
                  <span className="ml-2 text-yellow-600 text-xs">(Needs Improvement)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bug Classification Widget */}
      {distributionData.bugClassification && distributionData.bugClassification.totalBugs > 0 && (
        <BugClassificationWidget 
          productId={productId}
          iterationPath={iterationPath}
          bugClassificationData={distributionData.bugClassification}
          className="mt-6"
        />
      )}
    </div>
  );
};

export default TaskDistributionDashboard;