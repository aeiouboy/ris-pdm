import React, { useState } from 'react';
import { saveAs } from 'file-saver';

const ExportButtons = ({ 
  exportType = 'dashboard', 
  userId = null, 
  period = 'sprint', 
  startDate = null, 
  endDate = null,
  className = '',
  size = 'default'
}) => {
  const [isExporting, setIsExporting] = useState({
    pdf: false,
    excel: false
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params.toString();
  };

  const handleExport = async (format) => {
    setIsExporting(prev => ({ ...prev, [format]: true }));
    
    try {
      const queryParams = buildQueryParams();
      let endpoint = '';
      let filename = '';

      // Build endpoint based on export type
      if (exportType === 'dashboard') {
        endpoint = `/api/exports/dashboard/${format}`;
        filename = `ris-dashboard-${period}-${new Date().toISOString().split('T')[0]}`;
      } else if (exportType === 'individual' && userId) {
        const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_.]/g, '-');
        endpoint = `/api/exports/individual/${encodeURIComponent(userId)}/${format}`;
        filename = `ris-individual-${sanitizedUserId}-${period}-${new Date().toISOString().split('T')[0]}`;
      } else if (exportType === 'team-data') {
        endpoint = `/api/exports/team-data/${format}`;
        filename = `ris-team-data-${period}-${new Date().toISOString().split('T')[0]}`;
      }

      const baseUrl = process.env.REACT_APP_API_URL || '';
      const url = `${baseUrl}${endpoint}${queryParams ? '?' + queryParams : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
          'Accept': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
      saveAs(blob, `${filename}.${fileExtension}`);

    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      alert(`Failed to export ${format.toUpperCase()}: ${error.message}`);
    } finally {
      setIsExporting(prev => ({ ...prev, [format]: false }));
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center border border-gray-300 rounded-md font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200';
    
    if (size === 'small') {
      return `${baseClasses} px-3 py-1.5 text-sm`;
    }
    if (size === 'large') {
      return `${baseClasses} px-6 py-3 text-base`;
    }
    return `${baseClasses} px-4 py-2 text-sm`;
  };

  const getIconClasses = () => {
    return size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
  };

  return (
    <div className={`flex space-x-3 ${className}`}>
      {/* PDF Export Button */}
      <button
        onClick={() => handleExport('pdf')}
        disabled={isExporting.pdf}
        className={`${getButtonClasses()} ${isExporting.pdf ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Export as PDF"
      >
        {isExporting.pdf ? (
          <svg className={`${getIconClasses()} mr-2 animate-spin`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className={`${getIconClasses()} mr-2 text-red-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
        {isExporting.pdf ? 'Exporting...' : 'Export PDF'}
      </button>

      {/* Excel Export Button */}
      <button
        onClick={() => handleExport('excel')}
        disabled={isExporting.excel}
        className={`${getButtonClasses()} ${isExporting.excel ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Export as Excel"
      >
        {isExporting.excel ? (
          <svg className={`${getIconClasses()} mr-2 animate-spin`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className={`${getIconClasses()} mr-2 text-green-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        {isExporting.excel ? 'Exporting...' : 'Export Excel'}
      </button>
    </div>
  );
};

export default ExportButtons;