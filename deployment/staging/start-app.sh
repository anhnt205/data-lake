#!/bin/bash
set -e

echo "=== Staging Deployment Starting ==="
pwd
cat .env

echo "=== 1. Pulling latest images ==="
docker compose -f staging-docker-compose.yaml pull

echo "=== 2. Stopping existing containers ==="
docker compose -f staging-docker-compose.yaml down || true

echo "=== 3. Starting containers with new images ==="
docker compose -f staging-docker-compose.yaml up -d --force-recreate

echo "=== 4. Checking running containers ==="
docker compose -f staging-docker-compose.yaml ps
docker ps

echo "=== 5. Pruning unused images ==="
docker image prune -f
echo "=== Deployment Finished Successfully ==="