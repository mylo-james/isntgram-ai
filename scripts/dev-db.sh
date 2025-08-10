#!/bin/bash

# Start PostgreSQL database for local development (supports docker compose v1 and v2)
set -e

echo "Starting PostgreSQL database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

# Detect compose command
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "Error: Neither docker-compose nor 'docker compose' is available."
  echo "- On macOS, install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/"
  echo "- Or install docker-compose plugin: brew install docker-compose"
  exit 1
fi

# Start the database
eval "$COMPOSE_CMD up -d postgres"

# Wait for database to be ready
echo "Waiting for database to be ready..."
until eval "$COMPOSE_CMD exec -T postgres pg_isready -U postgres -d isntgram" >/dev/null 2>&1; do
  echo "Database is not ready yet. Waiting..."
  sleep 2
done

echo "✅ Database is ready!"
echo "Database URL: postgresql://postgres:password@localhost:5432/isntgram"
echo ""
echo "To stop the database, run: $COMPOSE_CMD down"
echo "To view logs, run: $COMPOSE_CMD logs postgres"
