import React, { useState, useRef, useEffect } from 'react';

const DateRangePicker = ({ startDate, endDate, onDateRangeChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const [tempStartDate, setTempStartDate] = useState(startDate || '');
  const [tempEndDate, setTempEndDate] = useState(endDate || '');
  const dropdownRef = useRef(null);

  // Quick filter options
  const quickFilters = [
    { id: 'last-7', label: 'Last 7 days', days: 7 },
    { id: 'last-30', label: 'Last 30 days', days: 30 },
    { id: 'last-90', label: 'Last 90 days', days: 90 },
    { id: 'this-quarter', label: 'This Quarter', special: 'quarter' },
    { id: 'this-year', label: 'This Year', special: 'year' },
    { id: 'custom', label: 'Custom Range', special: 'custom' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveInput(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync external props with internal state
  useEffect(() => {
    setTempStartDate(startDate || '');
    setTempEndDate(endDate || '');
  }, [startDate, endDate]);

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getDateRangeText = () => {
    if (!tempStartDate && !tempEndDate) return 'Select date range';
    if (!tempStartDate) return `Until ${formatDateForDisplay(tempEndDate)}`;
    if (!tempEndDate) return `From ${formatDateForDisplay(tempStartDate)}`;
    return `${formatDateForDisplay(tempStartDate)} - ${formatDateForDisplay(tempEndDate)}`;
  };

  const handleQuickFilter = (filter) => {
    const now = new Date();
    let newStartDate, newEndDate;

    if (filter.days) {
      newEndDate = now.toISOString().split('T')[0];
      newStartDate = new Date(now.setDate(now.getDate() - filter.days)).toISOString().split('T')[0];
    } else if (filter.special === 'quarter') {
      const quarter = Math.floor((now.getMonth() + 3) / 3);
      newStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1).toISOString().split('T')[0];
      newEndDate = new Date(now.getFullYear(), quarter * 3, 0).toISOString().split('T')[0];
    } else if (filter.special === 'year') {
      newStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      newEndDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    } else if (filter.special === 'custom') {
      // Keep current dates for custom
      newStartDate = tempStartDate;
      newEndDate = tempEndDate;
    }

    setTempStartDate(newStartDate);
    setTempEndDate(newEndDate);

    if (filter.special !== 'custom') {
      onDateRangeChange(newStartDate, newEndDate);
      setIsOpen(false);
    }
  };

  const handleApply = () => {
    onDateRangeChange(tempStartDate, tempEndDate);
    setIsOpen(false);
  };

  const handleReset = () => {
    setTempStartDate('');
    setTempEndDate('');
    onDateRangeChange('', '');
  };

  const getCurrentFilter = () => {
    if (!tempStartDate && !tempEndDate) return null;
    
    const now = new Date();
    const start = tempStartDate ? new Date(tempStartDate) : null;
    const end = tempEndDate ? new Date(tempEndDate) : null;

    // Check if matches any quick filter
    for (const filter of quickFilters) {
      if (filter.days) {
        const expectedEnd = now.toISOString().split('T')[0];
        const expectedStart = new Date(now.setDate(now.getDate() - filter.days)).toISOString().split('T')[0];
        if (tempStartDate === expectedStart && tempEndDate === expectedEnd) {
          return filter;
        }
      }
    }
    return quickFilters.find(f => f.special === 'custom');
  };

  const currentFilter = getCurrentFilter();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Date Range
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
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {getDateRangeText()}
              </div>
              {currentFilter && (
                <div className="text-xs text-gray-500 truncate">
                  {currentFilter.label}
                </div>
              )}
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
          <div className="p-4">
            {/* Quick Filters */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Quick Filters</div>
              <div className="grid grid-cols-2 gap-2">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleQuickFilter(filter)}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      currentFilter?.id === filter.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="border-t pt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Custom Range</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From</label>
                  <input
                    type="date"
                    value={formatDateForInput(tempStartDate)}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    onFocus={() => setActiveInput('start')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={formatDateForInput(tempEndDate)}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    onFocus={() => setActiveInput('end')}
                    min={tempStartDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <button
                onClick={handleReset}
                className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;