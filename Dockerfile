# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Disable Husky during Docker builds
ENV HUSKY=0

# Install system dependencies including PostgreSQL
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql \
    postgresql-client \
    curl

# Copy package manifests (preserve workspace structure)
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/shared-types/package*.json packages/shared-types/

# Install all dependencies (including dev dependencies for testing)
RUN npm ci

# Install CLI tools globally (optional for build)
RUN npm install -g @nestjs/cli next

# Copy source code
COPY . .

# Build applications
RUN npm run build

# Initialize PostgreSQL for development
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql/data && \
    su postgres -c "initdb -D /var/lib/postgresql/data" && \
    echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf && \
    echo "listen_addresses='*'" >> /var/lib/postgresql/data/postgresql.conf

# Create startup script for development environment
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'su postgres -c "pg_ctl -D /var/lib/postgresql/data -l logfile start"' >> /start.sh && \
    echo 'sleep 3' >> /start.sh && \
    echo 'su postgres -c "createdb isntgram"' >> /start.sh && \
    echo 'npm run start:dev' >> /start.sh && \
    chmod +x /start.sh

# Expose ports
EXPOSE 3000 3001 5432

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application in development mode
CMD ["/start.sh"]
