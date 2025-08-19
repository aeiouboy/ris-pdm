import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ExportButtons } from '../components';
import RealtimeStatus, { LastUpdateIndicator } from '../components/RealtimeStatus';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';
import { projectsConfig } from '../config/branding';

const IndividualPerformance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useParams();
  const [selectedUser, setSelectedUser] = useState(
    params.userId || searchParams.get('userId') || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [individualMetrics, setIndividualMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('sprint');
  
  // Get filter parameters from URL
  const selectedProduct = searchParams.get('productId') || 'all-projects';
  const selectedSprint = searchParams.get('sprintId') || 'all-sprints';

  // Real-time metrics hook for individual performance
  const { 
    data: realtimeData, 
    loading: realtimeLoading, 
    error: realtimeError, 
    connected, 
    lastUpdate, 
    updateCount, 
    refresh 
  } = useRealtimeMetrics('individual', { 
    userId: selectedUser,
    enabled: !!selectedUser,
    pollingFallback: 45000 // 45 second fallback polling
  });

  // Use real-time data if available
  const data = realtimeData || individualMetrics;
  
  // Enhanced color palette for work item types
  const WORK_TYPE_COLORS = {
    'Bug': '#EF4444',           // Red
    'User Story': '#3B82F6',    // Blue  
    'Task': '#10B981',          // Green
    'Feature': '#8B5CF6',       // Purple
    'Epic': '#F59E0B',          // Amber
    'Spike': '#EC4899',         // Pink
    'Test Case': '#06B6D4',     // Cyan
    'Documentation': '#84CC16', // Lime
    'Improvement': '#F97316',   // Orange
    'Research': '#6366F1'       // Indigo
  };
  
  // Fallback colors for unknown types
  const FALLBACK_COLORS = ['#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9'];

  // Fetch team members list with product filtering
  useEffect(() => {
    let isMounted = true;
    let retryTimeout;

    const fetchTeamMembers = async (retryCount = 0) => {
      if (!isMounted) return;

      try {
        console.log('📊 Fetching team members with filters:', { selectedProduct, selectedSprint, attempt: retryCount + 1 });
        setTeamMembersLoading(true);
        
        const params = new URLSearchParams();
        if (selectedProduct && selectedProduct !== 'all-projects') {
          params.set('productId', selectedProduct);
        }
        if (selectedSprint && selectedSprint !== 'all-sprints') {
          params.set('sprintId', selectedSprint);
        }
        
        const queryString = params.toString();
        const apiUrl = queryString ? `/api/metrics/team-members?${queryString}` : '/api/metrics/team-members';
        
        console.log('📊 Team members API URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (!isMounted) return;

        if (response.status === 429) {
          // Handle rate limiting with exponential backoff
          const retryAfter = response.headers.get('Retry-After') || Math.pow(2, retryCount);
          const delay = Math.min(parseInt(retryAfter) * 1000, 30000); // Max 30 seconds
          
          console.warn(`📊 Rate limited (429). Retrying in ${delay/1000}s... (attempt ${retryCount + 1}/3)`);
          
          if (retryCount < 2) { // Max 3 attempts
            retryTimeout = setTimeout(() => {
              if (isMounted) {
                fetchTeamMembers(retryCount + 1);
              }
            }, delay);
            return;
          } else {
            throw new Error('Too many requests. Please try again later.');
          }
        }
        
        const data = await response.json();
        
        if (response.ok && data.data) {
          console.log('📊 Team members loaded:', data.data);
          setTeamMembers(data.data.members || []);
          setTeamMembersLoading(false);
        } else {
          console.error('Failed to fetch team members:', data.error);
          setTeamMembers([]);
          setTeamMembersLoading(false);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        if (isMounted) {
          setTeamMembers([]);
          setTeamMembersLoading(false);
        }
      }
    };

    fetchTeamMembers();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [selectedProduct, selectedSprint]); // Re-fetch when filters change

  // Fetch individual metrics when user is selected
  useEffect(() => {
    const fetchIndividualMetrics = async () => {
      if (!selectedUser) {
        setIndividualMetrics(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          period
        });

        // Include productId if it's specified in the URL parameters
        if (selectedProduct && selectedProduct !== 'all-projects') {
          params.set('productId', selectedProduct);
        }

        const response = await fetch(`/api/metrics/individual/${selectedUser}?${params}`);
        const data = await response.json();
        
        if (response.ok) {
          setIndividualMetrics(data.data);
        } else {
          setError(data.error || 'Failed to fetch individual metrics');
        }
      } catch (error) {
        console.error('Error fetching individual metrics:', error);
        setError('Failed to fetch individual metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchIndividualMetrics();
  }, [selectedUser, period, selectedProduct]);

  const handleUserSelection = (userId) => {
    setSelectedUser(userId);
    // Update URL to support sharing
    navigate(`/individual/${encodeURIComponent(userId)}${window.location.search}`);
  };

  const handleProjectFilter = (projectId) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (projectId === 'all-projects') {
      newSearchParams.delete('productId');
    } else {
      newSearchParams.set('productId', projectId);
    }
    setSearchParams(newSearchParams);
    // Clear selected user when changing project
    setSelectedUser('');
    navigate(`/individual?${newSearchParams.toString()}`);
  };

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper function to get trend icon
  const getTrendIcon = (trend) => {
    if (trend > 0) return '↗️';
    if (trend < 0) return '↘️';
    return '➡️';
  };

  // Helper function to get performance badge color
  const getPerformanceBadge = (score) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Individual Performance</h1>
            <p className="text-gray-600">Detailed performance metrics for team members</p>
            {(selectedProduct !== 'all-projects' || selectedSprint !== 'all-sprints') && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedProduct !== 'all-projects' && (
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    Product: {selectedProduct}
                  </span>
                )}
                {selectedSprint !== 'all-sprints' && (
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Sprint: {selectedSprint}
                  </span>
                )}
              </div>
            )}
          </div>
          {selectedUser && (
            <div className="mt-4 sm:mt-0">
              <ExportButtons 
                exportType="individual"
                userId={selectedUser}
                period={period}
                className="flex-shrink-0"
                size="small"
              />
            </div>
          )}
        </div>
      </div>

      {/* Team Member Selection */}
      <div className="bg-white p-6 rounded-lg shadow-dashboard border mb-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Team Member
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by name or email..."
            />
          </div>
          <div className="lg:w-64">
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
              Project Filter
            </label>
            <select
              id="project"
              value={selectedProduct}
              onChange={(e) => handleProjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all-projects">All Projects</option>
              {projectsConfig.filter(project => project.id !== 'all-projects').map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:w-48">
            <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="sprint">Current Sprint</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>

        {/* Team Members List */}
        {teamMembers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => handleUserSelection(member.email)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors hover:border-blue-300 ${
                  selectedUser === member.email ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredMembers.length === 0 && teamMembers.length > 0 && (
          <div className="text-center py-4 text-gray-500">
            No team members found matching your search.
          </div>
        )}

        {teamMembersLoading && (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full mb-2" />
            <div>Loading team members...</div>
          </div>
        )}

        {!teamMembersLoading && teamMembers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div>No team members found for the selected filters.</div>
            <div className="text-sm mt-2">Try adjusting your project or sprint filters.</div>
          </div>
        )}
      </div>

      {/* Individual Performance Dashboard */}
      {selectedUser && (
        <>
          {loading && (
            <div className="bg-white rounded-lg shadow-dashboard border p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading performance metrics...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex">
                <div className="text-red-600 mr-3">⚠️</div>
                <div>
                  <h3 className="text-lg font-medium text-red-900">Error Loading Data</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {individualMetrics && (
            <>
              {/* User Info Header */}
              <div className="bg-white rounded-lg shadow-dashboard border p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {individualMetrics.userInfo.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{individualMetrics.userInfo.name}</h2>
                      <p className="text-gray-600">{individualMetrics.userInfo.email}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {individualMetrics.userInfo.role}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Period</div>
                    <div className="font-semibold text-gray-900">{period.charAt(0).toUpperCase() + period.slice(1)}</div>
                  </div>
                </div>
              </div>

              {/* Performance KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Task Completion Rate</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.performance.taskCompletionRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      ✅
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      vs Team Avg: {individualMetrics.comparison?.taskCompletion?.teamAverage?.toFixed(1) || 'N/A'}%
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Story Points Delivered</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.performance.storyPointsDelivered}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      📊
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      Avg Velocity: {individualMetrics.performance.averageVelocity}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Quality Score</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.performance.qualityScore}/10
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      ⭐
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPerformanceBadge(individualMetrics.performance.qualityScore)}`}>
                      {individualMetrics.performance.qualityScore >= 8 ? 'Excellent' : 
                       individualMetrics.performance.qualityScore >= 6 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Average Cycle Time</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.performance.cycleTime} days
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      ⏱️
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      vs Team Avg: {individualMetrics.comparison?.cycleTime?.teamAverage?.toFixed(1) || 'N/A'} days
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Bugs Created/Fixed</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.quality.bugsCreated}/{individualMetrics.quality.bugsFixed}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      🐛
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      Ratio: {(individualMetrics.quality.bugRatio * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Productivity Score</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {individualMetrics.performance.productivity}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      🚀
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Velocity Trend */}
                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Sprint Velocity</h3>
                      <p className="text-sm text-gray-500 mt-1">Committed vs delivered story points by sprint</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        <span className="text-sm text-gray-600">Delivered</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="text-sm text-gray-600">Committed</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={individualMetrics.trends.velocity}
                        margin={{
                          top: 10,
                          right: 20,
                          left: 0,
                          bottom: 0,
                        }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="#f1f5f9"
                          vertical={false}
                        />
                        
                        <XAxis 
                          dataKey="sprint" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          dy={10}
                        />
                        
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          width={35}
                          label={{ 
                            value: 'Story Points', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fontSize: '12px', fill: '#64748b' }
                          }}
                        />
                        
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const achievementRate = ((data.value || data.velocity || 0) / (data.commitment || 1)) * 100;
                              const variance = (data.value || data.velocity || 0) - (data.commitment || 0);
                              
                              return (
                                <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 min-w-[220px]">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="font-semibold text-gray-900">{label}</p>
                                    {data.date && (
                                      <span className="text-xs text-gray-500">
                                        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                                        <span className="text-sm text-gray-600">Committed:</span>
                                      </div>
                                      <span className="text-sm font-semibold text-gray-900">
                                        {data.commitment || 0} pts
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                        <span className="text-sm text-gray-600">Delivered:</span>
                                      </div>
                                      <span className="text-sm font-semibold text-gray-900">
                                        {data.value || data.velocity || 0} pts
                                      </span>
                                    </div>
                                    
                                    <div className="pt-2 border-t border-gray-100 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Achievement:</span>
                                        <span className={`text-sm font-bold ${
                                          achievementRate >= 100 ? 'text-green-600' : 
                                          achievementRate >= 85 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {achievementRate.toFixed(0)}%
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Variance:</span>
                                        <span className={`text-sm font-medium ${
                                          variance >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {variance >= 0 ? '+' : ''}{variance} pts
                                        </span>
                                      </div>
                                      
                                      <div className="pt-1">
                                        <div className={`px-2 py-1 rounded-full text-xs font-medium text-center ${
                                          achievementRate >= 100 ? 'bg-green-100 text-green-800' :
                                          achievementRate >= 85 ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          {achievementRate >= 100 ? '🎯 Target Exceeded' :
                                           achievementRate >= 85 ? '📊 Close to Target' :
                                           '⚠️ Below Target'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        
                        {/* Committed velocity bars (background) */}
                        <Bar
                          dataKey="commitment"
                          fill="#10b981"
                          opacity={0.6}
                          name="Committed"
                          radius={[2, 2, 0, 0]}
                        />
                        
                        {/* Delivered velocity bars (foreground) */}
                        <Bar
                          dataKey="value"
                          fill="#3b82f6"
                          name="Delivered"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Sprint Summary */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Avg Delivered: </span>
                        <span className="font-medium text-gray-900">
                          {individualMetrics.trends.velocity?.length > 0 
                            ? (individualMetrics.trends.velocity.reduce((sum, item) => sum + (item.value || 0), 0) / individualMetrics.trends.velocity.length).toFixed(1)
                            : 0} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Committed: </span>
                        <span className="font-medium text-gray-900">
                          {individualMetrics.trends.velocity?.length > 0 
                            ? (individualMetrics.trends.velocity.reduce((sum, item) => sum + (item.commitment || 0), 0) / individualMetrics.trends.velocity.length).toFixed(1)
                            : 0} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Success Rate: </span>
                        <span className={`font-medium ${
                          individualMetrics.trends.velocity?.length > 0 &&
                          (individualMetrics.trends.velocity.filter(s => (s.value || 0) >= (s.commitment || 0)).length / individualMetrics.trends.velocity.length) >= 0.7
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {individualMetrics.trends.velocity?.length > 0 
                            ? ((individualMetrics.trends.velocity.filter(s => (s.value || 0) >= (s.commitment || 0)).length / individualMetrics.trends.velocity.length) * 100).toFixed(0)
                            : 0}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Predictability: </span>
                        <span className="font-medium text-gray-900">
                          {individualMetrics.trends.velocity?.length > 0 
                            ? (100 - Math.abs(
                                individualMetrics.trends.velocity.reduce((sum, item) => sum + (item.value || 0), 0) / individualMetrics.trends.velocity.length -
                                individualMetrics.trends.velocity.reduce((sum, item) => sum + (item.commitment || 0), 0) / individualMetrics.trends.velocity.length
                              ) * 5).toFixed(0)
                            : 100}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Work Items Distribution */}
                <div className="bg-white p-6 rounded-lg shadow-dashboard border">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Work Items by Type</h3>
                      <p className="text-sm text-gray-500 mt-1">Distribution of completed work items by category</p>
                    </div>
                    {individualMetrics.workItems.byType && Object.keys(individualMetrics.workItems.byType).length > 0 && (
                      <div className="text-sm text-gray-600">
                        Total: {Object.values(individualMetrics.workItems.byType).reduce((sum, count) => sum + count, 0)} items
                      </div>
                    )}
                  </div>
                  
                  {individualMetrics.workItems.byType && Object.keys(individualMetrics.workItems.byType).length > 0 ? (
                    <div className="flex flex-col xl:flex-row xl:items-start xl:space-x-6">
                      {/* Enhanced Pie Chart */}
                      <div className="flex-1 h-80 min-h-[20rem] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(individualMetrics.workItems.byType).map(([type, count]) => ({
                                name: type,
                                value: count,
                                percentage: ((count / Object.values(individualMetrics.workItems.byType).reduce((sum, c) => sum + c, 0)) * 100).toFixed(1)
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false} // Disable built-in labels to prevent overlap
                              outerRadius={90}
                              innerRadius={30}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="#ffffff"
                              strokeWidth={2}
                            >
                              {Object.entries(individualMetrics.workItems.byType).map(([type], index) => {
                                const color = WORK_TYPE_COLORS[type] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Pie>
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <div 
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: payload[0].fill }}
                                        />
                                        <span className="font-semibold text-gray-900">{data.name}</span>
                                      </div>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Count:</span>
                                          <span className="font-medium text-gray-900">{data.value} items</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Percentage:</span>
                                          <span className="font-medium text-gray-900">{data.percentage}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Enhanced Legend with Statistics */}
                      <div className="xl:w-72 mt-6 xl:mt-0 xl:flex-shrink-0">
                        <div className="space-y-2">
                          {Object.entries(individualMetrics.workItems.byType)
                            .sort(([,a], [,b]) => b - a) // Sort by count descending
                            .map(([type, count], index) => {
                              const total = Object.values(individualMetrics.workItems.byType).reduce((sum, c) => sum + c, 0);
                              const percentage = ((count / total) * 100).toFixed(1);
                              const color = WORK_TYPE_COLORS[type] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                              
                              return (
                                <div key={type} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200">
                                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <div 
                                      className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white group-hover:ring-gray-100 transition-all shadow-sm"
                                      style={{ backgroundColor: color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 truncate" title={type}>
                                        {type}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {percentage}% of total
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-3">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {count}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {count === 1 ? 'item' : 'items'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        
                        {Object.keys(individualMetrics.workItems.byType).length > 5 && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-500 text-center">
                              Showing top work item types
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4 opacity-50">📋</div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No Work Items Data</h4>
                        <p className="text-gray-600 text-sm">
                          No work items found for the selected period. 
                          <br />
                          Try adjusting the time period or check data availability.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Work Items */}
              <div className="bg-white rounded-lg shadow-dashboard border">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Work Items</h3>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">ID</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Title</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">State</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Story Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {individualMetrics.workItems.recent?.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm font-mono">
                              {item.url ? (
                                <a 
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center space-x-1"
                                >
                                  <span>#{item.id}</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <span className="text-gray-900">#{item.id}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {item.url ? (
                                <a 
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-900 hover:text-blue-600 hover:underline transition-colors inline-flex items-center space-x-1 group"
                                  title="Open in Azure DevOps"
                                >
                                  <span>{item.title}</span>
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <span className="text-gray-900">{item.title}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {item.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                ['Closed', 'Done', 'Resolved'].includes(item.state) ? 'bg-green-100 text-green-800' :
                                ['Active', 'In Progress'].includes(item.state) ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {item.state}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">{item.storyPoints || 0}</td>
                          </tr>
                        ))}
                        {(!individualMetrics.workItems.recent || individualMetrics.workItems.recent.length === 0) && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-gray-500">
                              No recent work items found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Performance Alerts */}
              {individualMetrics.alerts && individualMetrics.alerts.length > 0 && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-4">Performance Alerts</h3>
                  <div className="space-y-3">
                    {individualMetrics.alerts.map((alert, index) => (
                      <div key={index} className={`p-3 rounded-md ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        <div className="flex">
                          <div className="mr-3">
                            {alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                          </div>
                          <div>
                            <p className="font-medium">{alert.message}</p>
                            {alert.value && (
                              <p className="text-sm mt-1">Current value: {alert.value}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!selectedUser && (
        <div className="bg-white rounded-lg shadow-dashboard border p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Team Member</h3>
            <p className="text-gray-600">Choose a team member above to view their individual performance metrics.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndividualPerformance;