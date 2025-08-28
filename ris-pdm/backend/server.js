const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { 
  azureDevOpsLogger, 
  azureDevOpsHealthMonitor, 
  azureDevOpsErrorLogger,
  systemResourceMonitor 
} = require('./middleware/apiLogger');

// Import routes
const productRoutes = require('./routes/products');
const metricRoutes = require('./routes/metrics');
const userRoutes = require('./routes/users');
const workItemRoutes = require('./routes/workitems');
const exportRoutes = require('./routes/exports');

// Import services
const AzureDevOpsService = require('./src/services/azureDevOpsService');
const RealtimeService = require('./src/services/realtimeService');
const ProjectResolutionService = require('./src/services/projectResolutionService');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174'
    ],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;

// Initialize services with enhanced performance features
const azureDevOpsService = new AzureDevOpsService();
const projectResolutionService = new ProjectResolutionService(azureDevOpsService);
const RequestBatchingService = require('./src/services/requestBatchingService');
const cacheService = require('./src/services/cacheService');
const PerformanceMonitorService = require('./src/services/performanceMonitorService');
const { createOptimizedCompressionStack } = require('./middleware/compressionMiddleware');
// const { createPerformanceStack } = require('./middleware/performanceMiddleware');

// Initialize services
let requestBatchingService;
let performanceMonitor;

const initializeServices = async () => {
  try {
    // Initialize performance monitor first
    performanceMonitor = new PerformanceMonitorService();
    
    // Initialize cache service
    await cacheService.initialize();
    
    // Initialize Azure DevOps service with caching
    await azureDevOpsService.initialize();
    
    // Initialize project resolution service
    logger.info('🔧 Initializing project resolution service');
    
    // Initialize request batching service
    requestBatchingService = new RequestBatchingService(azureDevOpsService);
    
    // Set up performance monitoring events
    performanceMonitor.on('slowRequest', (metric) => {
      logger.warn(`🐌 Slow request detected: ${metric.requestId}`, {
        url: metric.metadata.url,
        duration: metric.duration
      });
    });
    
    performanceMonitor.on('highMemoryUsage', (metric) => {
      logger.warn(`⚠️ High memory usage: ${metric.utilization.heap.toFixed(2)}%`);
    });
    
    // Warm up cache with essential data
    setTimeout(async () => {
      try {
        await requestBatchingService.warmUpCache();
        logger.info('✅ Cache warmup completed');
      } catch (error) {
        logger.warn('Cache warmup failed:', error.message);
      }
    }, 2000); // Wait 2 seconds after server start
    
    logger.info('✅ All performance services initialized');
  } catch (error) {
    logger.warn('⚠️ Performance services initialization failed, using fallback:', error.message);
  }
};

const realtimeService = new RealtimeService(azureDevOpsService, io);

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('🚨 Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
  
  // Allow some time for logging, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
  
  // Allow some time for logging, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully');
  gracefulShutdown();
});

// gracefulShutdown function defined later in the file

// Rate limiting
// More generous rate limiting for dashboard application
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute windows
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, // 300 requests per minute (5 requests per second)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain conditions
  skip: (req, res) => {
    // Skip for health checks and static assets
    return req.path.includes('/health') || req.path.includes('/favicon');
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Enhanced compression and optimization middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Apply rate limiting to all requests
app.use('/api/', limiter);

// Apply Azure DevOps monitoring middleware
app.use('/api/', systemResourceMonitor);
app.use('/api/', azureDevOpsHealthMonitor);
app.use('/api/metrics', azureDevOpsLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    realtime: realtimeService.getServiceStats()
  };
  
  // Add performance metrics if available
  if (performanceMonitor) {
    const performanceHealth = performanceMonitor.getHealthCheck();
    healthData.performance = performanceHealth;
    
    // Set status based on performance health
    if (performanceHealth.status !== 'healthy') {
      healthData.status = 'DEGRADED';
    }
  }
  
  // Add cache health if available
  if (cacheService) {
    const cacheHealth = await cacheService.healthCheck();
    healthData.cache = cacheHealth;
  }
  
  const statusCode = healthData.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthData);
});

// Make services available to routes
app.set('socketio', io);
app.set('realtimeService', realtimeService);
app.set('cacheService', cacheService);
app.set('requestBatchingService', () => requestBatchingService);

// API Routes (protected by authentication middleware)
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/metrics', authMiddleware, metricRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/workitems', authMiddleware, workItemRoutes);
app.use('/api/exports', authMiddleware, exportRoutes);

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Azure DevOps specific error handler (before global error handler)
app.use(azureDevOpsErrorLogger);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Shutdown signal received. Cleaning up...');
  
  try {
    // Cleanup services
    realtimeService.cleanup();
    await cacheService.shutdown();
    
    if (performanceMonitor) {
      performanceMonitor.shutdown();
    }
    
    server.close(() => {
      logger.info('✅ Server shutdown complete');
      process.exit(0);
    });
    
    // Force exit if server doesn't close within 10 seconds
    setTimeout(() => {
      logger.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// WebSocket connection handling is managed by RealtimeService

// Start server
server.listen(PORT, async () => {
  logger.info(`🚀 RIS Performance Dashboard API server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`⚡ WebSocket server initialized`);
  
  // Initialize performance services after server start
  await initializeServices();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = { app, io, server };