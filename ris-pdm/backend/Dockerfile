# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc* ./

# Install dependencies with production optimizations
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev-deps
RUN npm ci

# Build stage (if needed for any build processes)
FROM dev-deps AS build
COPY . .
RUN npm run build 2>/dev/null || echo "No build step required"

# Production stage
FROM base AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Remove development files
RUN rm -rf tests/ coverage/ *.test.js *.spec.js

# Security: Remove npm and package manager
RUN npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Labels for metadata
LABEL maintainer="RIS Product Team"
LABEL version="1.0.0"
LABEL description="RIS Performance Dashboard Backend API"
LABEL org.opencontainers.image.source="https://github.com/ris-product/performance-dashboard"