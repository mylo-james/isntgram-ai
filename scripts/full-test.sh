#!/bin/bash

# Comprehensive test script that runs all tests
# This includes unit tests, integration tests, and e2e tests

set -e

echo "🧪 Running comprehensive test suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Run linting and type checking
echo "📋 Step 1: Running linting and type checking..."
npm run lint
npm run type-check
print_status "Linting and type checking passed"

# Step 2: Run unit tests (no database needed)
echo "🧪 Step 2: Running unit tests..."
npm run test:unit
print_status "Unit tests passed"

# Step 3: Check if Docker is available for integration tests
if docker info > /dev/null 2>&1; then
    echo "🐳 Step 3: Running integration tests with database..."
    
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
        print_status "Database is ready!"
    fi
    
    # Set test environment variables
    export NODE_ENV=test
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_USERNAME=postgres
    export DB_PASSWORD=password
    export DB_NAME=isntgram_test
    
    # Run integration tests
    npm run test:integration
    print_status "Integration tests passed"
else
    print_warning "Docker not available, skipping integration tests"
    print_warning "Run 'pnpm run test:with-db' to run integration tests with database"
fi

# Step 4: Run E2E tests
echo "🌐 Step 4: Running E2E tests..."
npm run test:e2e
print_status "E2E tests passed"

echo ""
print_status "🎉 All tests completed successfully!"
echo ""
echo "📊 Test Summary:"
echo "  ✅ Linting and type checking"
echo "  ✅ Unit tests"
if docker info > /dev/null 2>&1; then
    echo "  ✅ Integration tests (with database)"
else
    echo "  ⚠️  Integration tests (skipped - no Docker)"
fi
echo "  ✅ E2E tests"
