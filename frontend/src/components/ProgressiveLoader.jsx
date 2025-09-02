/**
 * Progressive Loading Component
 * Implements progressive enhancement and lazy loading for better performance
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// Intersection Observer hook for lazy loading
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [hasIntersected, options]);

  return { targetRef, isIntersecting, hasIntersected };
};

// Lazy loading wrapper component
export const LazySection = React.memo(({
  children,
  fallback = <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>,
  minHeight = 200,
  className = '',
  triggerDistance = '50px'
}) => {
  const { targetRef, hasIntersected } = useIntersectionObserver({
    rootMargin: triggerDistance
  });

  return (
    <div 
      ref={targetRef} 
      className={className}
      style={{ minHeight: hasIntersected ? 'auto' : minHeight }}
    >
      {hasIntersected ? children : fallback}
    </div>
  );
});

LazySection.displayName = 'LazySection';

// Progressive image loading component
export const ProgressiveImage = React.memo(({
  src,
  placeholder,
  alt = '',
  className = '',
  onLoad,
  onError,
  ...props
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { targetRef, hasIntersected } = useIntersectionObserver();

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setImageError(true);
    onError?.();
  }, [onError]);

  return (
    <div ref={targetRef} className={`relative overflow-hidden ${className}`} {...props}>
      {/* Placeholder */}
      {(!hasIntersected || (!imageLoaded && !imageError)) && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          {placeholder || (
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}
      
      {/* Actual image */}
      {hasIntersected && !imageError && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
      
      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-gray-500">Failed to load</p>
          </div>
        </div>
      )}
    </div>
  );
});

ProgressiveImage.displayName = 'ProgressiveImage';

// Progressive chart loading with skeleton
export const ProgressiveChart = React.memo(({
  chartComponent: ChartComponent,
  data,
  loading = false,
  error = null,
  height = 300,
  className = '',
  skeletonLines = 4,
  retryButton = true,
  onRetry,
  ...chartProps
}) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const { targetRef, hasIntersected } = useIntersectionObserver();

  // Trigger loading when component becomes visible
  useEffect(() => {
    if (hasIntersected && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [hasIntersected, shouldLoad]);

  // Skeleton loader
  const SkeletonChart = useMemo(() => (
    <div className="animate-pulse space-y-4" style={{ height }}>
      <div className="flex justify-between items-center">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/6"></div>
      </div>
      <div className="space-y-3" style={{ height: height - 50 }}>
        {Array.from({ length: skeletonLines }).map((_, index) => (
          <div key={index} className="flex items-end space-x-2 h-full">
            {Array.from({ length: 8 }).map((_, barIndex) => (
              <div
                key={barIndex}
                className="bg-gray-200 rounded-t flex-1"
                style={{
                  height: `${Math.random() * 70 + 30}%`,
                  animationDelay: `${(index * 8 + barIndex) * 0.1}s`
                }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  ), [height, skeletonLines]);

  return (
    <div ref={targetRef} className={`bg-white p-6 rounded-lg shadow-dashboard border ${className}`}>
      {/* Loading skeleton */}
      {!hasIntersected || (loading && !data) ? (
        SkeletonChart
      ) : error ? (
        /* Error state */
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 mb-4 text-center">Failed to load chart data</p>
          {retryButton && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        /* Actual chart */
        <ChartComponent data={data} height={height} {...chartProps} />
      )}
    </div>
  );
});

ProgressiveChart.displayName = 'ProgressiveChart';

// Progressive data loader with retry logic
export const ProgressiveDataLoader = React.memo(({
  loadData,
  dependencies = [],
  children,
  fallback,
  errorComponent,
  retryDelay = 1000,
  maxRetries = 3,
  cacheKey
}) => {
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null,
    retryCount: 0
  });
  
  const cacheRef = useRef(new Map());
  const retryTimeoutRef = useRef(null);

  // Load data with caching and retry logic
  const fetchData = useCallback(async () => {
    // Check cache first
    if (cacheKey && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000; // 5 minutes
      
      if (!isExpired) {
        setState(prev => ({ ...prev, data: cached.data, loading: false, error: null }));
        return;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await loadData();
      
      // Cache the result
      if (cacheKey) {
        cacheRef.current.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      
      setState(prev => ({ 
        ...prev, 
        data, 
        loading: false, 
        error: null, 
        retryCount: 0 
      }));
    } catch (error) {
      console.error('Data loading failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Failed to load data',
        retryCount: prev.retryCount + 1
      }));

      // Auto-retry with exponential backoff
      if (state.retryCount < maxRetries) {
        const delay = retryDelay * Math.pow(2, state.retryCount);
        retryTimeoutRef.current = setTimeout(() => {
          fetchData();
        }, delay);
      }
    }
  }, [loadData, cacheKey, retryDelay, maxRetries, state.retryCount]);

  // Trigger data loading when dependencies change
  useEffect(() => {
    fetchData();
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, dependencies);

  // Manual retry function
  const handleRetry = useCallback(() => {
    setState(prev => ({ ...prev, retryCount: 0 }));
    fetchData();
  }, [fetchData]);

  // Render based on state
  if (state.loading && !state.data) {
    return fallback || <div className="animate-pulse h-64 bg-gray-200 rounded-lg"></div>;
  }

  if (state.error && !state.data) {
    return errorComponent ? (
      React.cloneElement(errorComponent, { error: state.error, onRetry: handleRetry })
    ) : (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium mb-2">Error loading data</p>
        <p className="text-sm mb-4">{state.error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry ({state.retryCount}/{maxRetries})
        </button>
      </div>
    );
  }

  return children(state.data, { loading: state.loading, error: state.error, retry: handleRetry });
});

ProgressiveDataLoader.displayName = 'ProgressiveDataLoader';

// Performance monitoring hook
export const usePerformanceMonitor = (componentName) => {
  const renderStartTime = useRef(Date.now());
  const [performanceMetrics, setPerformanceMetrics] = useState(null);

  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    
    setPerformanceMetrics({
      componentName,
      renderTime,
      timestamp: new Date().toISOString()
    });

    // Log performance in development
    if (process.env.NODE_ENV === 'development' && renderTime > 100) {
      console.warn(`🐌 Slow render detected: ${componentName} took ${renderTime}ms`);
    }
  }, [componentName]);

  return performanceMetrics;
};

export default {
  LazySection,
  ProgressiveImage,
  ProgressiveChart,
  ProgressiveDataLoader,
  usePerformanceMonitor
};