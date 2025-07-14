# ==================================================
# Multi-stage Dockerfile for Korean E-commerce Core
# ==================================================

# Stage 1: Base Node.js image
FROM node:18-alpine AS base

# Install system dependencies for Korean locale and common tools
RUN apk add --no-cache \
    dumb-init \
    tzdata \
    curl \
    bash \
    postgresql-client \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone

# Set Korean locale environment
ENV TZ=Asia/Seoul
ENV LANG=ko_KR.UTF-8
ENV LC_ALL=ko_KR.UTF-8

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Stage 2: Dependencies
FROM base AS dependencies

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Build
FROM base AS build

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 4: Production
FROM base AS production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --omit=dev && npm cache clean --force

# Copy built application
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/config ./config
COPY --from=build --chown=nextjs:nodejs /app/database ./database

# Copy startup scripts
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./
COPY --chown=nextjs:nodejs scripts/health-check.sh ./

# Make scripts executable
RUN chmod +x docker-entrypoint.sh health-check.sh

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/tmp && \
    chown -R nextjs:nodejs /app/uploads /app/logs /app/tmp

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ./health-check.sh

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["./docker-entrypoint.sh"]

# Stage 5: Development
FROM base AS development

# Install all dependencies including dev dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Switch to non-root user
USER nextjs

# Expose port and debug port
EXPOSE 3000 9229

# Development command with hot reload
CMD ["npm", "run", "dev"]