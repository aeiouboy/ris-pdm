import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExportButtons } from '../components';
import RealtimeStatus, { LastUpdateIndicator } from '../components/RealtimeStatus';
import { useRealtimeMetrics } from '../hooks/useRealtimeMetrics';
import ProductSelector from '../components/ProductSelector';
import SprintFilter from '../components/SprintFilter';
import DateRangePicker from '../components/DateRangePicker';
import { PLCard, VelocityCard, BugCountCard, SatisfactionCard } from '../components/KPICard';
import SprintBurndownChart from '../components/SprintBurndownChart';
import TeamVelocityChart from '../components/TeamVelocityChart';
import TaskDistributionDashboard from '../components/TaskDistributionDashboard';
import useSwipeNavigation from '../hooks/useSwipeNavigation.jsx';

const Dashboard = () => {
  // Filter states
  const [selectedProduct, setSelectedProduct] = useState('Product - Partner Management Platform');
  const [selectedSprint, setSelectedSprint] = useState('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Swipe navigation for mobile
  const swipeNavigation = useSwipeNavigation({ 
    enabled: true, 
    threshold: 100,
    preventScroll: false 
  });

  // Real-time metrics hook with fallback to regular API
  const { 
    data: realtimeData, 
    loading: realtimeLoading, 
    error: realtimeError, 
    connected, 
    lastUpdate, 
    updateCount, 
    refresh 
  } = useRealtimeMetrics('dashboard', { 
    enabled: true,
    pollingFallback: 30000 // 30 second fallback polling
  });

  // Fallback state for backward compatibility
  const [fallbackData, setFallbackData] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(true);
  const [fallbackError, setFallbackError] = useState(null);

  // State for component data
  const [kpiData, setKpiData] = useState(null);
  const [burndownData, setBurndownData] = useState([]);
  const [velocityTrendData, setVelocityTrendData] = useState([]);
  const [componentLoading, setComponentLoading] = useState({
    kpis: false,
    burndown: false,
    velocity: false
  });

  // Use real-time data if available, otherwise use fallback
  const data = realtimeData || fallbackData;
  const loading = realtimeLoading && fallbackLoading;
  const error = realtimeError || fallbackError;
  
  // Debug logging
  console.log('📊 Dashboard data state:', {
    realtimeData: !!realtimeData,
    fallbackData: !!fallbackData,
    data: !!data,
    hasKPIs: !!data?.kpis,
    realtimeLoading,
    fallbackLoading,
    loading
  });

  // Fallback API call if real-time is not available
  useEffect(() => {
    const fetchFallbackData = async () => {
      try {
        console.log('📊 Starting fallback data fetch...');
        setFallbackLoading(true);
        setFallbackError(null);
        
        const response = await axios.get('/api/metrics/overview', {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Fallback response received:', response.data);
        
        if (response.data && response.data.data) {
          setFallbackData(response.data.data);
          console.log('📊 Fallback data set:', response.data.data);
        } else {
          console.error('📊 Invalid response structure:', response.data);
          setFallbackError('Invalid data structure received');
        }
      } catch (err) {
        console.error('📊 Fallback fetch error:', err);
        setFallbackError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        console.log('📊 Fallback fetch completed, setting loading to false');
        setFallbackLoading(false);
      }
    };

    // Always try fallback first, then let real-time override if available
    if (!fallbackData && !fallbackLoading) {
      console.log('📊 Triggering fallback fetch - no data and not loading');
      fetchFallbackData();
    }
    
    // Also fetch fallback if real-time has been loading for too long
    const timeoutId = setTimeout(() => {
      if (realtimeLoading && !realtimeData && !fallbackData) {
        console.log('📊 Real-time taking too long, using fallback');
        fetchFallbackData();
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeoutId);
  }, [realtimeData, realtimeLoading, fallbackData, fallbackLoading]);

  // Fetch KPI data when filters change
  useEffect(() => {
    const fetchKPIData = async () => {
      setComponentLoading(prev => ({ ...prev, kpis: true }));
      try {
        const params = new URLSearchParams({
          period: 'sprint',
          ...(selectedProduct !== 'all-projects' && { productId: selectedProduct }),
          ...(selectedSprint !== 'all-sprints' && { sprintId: selectedSprint })
        });
        
        const response = await axios.get(`/api/metrics/kpis?${params}`);
        setKpiData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching KPI data:', error);
        console.log('🔄 KPI data fetch failed - leaving null to show error state');
        setKpiData(null); // Don't use mock data - let components handle error state
      } finally {
        setComponentLoading(prev => ({ ...prev, kpis: false }));
      }
    };

    fetchKPIData();
  }, [selectedProduct, selectedSprint, startDate, endDate]);

  // Fetch Burndown data
  useEffect(() => {
    const fetchBurndownData = async () => {
      setComponentLoading(prev => ({ ...prev, burndown: true }));
      try {
        const params = new URLSearchParams({
          ...(selectedProduct !== 'all-projects' && { productId: selectedProduct }),
          ...(selectedSprint !== 'all-sprints' && { sprintId: selectedSprint })
        });
        
        const response = await axios.get(`/api/metrics/burndown?${params}`);
        setBurndownData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching burndown data:', error);
        console.log('🔄 Burndown data fetch failed - leaving empty to show error state');
        setBurndownData([]); // Empty array will show "no data" state instead of sample data
      } finally {
        setComponentLoading(prev => ({ ...prev, burndown: false }));
      }
    };

    fetchBurndownData();
  }, [selectedProduct, selectedSprint]);

  // Fetch Velocity Trend data
  useEffect(() => {
    const fetchVelocityTrend = async () => {
      setComponentLoading(prev => ({ ...prev, velocity: true }));
      try {
        const params = new URLSearchParams({
          period: 'sprint',
          range: '6',
          ...(selectedProduct !== 'all-projects' && { productId: selectedProduct })
        });
        
        const response = await axios.get(`/api/metrics/velocity-trend?${params}`);
        setVelocityTrendData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching velocity trend data:', error);
        console.log('🔄 Velocity trend data fetch failed - leaving empty to show error state');
        setVelocityTrendData([]); // Empty array will show "no data" state instead of sample data
      } finally {
        setComponentLoading(prev => ({ ...prev, velocity: false }));
      }
    };

    fetchVelocityTrend();
  }, [selectedProduct]);


  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  // Filter change handlers
  const handleDateRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="p-6" ref={(el) => swipeNavigation.bindSwipeHandlers(el)}>
      {/* Header with Title and Status */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">RIS Performance Dashboard</h1>
              <RealtimeStatus showDetails={true} showControls={true} />
            </div>
            <p className="text-gray-600">Overview of team and individual performance metrics</p>
            {updateCount > 0 && (
              <div className="flex items-center space-x-4 mt-1">
                <LastUpdateIndicator lastUpdate={lastUpdate} />
                {connected && (
                  <span className="text-xs text-green-600 font-medium">
                    {updateCount} real-time update{updateCount > 1 ? 's' : ''} received
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col items-end space-y-2">
            <ExportButtons 
              exportType="dashboard"
              period="sprint"
              className="flex-shrink-0"
            />
            {!connected && (
              <button
                onClick={refresh}
                disabled={loading}
                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Filter Bar - Matches PRD Layout */}
      <div className="bg-white p-4 rounded-lg shadow-dashboard border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProductSelector 
            selectedProduct={selectedProduct}
            onProductChange={setSelectedProduct}
          />
          <SprintFilter 
            selectedSprint={selectedSprint}
            onSprintChange={setSelectedSprint}
          />
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      {/* KPI Cards Row - Matches PRD Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <PLCard 
          value={kpiData?.pl?.value}
          trend={kpiData?.pl?.trend}
          trendValue={kpiData?.pl?.trendValue}
          loading={componentLoading.kpis}
        />
        <VelocityCard 
          value={kpiData?.velocity?.value}
          trend={kpiData?.velocity?.trend}
          trendValue={kpiData?.velocity?.trendValue}
          loading={componentLoading.kpis}
        />
        <BugCountCard 
          value={kpiData?.bugs?.value}
          trend={kpiData?.bugs?.trend}
          trendValue={kpiData?.bugs?.trendValue}
          loading={componentLoading.kpis}
        />
        <SatisfactionCard 
          value={kpiData?.satisfaction?.value}
          trend={kpiData?.satisfaction?.trend}
          trendValue={kpiData?.satisfaction?.trendValue}
          loading={componentLoading.kpis}
        />
      </div>

      {/* Charts Section - Matches PRD Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sprint Burndown Chart */}
        <SprintBurndownChart 
          data={burndownData}
          loading={componentLoading.burndown}
          height={320}
        />
        
        {/* Team Velocity Trend Chart */}
        <TeamVelocityChart 
          data={velocityTrendData}
          loading={componentLoading.velocity}
          height={320}
        />
      </div>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Team Performance Summary */}
        <div className="bg-white p-6 rounded-lg shadow-dashboard border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Performance</h3>
          <div className="space-y-4">
            {data?.kpis ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Delivery Predictability</span>
                  <span className="font-semibold text-blue-600">{data.kpis.deliveryPredictability}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Team Satisfaction</span>
                  <span className="font-semibold text-green-600">
                    {typeof data.kpis.teamSatisfaction === 'object' ? 
                      data.kpis.teamSatisfaction.value : 
                      `${data.kpis.teamSatisfaction}/10`
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Code Quality</span>
                  <span className="font-semibold text-purple-600">{data.kpis.codeQuality}/10</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cycle Time</span>
                  <span className="font-semibold text-orange-600">{data.kpis.cycleTime} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Defect Escape Rate</span>
                  <span className="font-semibold text-red-600">{data.kpis.defectEscapeRate}%</span>
                </div>
              </>
            ) : (
              <div className="text-gray-500">
                Loading KPI data... 
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs mt-2 text-gray-400 space-y-1">
                    <div>
                      Data: {data ? 'exists' : 'null'} | 
                      RT Loading: {realtimeLoading ? 'yes' : 'no'} | 
                      FB Loading: {fallbackLoading ? 'yes' : 'no'} |
                      KPIs: {data?.kpis ? 'exists' : 'missing'}
                    </div>
                    <div>
                      RT Data: {realtimeData ? 'exists' : 'null'} | 
                      FB Data: {fallbackData ? 'exists' : 'null'} |
                      FB Error: {fallbackError || 'none'}
                    </div>
                    {data && (
                      <div>
                        Data keys: {Object.keys(data).join(', ')}
                        {data.kpis && ` | KPI keys: ${Object.keys(data.kpis).join(', ')}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={() => {
                // Navigate with current filter parameters
                const params = new URLSearchParams();
                if (selectedProduct && selectedProduct !== 'all-projects') {
                  params.set('productId', selectedProduct);
                }
                if (selectedSprint && selectedSprint !== 'all-sprints') {
                  params.set('sprintId', selectedSprint);
                }
                const queryString = params.toString();
                const targetUrl = queryString ? `/individual?${queryString}` : '/individual';
                window.location.href = targetUrl;
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Individual Performance →
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Task Distribution & Bug Classification Section */}
      <TaskDistributionDashboard 
        productId={selectedProduct !== 'all-projects' ? selectedProduct : null}
        iterationPath={selectedSprint !== 'all-sprints' ? selectedSprint : null}
        className="mb-6"
      />
    </div>
  );
};

export default Dashboard;