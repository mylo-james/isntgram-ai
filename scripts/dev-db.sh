#!/bin/bash

# Start PostgreSQL database for local development
echo "Starting PostgreSQL database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start the database
docker-compose up -d postgres

# Wait for database to be ready
echo "Waiting for database to be ready..."
until docker-compose exec -T postgres pg_isready -U postgres -d isntgram; do
    echo "Database is not ready yet. Waiting..."
    sleep 2
done

echo "✅ Database is ready!"
echo "Database URL: postgresql://postgres:password@localhost:5432/isntgram"
echo ""
echo "To stop the database, run: docker-compose down"
echo "To view logs, run: docker-compose logs postgres"
