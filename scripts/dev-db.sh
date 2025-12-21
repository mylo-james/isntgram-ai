#!/bin/bash

# Start PostgreSQL and MinIO for local development (supports docker compose v1 and v2)
set -e

echo "Starting development infrastructure..."

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

# Start infrastructure services
$COMPOSE_CMD up -d postgres minio minio-init

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
until $COMPOSE_CMD exec -T postgres pg_isready -U postgres -d isntgram >/dev/null 2>&1; do
  echo "PostgreSQL is not ready yet. Waiting..."
  sleep 2
done

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -f http://localhost:9000/minio/health/ready >/dev/null 2>&1; do
  echo "MinIO is not ready yet. Waiting..."
  sleep 2
done

echo "✅ Infrastructure is ready!"
echo "Postgres URL: postgresql://postgres:password@localhost:5432/isntgram"
echo "MinIO URL: http://localhost:9000 (console: http://localhost:9001)"
echo "Bucket: isntgram-media"
echo ""
echo "To stop services, run: $COMPOSE_CMD down"
echo "To view logs, run: $COMPOSE_CMD logs postgres minio"
