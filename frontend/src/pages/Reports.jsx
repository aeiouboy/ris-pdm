import React, { useState } from 'react';
import { ExportButtons } from '../components';

const Reports = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('sprint');
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
            <p className="text-gray-600">Generate and view detailed performance reports</p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="sprint">Current Sprint</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <ExportButtons 
              exportType="team-data"
              period={selectedPeriod}
              className="flex-shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Report Generation Section */}
      <div className="bg-white p-6 rounded-lg shadow-dashboard border mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              id="reportType"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select Report Type</option>
              <option value="monthly">Monthly Performance</option>
              <option value="quarterly">Quarterly Review</option>
              <option value="annual">Annual Summary</option>
              <option value="department">Department Comparison</option>
            </select>
          </div>
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              id="dateRange"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select Date Range</option>
              <option value="last30">Last 30 Days</option>
              <option value="last90">Last 90 Days</option>
              <option value="last180">Last 6 Months</option>
              <option value="last365">Last Year</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors">
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white rounded-lg shadow-dashboard border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Reports</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {/* Placeholder Report Items */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Monthly Performance Report - June 2024</h4>
                <p className="text-sm text-gray-600">Generated on July 1, 2024</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                  View
                </button>
                <button className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
                  Download
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">Quarterly Review - Q2 2024</h4>
                <p className="text-sm text-gray-600">Generated on July 5, 2024</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                  View
                </button>
                <button className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
                  Download
                </button>
              </div>
            </div>

            <div className="text-center py-8 text-gray-500">
              <p>More reports will be available once data integration is complete.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;