# Use Node.js 18 LTS as base image
FROM node:18-alpine as base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Make the CLI executable
RUN chmod +x bin/lucai.js

# Development stage
FROM base as development
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

# Production stage
FROM base as production
# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S lucai -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R lucai:nodejs /app
USER lucai

# Create volume for persistent data
VOLUME ["/app/data"]

# Set environment variables
ENV NODE_ENV=production
ENV LUCAI_DATA_DIR=/app/data

# Expose port (if needed for future web interface)
EXPOSE 3000

# Default command
ENTRYPOINT ["node", "bin/lucai.js"]
CMD ["--help"]
