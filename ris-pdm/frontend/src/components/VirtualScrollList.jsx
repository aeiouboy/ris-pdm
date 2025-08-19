/**
 * Virtual Scrolling Component for Large Datasets
 * Optimizes rendering performance by only rendering visible items
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const VirtualScrollList = React.memo(({
  items = [],
  itemHeight = 60,
  containerHeight = 400,
  renderItem,
  overscan = 5,
  className = '',
  loading = false,
  loadingComponent = null,
  emptyComponent = null,
  onScroll,
  scrollToIndex = null,
  getItemKey = (item, index) => index
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    if (!items.length) return { start: 0, end: 0, visibleItems: [] };

    const containerViewHeight = containerHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerViewHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(start, end + 1).map((item, index) => ({
      item,
      index: start + index,
      key: getItemKey(item, start + index)
    }));

    return { start, end, visibleItems };
  }, [items, scrollTop, itemHeight, containerHeight, overscan, getItemKey]);

  // Calculate total height and offset
  const totalHeight = useMemo(() => items.length * itemHeight, [items.length, itemHeight]);
  const offsetY = visibleRange.start * itemHeight;

  // Handle scroll events with throttling
  const handleScroll = useCallback((event) => {
    const newScrollTop = event.target.scrollTop;
    setScrollTop(newScrollTop);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounced onScroll callback
    if (onScroll) {
      scrollTimeoutRef.current = setTimeout(() => {
        onScroll({
          scrollTop: newScrollTop,
          scrollDirection: newScrollTop > scrollTop ? 'down' : 'up',
          visibleStartIndex: visibleRange.start,
          visibleEndIndex: visibleRange.end
        });
      }, 100);
    }
  }, [scrollTop, onScroll, visibleRange]);

  // Scroll to specific index
  const scrollToIndexPosition = useCallback((index) => {
    if (containerRef.current && index >= 0 && index < items.length) {
      const targetScrollTop = index * itemHeight;
      containerRef.current.scrollTop = targetScrollTop;
      setScrollTop(targetScrollTop);
    }
  }, [items.length, itemHeight]);

  // Effect for external scroll to index
  useEffect(() => {
    if (scrollToIndex !== null && scrollToIndex !== undefined) {
      scrollToIndexPosition(scrollToIndex);
    }
  }, [scrollToIndex, scrollToIndexPosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Loading state
  if (loading && loadingComponent) {
    return (
      <div className={`relative ${className}`} style={{ height: containerHeight }}>
        {loadingComponent}
      </div>
    );
  }

  if (loading && !loadingComponent) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={{ height: containerHeight }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  // Empty state
  if (!items.length && emptyComponent) {
    return (
      <div className={`relative ${className}`} style={{ height: containerHeight }}>
        {emptyComponent}
      </div>
    );
  }

  if (!items.length && !emptyComponent) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={{ height: containerHeight }}>
        <div className="text-gray-500">No items found</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Total height container to maintain scrollbar */}
      <div style={{ height: totalHeight, width: '100%' }}>
        {/* Visible items container */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'relative'
          }}
        >
          {visibleRange.visibleItems.map(({ item, index, key }) => (
            <div
              key={key}
              style={{
                height: itemHeight,
                position: 'relative'
              }}
              data-index={index}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicators */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded opacity-0 transition-opacity duration-200 pointer-events-none scroll-indicator">
        {visibleRange.start + 1}-{Math.min(visibleRange.end + 1, items.length)} of {items.length}
      </div>

      <style jsx>{`
        .scroll-indicator {
          opacity: 0;
        }
        
        .relative:hover .scroll-indicator,
        .relative:active .scroll-indicator {
          opacity: 1;
        }
      `}</style>
    </div>
  );
});

VirtualScrollList.displayName = 'VirtualScrollList';

// Higher-order component for easy integration with team member lists
export const VirtualTeamMemberList = React.memo(({
  members = [],
  onMemberClick,
  selectedMemberId,
  loading = false,
  containerHeight = 400,
  searchTerm = '',
  sortBy = 'workItemCount'
}) => {
  // Filter and sort members
  const processedMembers = useMemo(() => {
    let filtered = members;
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = members.filter(member => 
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.workItemTypes?.some(type => type.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'completionRate':
          return (b.completionRate || 0) - (a.completionRate || 0);
        case 'storyPoints':
          return (b.storyPoints || 0) - (a.storyPoints || 0);
        case 'workItemCount':
        default:
          return (b.workItemCount || 0) - (a.workItemCount || 0);
      }
    });
    
    return filtered;
  }, [members, searchTerm, sortBy]);

  // Render individual member item
  const renderMemberItem = useCallback((member, index) => {
    const isSelected = selectedMemberId === member.email;
    
    return (
      <div
        className={`flex items-center p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50 border-blue-200' : ''
        }`}
        onClick={() => onMemberClick?.(member)}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mr-4">
          {member.avatar ? (
            <img
              className="h-10 w-10 rounded-full"
              src={member.avatar}
              alt={member.name}
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </span>
            </div>
          )}
        </div>
        
        {/* Member Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 truncate">
              {member.name}
            </p>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {member.workItemCount || 0} items
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-500 truncate">
              {member.email}
            </p>
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span>
                {member.storyPoints || 0} pts
              </span>
              <span className={`font-medium ${
                (member.completionRate || 0) >= 80 ? 'text-green-600' :
                (member.completionRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {member.completionRate || 0}% done
              </span>
            </div>
          </div>
          {member.workItemTypes && member.workItemTypes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {member.workItemTypes.slice(0, 3).map(type => (
                <span
                  key={type}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {type}
                </span>
              ))}
              {member.workItemTypes.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{member.workItemTypes.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [selectedMemberId, onMemberClick]);

  // Loading component
  const loadingComponent = useMemo(() => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-2 text-gray-600">Loading team members...</span>
    </div>
  ), []);

  // Empty component
  const emptyComponent = useMemo(() => (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
      <p className="text-lg font-medium mb-2">No team members found</p>
      <p className="text-sm">
        {searchTerm ? `No members match "${searchTerm}"` : 'No members available'}
      </p>
    </div>
  ), [searchTerm]);

  return (
    <VirtualScrollList
      items={processedMembers}
      itemHeight={84} // Adjusted for member item height
      containerHeight={containerHeight}
      renderItem={renderMemberItem}
      loading={loading}
      loadingComponent={loadingComponent}
      emptyComponent={emptyComponent}
      getItemKey={(member) => member.email}
      className="border border-gray-200 rounded-lg"
      overscan={3}
    />
  );
});

VirtualTeamMemberList.displayName = 'VirtualTeamMemberList';

export default VirtualScrollList;