import React from 'react';
import { RealtimeStatusDot } from './RealtimeStatus';
import ProjectLogo from './ProjectLogo';

const Header = ({ onMobileMenuToggle }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Open sidebar"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo and title */}
        <div className="flex items-center">
          <div className="flex-shrink-0 md:hidden">
            <ProjectLogo size="sm" showText={true} />
          </div>
        </div>

        {/* Right side - User menu and notifications */}
        <div className="flex items-center space-x-4">
          {/* Real-time status indicator */}
          <RealtimeStatusDot className="hidden sm:block" />
          
          {/* Notifications */}
          <button className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-3.5-3.5a1.5 1.5 0 0 0-1.06-.44H13a1.5 1.5 0 0 0-1.06.44L8.5 17H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2z" />
            </svg>
          </button>

          {/* User menu */}
          <div className="relative">
            <button className="flex items-center space-x-2 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
              <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
              <span className="hidden sm:block text-sm font-medium">User</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;