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
import ProductSelector from '../components/ProductSelector';
import SprintFilter from '../components/SprintFilter';

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
  // Filter states (matching Dashboard pattern)
  const [selectedProduct, setSelectedProduct] = useState(
    searchParams.get('productId') || 'Product - Partner Management Platform'
  );
  const [selectedSprint, setSelectedSprint] = useState(
    searchParams.get('sprintId') || 'current'
  );
  
  // Sprint data for resolving sprint paths (matching Dashboard pattern)
  const [sprintData, setSprintData] = useState([]);

  // Fetch sprint data for path resolution (scoped to selected product)
  useEffect(() => {
    const fetchSprintData = async () => {
      try {
        const params = new URLSearchParams({
          ...(selectedProduct && { productId: normalizeProjectId(selectedProduct) })
        });

        const response = await fetch(`/api/metrics/sprints?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const result = await response.json();
          if (result && result.success && result.data) {
            setSprintData(result.data);
          }
        }
      } catch (error) {
        console.warn('Could not fetch sprint data for path resolution:', error);
      }
    };

    fetchSprintData();
  }, [selectedProduct]);
  
  // Helper function to resolve sprint ID to iteration path (from Dashboard)
  const getSprintIterationPath = (sprintId) => {
    if (!sprintId || sprintId === 'all-sprints') return null;
    
    // Find sprint from API data
    const sprint = sprintData.find(s => s.id === sprintId);
    if (sprint?.path) {
      // For DaaS, convert full path to simple format
      if (selectedProduct === 'Product - Data as a Service' && sprint.path.includes('\\')) {
        const pathParts = sprint.path.split('\\');
        const iterationName = pathParts[pathParts.length - 1]; // Get last part
        console.log(`📊 DaaS: Converting full path "${sprint.path}" → simple format "${iterationName}"`);
        return iterationName;
      }
      console.log(`📊 Resolved sprint ${sprintId} → ${sprint.path}`);
      return sprint.path;
    }
    
    // Construct iteration path based on project and sprint
    const constructIterationPath = (projectName, sprintName) => {
      if (projectName === 'Product - Data as a Service') {
        // DaaS uses simple format extracted from sprint API data
        const sprint = sprintData.find(s => s.id === sprintName);
        if (sprint) {
          if (sprint.path && sprint.path.includes('\\')) {
            const pathParts = sprint.path.split('\\');
            const iterationName = pathParts[pathParts.length - 1]; // Get last part
            console.log(`📊 DaaS: Converting full path "${sprint.path}" → simple format "${iterationName}"`);
            return iterationName;
          }
          return sprint.name;
        }
        
        if (sprintName === 'current') {
          const now = new Date();
          const currentSprint = sprintData.find(s => {
            if (s.id === 'current' || (s.startDate && s.endDate)) {
              if (s.id === 'current') return true;
              const startDate = new Date(s.startDate);
              const endDate = new Date(s.endDate);
              return startDate <= now && now <= endDate;
            }
            return false;
          });
          
          if (currentSprint) {
            console.log(`📊 DaaS: Found current sprint "${currentSprint.name}"`);
            return currentSprint.name;
          }
          return 'current';
        }
        
        if (sprintName.startsWith('delivery-')) return `Delivery ${sprintName.replace('delivery-', '')}`;
        if (sprintName.startsWith('Delivery ')) return sprintName;
        return sprintName;
        
      } else if (projectName === 'Product - Partner Management Platform') {
        if (sprintName === 'current') return 'current';
        if (sprintName.startsWith('delivery-')) return `${projectName}\\Delivery ${sprintName.replace('delivery-', '')}`;
        return `${projectName}\\${sprintName}`;
      }
      return `${projectName}\\${sprintName}`;
    };
    
    const iterationPath = constructIterationPath(selectedProduct, sprintId);
    console.log(`📊 Constructed iteration path: ${selectedProduct} + ${sprintId} → ${iterationPath}`);
    return iterationPath;
  };

  // Helper function to normalize project ID for API calls (from Dashboard)
  const normalizeProjectId = (projectId) => {
    if (projectId === 'Product' || projectId === 'product') {
      return 'Product - Partner Management Platform';
    }
    return projectId;
  };

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
  
  // Task Distribution aligned color palette (matching Dashboard)
  const TASK_DISTRIBUTION_COLORS = {
    'tasks': '#4F46E5',    // Indigo - Tasks, User Stories, Features
    'bugs': '#EF4444',     // Red - Bugs
    'design': '#8B5CF6',   // Purple - Design work
    'others': '#6B7280'    // Gray - Other types
  };

  // Transform work items data to align with Task Distribution structure
  const transformWorkItemsForDistribution = (workItemsByType) => {
    if (!workItemsByType) return [];

    const tasks = (workItemsByType.task || 0) + (workItemsByType.userStory || 0) + (workItemsByType.feature || 0);
    const bugs = workItemsByType.bug || 0;
    const design = 0; // Design items can be added if needed
    const others = (workItemsByType.other || 0);

    const total = tasks + bugs + design + others;
    if (total === 0) return [];

    return [
      {
        name: 'Tasks',
        value: tasks,
        percentage: ((tasks / total) * 100).toFixed(1),
        color: TASK_DISTRIBUTION_COLORS.tasks
      },
      {
        name: 'Bugs',
        value: bugs,
        percentage: ((bugs / total) * 100).toFixed(1),
        color: TASK_DISTRIBUTION_COLORS.bugs
      },
      {
        name: 'Design',
        value: design,
        percentage: ((design / total) * 100).toFixed(1),
        color: TASK_DISTRIBUTION_COLORS.design
      },
      {
        name: 'Others',
        value: others,
        percentage: ((others / total) * 100).toFixed(1),
        color: TASK_DISTRIBUTION_COLORS.others
      }
    ].filter(item => item.value > 0); // Only show categories with data
  };

  // Work Items Distribution Component
  const WorkItemsDistribution = ({ workItemsByType, transformWorkItemsForDistribution, TASK_DISTRIBUTION_COLORS }) => {
    const distributionData = transformWorkItemsForDistribution(workItemsByType);
    const totalItems = distributionData.reduce((sum, item) => sum + item.value, 0);

    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Individual Task Distribution</h3>
            <p className="text-sm text-gray-500 mt-1">Personal work item breakdown and analysis</p>
          </div>
          {totalItems > 0 && (
            <div className="text-sm text-gray-600">
              Total: {totalItems} items
            </div>
          )}
        </div>

        {distributionData.length > 0 ? (
          <div className="flex flex-col xl:flex-row xl:items-start xl:space-x-6">
            {/* Enhanced Pie Chart */}
            <div className="flex-1 h-80 min-h-[20rem] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
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
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
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
                {distributionData
                  .sort((a, b) => b.value - a.value) // Sort by count descending
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white group-hover:ring-gray-100 transition-all shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.percentage}% of total
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.value}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.value === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              
              {distributionData.length > 3 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500 text-center">
                    Individual Task Analysis
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
      </>
    );
  };

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
        const normalizedProductId = normalizeProjectId(selectedProduct);
        const params = new URLSearchParams();

        // Include productId and sprintId filters (matching Dashboard pattern)
        if (normalizedProductId && normalizedProductId !== 'all-projects') {
          params.set('productId', normalizedProductId);
        }
        if (selectedSprint && selectedSprint !== 'all-sprints') {
          params.set('sprintId', selectedSprint);
          // Add iteration path for API
          const iterationPath = getSprintIterationPath(selectedSprint);
          if (iterationPath) {
            params.set('iterationPath', iterationPath);
          }
        }

        const response = await fetch(`/api/metrics/individual/${selectedUser}?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
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
  }, [selectedUser, selectedProduct, selectedSprint, sprintData]);

  const handleUserSelection = (userId) => {
    setSelectedUser(userId);
    // Update URL to support sharing
    navigate(`/individual/${encodeURIComponent(userId)}${window.location.search}`);
  };

  // Filter change handlers (matching Dashboard pattern)
  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (productId === 'all-projects') {
      newSearchParams.delete('productId');
    } else {
      newSearchParams.set('productId', productId);
    }
    setSearchParams(newSearchParams);
    // Clear selected user when changing project
    setSelectedUser('');
    navigate(`/individual?${newSearchParams.toString()}`);
  };

  const handleSprintChange = (sprintId) => {
    setSelectedSprint(sprintId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (sprintId === 'all-sprints') {
      newSearchParams.delete('sprintId');
    } else {
      newSearchParams.set('sprintId', sprintId);
    }
    setSearchParams(newSearchParams);
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
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Individual Performance</h1>
              </div>
              <p className="text-lg text-gray-600 max-w-2xl">
                Detailed performance metrics and analytics for team members across projects and sprints
              </p>
              {(selectedProduct !== 'all-projects' || selectedSprint !== 'all-sprints') && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <span className="text-sm text-gray-500 font-medium">Active Filters:</span>
                  {selectedProduct !== 'all-projects' && (
                    <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-800 rounded-lg border border-blue-200">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l7-3 7 3z" />
                      </svg>
                      {selectedProduct}
                    </span>
                  )}
                  {selectedSprint !== 'all-sprints' && (
                    <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-green-100 text-green-800 rounded-lg border border-green-200">
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {selectedSprint === 'current' ? 'Current Sprint' : selectedSprint}
                    </span>
                  )}
                </div>
              )}
            </div>
            {selectedUser && (
              <div className="flex-shrink-0">
                <ExportButtons 
                  exportType="individual"
                  userId={selectedUser}
                  period="sprint"
                  sprintId={selectedSprint}
                  className=""
                  size="small"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Enhanced Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">Filter Options</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <ProductSelector 
                  selectedProduct={selectedProduct}
                  onProductChange={handleProductChange}
                />
              </div>
              <div className="space-y-2">
                <SprintFilter 
                  selectedSprint={selectedSprint}
                  onSprintChange={handleSprintChange}
                  selectedProject={selectedProduct}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="search" className="block text-sm font-semibold text-gray-700">
                  Search Team Member
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Search by name or email..."
                  />
                </div>
                {searchQuery && (
                  <div className="text-xs text-gray-500 mt-1">
                    {filteredMembers.length} of {teamMembers.length} members match
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Team Member Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-900">Select Team Member</h3>
              </div>
              {teamMembers.length > 0 && (
                <span className="text-sm text-gray-500">
                  {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Team Members Grid */}
            {teamMembers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => handleUserSelection(member.email)}
                    className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedUser === member.email 
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md ring-1 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-all duration-200 ${
                        selectedUser === member.email 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg' 
                          : 'bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-blue-400 group-hover:to-blue-500'
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                        {selectedUser === member.email && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold truncate ${
                          selectedUser === member.email ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {member.name}
                        </div>
                        <div className={`text-sm truncate mt-0.5 ${
                          selectedUser === member.email ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {member.role}
                        </div>
                        {member.email && (
                          <div className="text-xs text-gray-400 truncate mt-1">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Hover indicator */}
                    <div className={`absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none ${
                      selectedUser === member.email ? 'opacity-0' : 'opacity-0 group-hover:opacity-5 bg-blue-500'
                    }`} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty States */}
            {filteredMembers.length === 0 && teamMembers.length > 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No members found</h4>
                <p className="text-gray-600 text-sm max-w-sm mx-auto">
                  No team members match your search criteria. Try adjusting your search terms.
                </p>
              </div>
            )}

            {teamMembersLoading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Loading team members</h4>
                <p className="text-gray-600 text-sm">Fetching available team members...</p>
              </div>
            )}

            {!teamMembersLoading && teamMembers.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No team members found</h4>
                <p className="text-gray-600 text-sm max-w-sm mx-auto mb-4">
                  No team members are available for the selected filters.
                </p>
                <p className="text-gray-500 text-xs">
                  Try adjusting your project or sprint filters to see available team members.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Individual Performance Dashboard */}
        {selectedUser && (
          <>
            {loading && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                    <div className="animate-spin w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Performance Data</h3>
                  <p className="text-gray-600">Fetching individual performance metrics...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-1">Error Loading Data</h3>
                    <p className="text-red-700">{error}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium underline"
                    >
                      Try refreshing the page
                    </button>
                  </div>
                </div>
              </div>
            )}

            {individualMetrics && (
              <>
                {/* Enhanced User Info Header */}
                <div className="bg-gradient-to-r from-white to-blue-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {individualMetrics.userInfo.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-3xl font-bold text-gray-900">{individualMetrics.userInfo.name}</h2>
                          <p className="text-gray-600 text-lg">{individualMetrics.userInfo.email}</p>
                          <div className="flex items-center space-x-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
                              </svg>
                              {individualMetrics.userInfo.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="lg:text-right space-y-3">
                        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-gray-500 font-medium">Active Period:</span>
                          <span className="font-semibold text-gray-900">
                            {selectedSprint === 'current' ? 'Current Sprint' : 
                             selectedSprint === 'all-sprints' ? 'All Sprints' : 
                             sprintData.find(s => s.id === selectedSprint)?.name || selectedSprint}
                          </span>
                        </div>
                        
                        {/* Real-time status indicator */}
                        <div className="flex items-center justify-end space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-gray-500">Live Data</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Performance KPIs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Task Completion Rate */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">
                            {(individualMetrics.performance.completionRate || 0).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700">Task Completion Rate</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Team Average:</span>
                          <span className="font-medium text-gray-700">
                            {individualMetrics.comparison?.taskCompletion?.teamAverage?.toFixed(1) || 'N/A'}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500" 
                            style={{width: `${Math.min((individualMetrics.performance.completionRate || 0), 100)}%`}}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Story Points Delivered */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">
                            {individualMetrics.performance.completedStoryPoints || 0}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700">Story Points Delivered</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Avg Velocity:</span>
                          <span className="font-medium text-gray-700">
                            {individualMetrics.performance.velocity || 0} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bugs Created/Fixed */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">
                            {individualMetrics.quality.bugsCreated}/{individualMetrics.quality.bugsFixed}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700">Bugs Created/Fixed</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Bug Ratio:</span>
                          <span className="font-medium text-gray-700">
                            {((individualMetrics.quality.bugRatio || 0) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Charts Section */}
                <div className="space-y-6">
                  {/* Velocity Trend Analysis and Task Distribution - Same Row */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Individual Velocity Trend Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Velocity Trend Analysis</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Track individual velocity and delivery predictability over sprints</p>
                    </div>
                    <div className="p-6">

{(() => {
                    // Transform trends data to match chart format
                    const rawTrends = individualMetrics.trends || [];
                    const velocityData = rawTrends.map(trend => ({
                      sprint: trend.period ? trend.period.split('\\').pop() || trend.period : 'Unknown',
                      velocity: trend.velocity || 0,
                      storyPoints: trend.storyPoints || 0,
                      completionRate: trend.completionRate || 0
                    }));
                    const averageVelocity = velocityData.length > 0 ? velocityData.reduce((sum, item) => sum + (item.velocity || 0), 0) / velocityData.length : 0;
                    const lastThreeAvg = velocityData.length >= 3 ? velocityData.slice(-3).reduce((sum, item) => sum + (item.velocity || 0), 0) / 3 : averageVelocity;
                    const trend = velocityData.length > 1 ? 
                      ((velocityData[velocityData.length - 1]?.velocity - velocityData[0]?.velocity) / (velocityData[0]?.velocity || 1)) * 100 : 0;
                    
                    return (
                      <>
                        {/* Summary Stats */}
                        <div className="flex items-center justify-between text-sm mb-4">
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
                          </div>
                        </div>

                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={velocityData}>
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
                              <Tooltip 
                                content={({ active, payload, label }) => {
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
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="velocity"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                                activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Footer Stats */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-lg font-bold text-blue-600">
                                {velocityData[velocityData.length - 1]?.velocity || 0}
                              </div>
                              <div className="text-sm text-gray-500">Current</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-green-600">
                                {averageVelocity.toFixed(1)}
                              </div>
                              <div className="text-sm text-gray-500">Average</div>
                            </div>
                            <div>
                              <div className={`text-lg font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                              </div>
                              <div className="text-sm text-gray-500">Trend</div>
                            </div>
                          </div>
                        </div>

                        {/* Individual Performance Insights */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Performance: </span>
                            {trend >= 10 && <span className="text-green-600">🚀 Strong improvement in personal velocity.</span>}
                            {trend < -10 && <span className="text-red-600">📉 Declining velocity may need attention.</span>}
                            {Math.abs(trend) < 10 && <span className="text-blue-600">📊 Consistent personal performance.</span>}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                  {/* Work Items Distribution Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Task Distribution</h3>
                      </div>
                    </div>
                    <div className="p-6">
                      {(() => {
                        // Transform work items data for individual display
                        const workItemsData = individualMetrics.workItems;
                        const recentItems = workItemsData.recent || [];
                        
                        // Count work items by type from recent items (more accurate for individual)
                        const itemsByType = recentItems.reduce((acc, item) => {
                          const type = item.type?.toLowerCase() || 'other';
                          if (!acc[type]) {
                            acc[type] = 0;
                          }
                          acc[type] += 1;
                          return acc;
                        }, {});

                        // Convert to array format for display
                        const distributionData = Object.entries(itemsByType).map(([type, count]) => ({
                          type: type.charAt(0).toUpperCase() + type.slice(1),
                          count,
                          percentage: recentItems.length > 0 ? ((count / recentItems.length) * 100).toFixed(1) : 0
                        }));

                        if (distributionData.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-12">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                                </svg>
                              </div>
                              <div className="text-center">
                                <h4 className="text-sm font-medium text-gray-900 mb-1">No task distribution data</h4>
                                <p className="text-sm text-gray-500">Task distribution data will appear here when available</p>
                              </div>
                            </div>
                          );
                        }

                        const maxCount = Math.max(...distributionData.map(item => item.count));

                        return (
                          <div className="space-y-4">
                            {distributionData.map((item, index) => {
                              const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                              const colorClass = 
                                item.type === 'Bug' ? 'bg-red-500' :
                                item.type === 'User story' || item.type === 'User Story' ? 'bg-blue-500' :
                                item.type === 'Task' ? 'bg-green-500' :
                                item.type === 'Feature' ? 'bg-purple-500' :
                                'bg-gray-500';
                              
                              return (
                                <div key={index} className="flex items-center space-x-3">
                                  <div className="flex-shrink-0 w-20 text-right">
                                    <span className="text-sm font-medium text-gray-900">{item.type}</span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                                        <div 
                                          className={`h-full ${colorClass} transition-all duration-500 ease-out`}
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      <div className="flex-shrink-0 w-12 text-right">
                                        <span className="text-sm font-semibold text-gray-700">{item.count}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>


                  {/* Recent Work Items - Full Width */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <h3 className="text-lg font-semibold text-gray-900">Recent Work Items</h3>
                        </div>
                        {individualMetrics.workItems.recent?.length > 0 && (
                          <span className="text-sm text-gray-500">
                            {individualMetrics.workItems.recent.length} item{individualMetrics.workItems.recent.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">ID</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Title</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Type</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">State</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Points</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Assigned To</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Created</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm">Updated</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {individualMetrics.workItems.recent?.map((item, index) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200">
                              <td className="py-4 px-6 text-sm">
                                {item.url ? (
                                  <a 
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium transition-colors group"
                                  >
                                    <span className="font-mono">#{item.id}</span>
                                    <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="font-mono text-gray-900">#{item.id}</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm max-w-md">
                                <div>
                                  {item.url ? (
                                    <a 
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-900 hover:text-blue-600 transition-colors font-medium"
                                      title={item.title}
                                    >
                                      {item.title}
                                    </a>
                                  ) : (
                                    <span className="text-gray-900 font-medium" title={item.title}>{item.title}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${
                                  item.type?.toLowerCase().includes('bug') ? 'bg-red-100 text-red-800 border border-red-200' :
                                  item.type?.toLowerCase().includes('task') ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  item.type?.toLowerCase().includes('story') ? 'bg-green-100 text-green-800 border border-green-200' :
                                  'bg-gray-100 text-gray-800 border border-gray-200'
                                }`}>
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${
                                  ['Closed', 'Done', 'Resolved'].includes(item.state) ? 'bg-green-100 text-green-800 border border-green-200' :
                                  ['Active', 'In Progress'].includes(item.state) ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  ['New', 'To Do'].includes(item.state) ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                                  'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                }`}>
                                  <div className={`w-2 h-2 rounded-full mr-2 ${
                                    ['Closed', 'Done', 'Resolved'].includes(item.state) ? 'bg-green-600' :
                                    ['Active', 'In Progress'].includes(item.state) ? 'bg-blue-600' :
                                    ['New', 'To Do'].includes(item.state) ? 'bg-gray-600' :
                                    'bg-yellow-600'
                                  }`} />
                                  {item.state}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-sm font-semibold text-gray-900">
                                {item.storyPoints ? (
                                  <div className="flex items-center space-x-1">
                                    <span>{item.storyPoints}</span>
                                    <span className="text-xs text-gray-500">pts</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-900">
                                {item.assignedTo || selectedUser?.displayName || <span className="text-gray-400">-</span>}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500">
                                {item.createdDate ? new Date(item.createdDate).toLocaleDateString() : <span className="text-gray-400">-</span>}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-500">
                                {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : <span className="text-gray-400">-</span>}
                              </td>
                            </tr>
                          ))}
                          {(!individualMetrics.workItems.recent || individualMetrics.workItems.recent.length === 0) && (
                            <tr>
                              <td colSpan={8} className="text-center py-12">
                                <div className="flex flex-col items-center space-y-3">
                                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                  </div>
                                  <div className="text-center">
                                    <h4 className="text-sm font-medium text-gray-900 mb-1">No work items found</h4>
                                    <p className="text-sm text-gray-500">No recent work items available for this user</p>
                                  </div>
                                </div>
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
              </div>
            </>
          )}
        </>
      )}

      {!selectedUser && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Select a Team Member</h3>
              <p className="text-gray-600 leading-relaxed">
                Choose a team member from the selection above to view their detailed performance metrics, 
                velocity trends, and work item analysis.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Performance analytics ready</span>
                </div>
              </div>
            </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default IndividualPerformance;