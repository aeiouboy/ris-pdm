import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const useSwipeNavigation = ({ 
  enabled = true, 
  threshold = 100, 
  velocity = 0.3,
  preventScroll = false 
} = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  // Define the navigation routes in order
  const routes = [
    { path: '/', name: 'Dashboard' },
    { path: '/individual', name: 'Team Performance' },
    { path: '/reports', name: 'Reports' }
  ];

  const getCurrentIndex = () => {
    const currentPath = location.pathname;
    let index = routes.findIndex(route => {
      if (route.path === '/') {
        return currentPath === '/';
      }
      return currentPath.startsWith(route.path);
    });
    return index === -1 ? 0 : index;
  };

  const navigateToIndex = (index) => {
    if (index >= 0 && index < routes.length) {
      navigate(routes[index].path);
    }
  };

  const handleTouchStart = (e) => {
    if (!enabled) return;
    
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    touchEndRef.current = null;
    setIsSwipeActive(true);
    setSwipeDirection(null);
  };

  const handleTouchMove = (e) => {
    if (!enabled || !touchStartRef.current) return;

    const currentTouch = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };

    const deltaX = currentTouch.x - touchStartRef.current.x;
    const deltaY = Math.abs(currentTouch.y - touchStartRef.current.y);

    // Determine swipe direction
    if (Math.abs(deltaX) > 50 && deltaY < 100) {
      const direction = deltaX > 0 ? 'right' : 'left';
      setSwipeDirection(direction);

      // Prevent scrolling if this is a horizontal swipe
      if (preventScroll && Math.abs(deltaX) > deltaY) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!enabled || !touchStartRef.current) return;

    touchEndRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = Math.abs(touchEndRef.current.y - touchStartRef.current.y);
    const deltaTime = touchEndRef.current.time - touchStartRef.current.time;
    const currentVelocity = Math.abs(deltaX) / deltaTime;

    // Check if it's a valid horizontal swipe
    const isHorizontalSwipe = Math.abs(deltaX) > threshold && 
                             deltaY < 150 && 
                             currentVelocity > velocity;

    if (isHorizontalSwipe) {
      const currentIndex = getCurrentIndex();
      
      if (deltaX > 0) {
        // Swipe right - go to previous page
        const prevIndex = currentIndex - 1;
        navigateToIndex(prevIndex);
      } else {
        // Swipe left - go to next page
        const nextIndex = currentIndex + 1;
        navigateToIndex(nextIndex);
      }
    }

    // Reset state
    setIsSwipeActive(false);
    setSwipeDirection(null);
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  const bindSwipeHandlers = (element) => {
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  };

  // Navigation helpers
  const goToNext = () => {
    const currentIndex = getCurrentIndex();
    navigateToIndex(currentIndex + 1);
  };

  const goToPrev = () => {
    const currentIndex = getCurrentIndex();
    navigateToIndex(currentIndex - 1);
  };

  const canGoNext = () => {
    const currentIndex = getCurrentIndex();
    return currentIndex < routes.length - 1;
  };

  const canGoPrev = () => {
    const currentIndex = getCurrentIndex();
    return currentIndex > 0;
  };

  return {
    // Binding function for elements
    bindSwipeHandlers,
    
    // Navigation state
    isSwipeActive,
    swipeDirection,
    currentIndex: getCurrentIndex(),
    currentRoute: routes[getCurrentIndex()],
    routes,
    
    // Navigation functions
    goToNext,
    goToPrev,
    canGoNext: canGoNext(),
    canGoPrev: canGoPrev(),
    navigateToIndex,
    
    // Configuration
    enabled,
    threshold,
    velocity
  };
};

// Higher-order component for automatic swipe binding
export const withSwipeNavigation = (WrappedComponent, swipeOptions = {}) => {
  return function SwipeNavigationComponent(props) {
    const elementRef = useRef(null);
    const { bindSwipeHandlers, ...swipeProps } = useSwipeNavigation(swipeOptions);

    useEffect(() => {
      const element = elementRef.current;
      if (element) {
        const cleanup = bindSwipeHandlers(element);
        return cleanup;
      }
    }, [bindSwipeHandlers]);

    return (
      <div ref={elementRef} style={{ touchAction: 'pan-y' }}>
        <WrappedComponent {...props} swipeNavigation={swipeProps} />
      </div>
    );
  };
};

export default useSwipeNavigation;