import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const SprintFilter = ({ selectedSprint, onSprintChange, sprints = [], className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiSprints, setApiSprints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const hasFetchedRef = useRef(false);

  // Fallback sprints if API fails
  const fallbackSprints = [
    { id: 'current', name: 'Current Sprint', description: 'Current Sprint', status: 'active', startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: 'all-sprints', name: 'All Sprints', description: 'All time view', status: 'all', startDate: null, endDate: null }
  ];

  // Fetch sprints from API on component mount
  useEffect(() => {
    const fetchSprints = async () => {
      // Skip API call if sprints are provided as props
      if (sprints && sprints.length > 0) {
        setApiSprints(sprints);
        hasFetchedRef.current = true;
        return;
      }

      // Skip if already fetched or currently loading
      if (hasFetchedRef.current || loading) {
        return;
      }

      hasFetchedRef.current = true;
      setLoading(true);
      setError(null);

      try {
        console.log('🔄 Fetching sprints from API...');
        const response = await axios.get('/api/metrics/sprints', {
          timeout: 8000, // Reduced from 10 seconds to 8 seconds
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.data && response.data.success && response.data.data) {
          console.log('✅ Successfully fetched sprints:', response.data.data);
          setApiSprints(response.data.data);
        } else {
          console.warn('⚠️ Invalid sprint response structure:', response.data);
          setApiSprints(fallbackSprints);
        }
      } catch (err) {
        console.error('❌ Error fetching sprints:', err);
        setError(err.message);
        setApiSprints(fallbackSprints);
      } finally {
        setLoading(false);
      }
    };

    fetchSprints();
  }, [sprints]);

  // Use API sprints if available, otherwise use provided sprints or fallback
  const sprintList = apiSprints.length > 0 ? apiSprints : (sprints.length > 0 ? sprints : fallbackSprints);
  const currentSprint = sprintList.find(s => s.id === selectedSprint) || sprintList[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSprintSelect = (sprint) => {
    onSprintChange(sprint.id);
    setIsOpen(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-600';
      case 'completed':
        return 'bg-gray-100 text-gray-600';
      case 'all':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return '🟢';
      case 'completed':
        return '✅';
      case 'all':
        return '📊';
      default:
        return '⚪';
    }
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Sprint {loading && <span className="text-xs text-gray-500">(Loading...)</span>}
        {error && <span className="text-xs text-red-500">(Using fallback data)</span>}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-50 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            {loading ? (
              <div className="flex-shrink-0 w-6 h-6 mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium mr-3 ${getStatusColor(currentSprint.status)}`}>
                {getStatusIcon(currentSprint.status)} {currentSprint.status.charAt(0).toUpperCase() + currentSprint.status.slice(1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {loading ? 'Loading sprints...' : currentSprint.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {loading ? 'Fetching from Azure DevOps' :
                 (currentSprint.startDate && currentSprint.endDate ? 
                  formatDateRange(currentSprint.startDate, currentSprint.endDate) : 
                  currentSprint.description)
                }
              </div>
            </div>
          </div>
          <svg
            className={`ml-2 h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {sprintList.map((sprint) => (
              <li
                key={sprint.id}
                onClick={() => handleSprintSelect(sprint)}
                className={`cursor-pointer select-none px-3 py-3 hover:bg-gray-100 ${
                  selectedSprint === sprint.id ? 'bg-blue-50' : ''
                }`}
                role="option"
                aria-selected={selectedSprint === sprint.id}
              >
                <div className="flex items-center">
                  <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium mr-3 ${getStatusColor(sprint.status)}`}>
                    {getStatusIcon(sprint.status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {sprint.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {sprint.startDate && sprint.endDate ? 
                        formatDateRange(sprint.startDate, sprint.endDate) : 
                        sprint.description
                      }
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
                    </div>
                  </div>
                  {selectedSprint === sprint.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SprintFilter;