#!/bin/bash

# Script to run tests with database setup
# This is used for integration tests that need a database

set -e

echo "🧪 Running tests with database setup..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start database if not running
if ! docker-compose ps postgres | grep -q "Up"; then
    echo "📦 Starting PostgreSQL database..."
    docker-compose up -d postgres
    
    # Wait for database to be ready
    echo "⏳ Waiting for database to be ready..."
    until docker-compose exec -T postgres pg_isready -U postgres -d isntgram; do
        echo "Database is not ready yet. Waiting..."
        sleep 2
    done
    echo "✅ Database is ready!"
fi

# Set test environment variables
export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export DB_NAME=isntgram_test

# Run the specified test command
echo "🚀 Running tests..."
npm run test:api

echo "✅ Tests completed!"
