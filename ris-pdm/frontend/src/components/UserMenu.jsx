import React, { useState, useRef, useEffect } from 'react';

const UserMenu = ({ user, onSettingsClick, onProfileClick, onLogout, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Default user if none provided
  const defaultUser = {
    name: 'John Doe',
    email: 'john.doe@company.com',
    role: 'Product Manager',
    avatar: null,
    initials: 'JD'
  };

  const currentUser = user || defaultUser;
  const userInitials = currentUser.initials || currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();

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

  const menuItems = [
    {
      id: 'profile',
      label: 'Your Profile',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: onProfileClick,
      divider: false
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      onClick: onSettingsClick,
      divider: false
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-3.5-3.5a1.5 1.5 0 010-2.12L20 8h-5a1 1 0 01-1-1V3a1 1 0 00-1-1H4a2 2 0 00-2 2v14a2 2 0 002 2h10z" />
        </svg>
      ),
      onClick: () => console.log('Notifications clicked'),
      divider: false
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => window.open('https://docs.company.com/help', '_blank'),
      divider: true
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      onClick: onLogout,
      divider: false,
      danger: true
    }
  ];

  const handleMenuItemClick = (item) => {
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {/* User Avatar */}
        <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-medium">
              {userInitials}
            </span>
          )}
        </div>
        
        {/* User Info - Hidden on mobile */}
        <div className="hidden sm:block text-left min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {currentUser.name}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {currentUser.role}
          </div>
        </div>
        
        {/* Dropdown Arrow */}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary-500 rounded-full flex items-center justify-center">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-base font-medium">
                    {userInitials}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {currentUser.name}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {currentUser.email}
                </div>
                <div className="text-xs text-gray-400">
                  {currentUser.role}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {item.divider && index > 0 && (
                  <div className="border-t border-gray-200 my-1" />
                )}
                <button
                  onClick={() => handleMenuItemClick(item)}
                  className={`w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    item.danger ? 'text-red-600 hover:text-red-700' : 'text-gray-700'
                  }`}
                >
                  <span className={`mr-3 ${item.danger ? 'text-red-500' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">
              Performance Dashboard v2.0
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;