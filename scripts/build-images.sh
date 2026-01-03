#!/bin/bash

# ===========================================
# Build and Push Docker Images
# ===========================================

set -e

REGISTRY=${REGISTRY:-"localhost:5000"}
TAG=${TAG:-"latest"}

echo "Building and pushing images to $REGISTRY..."

# Services to build
SERVICES=(
    "api-gateway"
    "auth-service"
    "ride-service"
    "driver-service"
    "payment-service"
    "notification-service"
    "ai-service"
)

for SERVICE in "${SERVICES[@]}"; do
    echo "=========================================="
    echo "Building $SERVICE..."
    echo "=========================================="
    
    docker build -t $REGISTRY/cab-$SERVICE:$TAG ./services/$SERVICE
    docker push $REGISTRY/cab-$SERVICE:$TAG
    
    echo "$SERVICE built and pushed!"
done

echo "=========================================="
echo "All images built and pushed successfully!"
echo "=========================================="
