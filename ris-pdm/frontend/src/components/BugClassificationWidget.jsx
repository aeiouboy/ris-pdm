import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ENVIRONMENT_COLORS = {
  Deploy: '#10B981', // Green
  Prod: '#EF4444',   // Red
  SIT: '#F59E0B',    // Yellow
  UAT: '#8B5CF6',    // Purple
  Other: '#6B7280',  // Gray
  Unclassified: '#9CA3AF' // Light Gray
};

const BugClassificationWidget = ({ 
  productId, 
  iterationPath = null,
  bugClassificationData = null,
  environment = null,
  className = '' 
}) => {
  const [detailedData, setDetailedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState(environment);
  const [showPatterns, setShowPatterns] = useState(false);
  const [patternsData, setPatternsData] = useState(null);

  useEffect(() => {
    if (productId) {
      fetchDetailedData();
    }
  }, [productId, selectedEnvironment, iterationPath]);

  const fetchDetailedData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (iterationPath) params.append('iterationPath', iterationPath);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/metrics/bug-classification/${encodeURIComponent(productId)}${queryString}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      setDetailedData(data);
    } catch (err) {
      console.error('Error fetching bug classification data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBugPatterns = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: productId,
        timeRange: '3months',
        ...(selectedEnvironment && { environment: selectedEnvironment })
      });

      const response = await fetch(`/api/metrics/bug-patterns?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch patterns: ${response.statusText}`);
      }

      const data = await response.json();
      setPatternsData(data.patterns);
      setShowPatterns(true);
    } catch (err) {
      console.error('Error fetching bug patterns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareEnvironmentData = (data = bugClassificationData) => {
    if (!data?.environmentBreakdown) return [];

    return Object.entries(data.environmentBreakdown).map(([env, envData]) => ({
      name: env,
      count: envData.count,
      percentage: envData.percentage,
      color: ENVIRONMENT_COLORS[env] || '#6B7280'
    })).filter(item => item.count > 0);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-sm text-gray-600">Count: {data.count || data.value}</p>
          <p className="text-sm text-gray-600">Percentage: {data.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const environmentData = prepareEnvironmentData();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Bug Classification Analysis</h3>
          <div className="flex items-center space-x-3">
            <select
              value={selectedEnvironment || ''}
              onChange={(e) => setSelectedEnvironment(e.target.value || null)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="">All Environments</option>
              <option value="Deploy">Deploy</option>
              <option value="Prod">Production</option>
              <option value="SIT">SIT</option>
              <option value="UAT">UAT</option>
            </select>
            <button
              onClick={fetchBugPatterns}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {loading ? 'Loading...' : 'View Patterns'}
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        {bugClassificationData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {bugClassificationData.totalBugs || 0}
              </div>
              <div className="text-sm font-medium text-gray-700">Total Bugs</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {bugClassificationData.classificationRate || 0}%
              </div>
              <div className="text-sm font-medium text-gray-700">Classified</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {bugClassificationData.prodIssues || 0}
              </div>
              <div className="text-sm font-medium text-gray-700">Prod Issues</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {bugClassificationData.unclassified || 0}
              </div>
              <div className="text-sm font-medium text-gray-700">Unclassified</div>
            </div>
          </div>
        )}

        {/* Environment Distribution */}
        {environmentData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pie Chart */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-4">Environment Distribution</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={environmentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => percentage > 5 ? `${name}: ${percentage}%` : ''}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {environmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-4">Bug Count by Environment</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={environmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {environmentData.map((entry, index) => (
                      <Cell key={`bar-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Environment Data */}
        {detailedData && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Environment Details</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sample Bugs
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(detailedData.bugsByEnvironment || {}).map(([env, data]) => (
                    <tr key={env}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: ENVIRONMENT_COLORS[env] }}
                          ></div>
                          <span className="text-sm font-medium text-gray-900">{env}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.percentage}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {data.bugs && data.bugs.length > 0 ? (
                          <div className="max-w-xs">
                            {data.bugs.slice(0, 2).map(bug => (
                              <div key={bug.id} className="truncate text-xs text-gray-600 mb-1">
                                #{bug.id}: {bug.title}
                              </div>
                            ))}
                            {data.bugs.length > 2 && (
                              <div className="text-xs text-gray-400">
                                +{data.bugs.length - 2} more...
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No samples</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bug Patterns */}
        {showPatterns && patternsData && (
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-gray-800">Bug Patterns & Insights</h4>
              <button
                onClick={() => setShowPatterns(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Hide Patterns
              </button>
            </div>
            
            {patternsData.insights && patternsData.insights.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h5 className="font-medium text-gray-800 mb-2">Key Insights</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {patternsData.insights.map((insight, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {patternsData.frequentBugTypes && Object.keys(patternsData.frequentBugTypes).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-gray-800 mb-2">Top Bug Types</h5>
                  <div className="space-y-2">
                    {Object.entries(patternsData.frequentBugTypes).slice(0, 5).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{type}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {patternsData.environmentTrends && Object.keys(patternsData.environmentTrends).length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Environment Trends</h5>
                    <div className="space-y-2">
                      {Object.entries(patternsData.environmentTrends).map(([env, data]) => (
                        <div key={env} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{env}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">{data.count}</div>
                            {data.avgResolutionDays > 0 && (
                              <div className="text-xs text-gray-500">{data.avgResolutionDays}d avg</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {detailedData?.insights?.recommendations && (
          <div className="border-t pt-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Recommendations</h4>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <ul className="text-sm text-gray-700 space-y-2">
                {detailedData.insights.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="border-t pt-6">
            <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BugClassificationWidget;