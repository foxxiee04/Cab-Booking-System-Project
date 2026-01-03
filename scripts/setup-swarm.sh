#!/bin/bash

# ===========================================
# Docker Swarm Setup Script for VirtualBox
# CentOS 10 / RHEL-based systems
# ===========================================

set -e

echo "=========================================="
echo "Setting up Docker Swarm on CentOS"
echo "=========================================="

# Variables
MANAGER_IP=${MANAGER_IP:-"192.168.56.10"}
WORKER1_IP=${WORKER1_IP:-"192.168.56.11"}
WORKER2_IP=${WORKER2_IP:-"192.168.56.12"}

# Install Docker on all nodes
install_docker() {
    echo "Installing Docker..."
    
    # Remove old versions
    sudo yum remove -y docker docker-client docker-client-latest \
        docker-common docker-latest docker-latest-logrotate \
        docker-logrotate docker-engine 2>/dev/null || true
    
    # Install prerequisites
    sudo yum install -y yum-utils device-mapper-persistent-data lvm2
    
    # Add Docker repository
    sudo yum-config-manager --add-repo \
        https://download.docker.com/linux/centos/docker-ce.repo
    
    # Install Docker
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "Docker installed successfully!"
}

# Configure firewall for Swarm
configure_firewall() {
    echo "Configuring firewall for Docker Swarm..."
    
    # Swarm management
    sudo firewall-cmd --permanent --add-port=2377/tcp
    
    # Node communication
    sudo firewall-cmd --permanent --add-port=7946/tcp
    sudo firewall-cmd --permanent --add-port=7946/udp
    
    # Overlay network
    sudo firewall-cmd --permanent --add-port=4789/udp
    
    # Application ports
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --permanent --add-port=3000-3100/tcp
    
    sudo firewall-cmd --reload
    
    echo "Firewall configured!"
}

# Initialize Swarm on manager node
init_swarm_manager() {
    echo "Initializing Swarm manager..."
    
    docker swarm init --advertise-addr $MANAGER_IP
    
    # Save join tokens
    docker swarm join-token worker -q > /tmp/worker-token.txt
    docker swarm join-token manager -q > /tmp/manager-token.txt
    
    echo "Swarm manager initialized!"
    echo "Worker token saved to /tmp/worker-token.txt"
}

# Join as worker node
join_swarm_worker() {
    WORKER_TOKEN=$1
    MANAGER_ADDR=$2
    
    echo "Joining Swarm as worker..."
    docker swarm join --token $WORKER_TOKEN $MANAGER_ADDR:2377
    echo "Joined Swarm cluster!"
}

# Create Docker secrets
create_secrets() {
    echo "Creating Docker secrets..."
    
    echo "postgres" | docker secret create postgres_user -
    echo "postgres123" | docker secret create postgres_password -
    echo "mongo" | docker secret create mongo_user -
    echo "mongo123" | docker secret create mongo_password -
    
    echo "Secrets created!"
}

# Deploy stack
deploy_stack() {
    echo "Deploying Cab Booking stack..."
    
    # Create overlay networks
    docker network create --driver overlay --attachable frontend 2>/dev/null || true
    docker network create --driver overlay --attachable --internal backend 2>/dev/null || true
    docker network create --driver overlay --attachable monitoring 2>/dev/null || true
    
    # Deploy
    docker stack deploy -c docker-stack.yml cab-booking
    
    echo "Stack deployed!"
    echo "Check status: docker stack services cab-booking"
}

# Main execution
case "$1" in
    install)
        install_docker
        configure_firewall
        ;;
    init-manager)
        init_swarm_manager
        create_secrets
        ;;
    join-worker)
        join_swarm_worker "$2" "$3"
        ;;
    deploy)
        deploy_stack
        ;;
    *)
        echo "Usage: $0 {install|init-manager|join-worker <token> <manager-ip>|deploy}"
        echo ""
        echo "Steps:"
        echo "1. Run on ALL nodes: ./setup-swarm.sh install"
        echo "2. Run on MANAGER:   ./setup-swarm.sh init-manager"
        echo "3. Run on WORKERS:   ./setup-swarm.sh join-worker <token> <manager-ip>"
        echo "4. Run on MANAGER:   ./setup-swarm.sh deploy"
        exit 1
        ;;
esac
