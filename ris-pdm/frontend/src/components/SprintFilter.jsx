import React, { useState, useRef, useEffect } from 'react';

const SprintFilter = ({ selectedSprint, onSprintChange, sprints = [], className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Default sprints if none provided
  const defaultSprints = [
    { id: 'current', name: 'Sprint 23', description: 'Current Sprint', status: 'active', startDate: '2025-07-15', endDate: '2025-07-28' },
    { id: 'sprint-22', name: 'Sprint 22', description: 'Previous Sprint', status: 'completed', startDate: '2025-07-01', endDate: '2025-07-14' },
    { id: 'sprint-21', name: 'Sprint 21', description: '2 Sprints Ago', status: 'completed', startDate: '2025-06-17', endDate: '2025-06-30' },
    { id: 'sprint-20', name: 'Sprint 20', description: '3 Sprints Ago', status: 'completed', startDate: '2025-06-03', endDate: '2025-06-16' },
    { id: 'all-sprints', name: 'All Sprints', description: 'All time view', status: 'all' }
  ];

  const sprintList = sprints.length > 0 ? sprints : defaultSprints;
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
        Sprint
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium mr-3 ${getStatusColor(currentSprint.status)}`}>
              {getStatusIcon(currentSprint.status)} {currentSprint.status.charAt(0).toUpperCase() + currentSprint.status.slice(1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {currentSprint.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {currentSprint.startDate && currentSprint.endDate ? 
                  formatDateRange(currentSprint.startDate, currentSprint.endDate) : 
                  currentSprint.description
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