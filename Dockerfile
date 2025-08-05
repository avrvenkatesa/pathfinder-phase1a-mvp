# Multi-stage build for production optimization
# Stage 1: Build dependencies and compile TypeScript
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Stage 2: Production runtime
FROM node:20-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Install production system dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy additional required files
COPY --chown=nextjs:nodejs server/docs ./server/docs
COPY --chown=nextjs:nodejs server/migrations ./server/migrations

# Create directories for logs and uploads
RUN mkdir -p logs uploads && \
    chown -R nextjs:nodejs logs uploads

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "dist/server/app.js"]

# Development stage for local development
FROM node:20-alpine AS development

WORKDIR /app

# Install all dependencies including dev
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]