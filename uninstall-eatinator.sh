#!/bin/bash

###################################################################################
# Eatinator Uninstallation Script
# 
# This script safely removes the Eatinator installation including containers,
# networks, and data directories.
#
# Usage: ./uninstall-eatinator.sh [options]
# Options:
#   --install-path PATH    Custom installation path (default: ~/nginx/lunchinator)
#   --keep-data           Keep votes and images data
#   --force              Skip confirmation prompts
#   --dry-run            Show what would be done without making changes
#   --help               Show this help message
###################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
INSTALL_PATH="$HOME/nginx/lunchinator"
KEEP_DATA=false
FORCE=false
DRY_RUN=false

# Docker configuration
DOCKER_NETWORK="lunchinet"
PHP_CONTAINER="lunchinator-php"
CLEANUP_CONTAINER="lunchinator-cleanup"

###################################################################################
# Helper Functions
###################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Eatinator Uninstallation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --install-path PATH    Custom installation path (default: ~/nginx/lunchinator)
    --keep-data           Keep votes and images data directories
    --force              Skip confirmation prompts
    --dry-run            Show what would be done without making changes
    --help               Show this help message

EXAMPLES:
    $0                                    # Standard uninstallation with prompts
    $0 --keep-data                        # Remove installation but keep data
    $0 --force                           # Remove without confirmation
    $0 --dry-run                         # Preview what would be removed

DESCRIPTION:
    This script removes the Eatinator installation including:
    - Docker containers (PHP-FPM and cleanup)
    - Application files and directories
    - Optionally: user data (votes and images)

WARNING:
    This will permanently delete the installation and optionally all user data.
    Use --dry-run first to see what will be removed.

EOF
}

confirm_action() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    local message="$1"
    echo -e "${YELLOW}$message${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled by user"
        exit 0
    fi
}

stop_and_remove_containers() {
    log_info "Stopping and removing Docker containers..."
    
    local containers=("$PHP_CONTAINER" "$CLEANUP_CONTAINER")
    
    for container in "${containers[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            if docker ps -a | grep -q "$container"; then
                log_info "Would stop and remove container: $container"
            fi
        else
            if docker ps -a | grep -q "$container"; then
                log_info "Stopping container: $container"
                docker stop "$container" 2>/dev/null || true
                
                log_info "Removing container: $container"
                docker rm "$container" 2>/dev/null || true
                
                log_success "Removed container: $container"
            else
                log_info "Container $container not found (already removed)"
            fi
        fi
    done
}

remove_docker_network() {
    log_info "Checking Docker network..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        if docker network ls | grep -q "$DOCKER_NETWORK"; then
            log_info "Would remove Docker network: $DOCKER_NETWORK"
        fi
    else
        if docker network ls | grep -q "$DOCKER_NETWORK"; then
            # Check if network has other containers
            local network_containers
            network_containers=$(docker network inspect "$DOCKER_NETWORK" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "")
            
            if [[ -n "$network_containers" ]]; then
                log_warning "Docker network $DOCKER_NETWORK has other containers: $network_containers"
                log_warning "Not removing network (other containers may need it)"
            else
                docker network rm "$DOCKER_NETWORK" 2>/dev/null || true
                log_success "Removed Docker network: $DOCKER_NETWORK"
            fi
        else
            log_info "Docker network $DOCKER_NETWORK not found (already removed)"
        fi
    fi
}

remove_installation_files() {
    log_info "Removing installation files..."
    
    if [[ ! -d "$INSTALL_PATH" ]]; then
        log_info "Installation directory $INSTALL_PATH not found"
        return 0
    fi
    
    if [[ "$KEEP_DATA" == "true" ]]; then
        log_info "Preserving data directories..."
        
        # Create backup location for data
        local backup_dir="$HOME/eatinator-data-backup-$(date +%Y%m%d_%H%M%S)"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would backup data to: $backup_dir"
            log_info "Would remove installation except data directories"
        else
            mkdir -p "$backup_dir"
            
            # Backup data directories if they exist
            if [[ -d "$INSTALL_PATH/www/api/votes_data" ]]; then
                cp -r "$INSTALL_PATH/www/api/votes_data" "$backup_dir/"
                log_info "Backed up votes data to: $backup_dir/votes_data"
            fi
            
            if [[ -d "$INSTALL_PATH/www/api/images_data" ]]; then
                cp -r "$INSTALL_PATH/www/api/images_data" "$backup_dir/"
                log_info "Backed up images data to: $backup_dir/images_data"
            fi
            
            # Remove installation
            rm -rf "$INSTALL_PATH"
            log_success "Installation removed, data backed up to: $backup_dir"
        fi
    else
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "Would remove entire installation directory: $INSTALL_PATH"
        else
            confirm_action "This will permanently delete ALL data including votes and images!"
            
            rm -rf "$INSTALL_PATH"
            log_success "Installation and all data removed: $INSTALL_PATH"
        fi
    fi
}

show_completion_info() {
    log_success "Eatinator uninstallation completed!"
    
    cat << EOF

${GREEN}=== Uninstallation Summary ===${NC}
Installation Path: $INSTALL_PATH
Data Preserved: $KEEP_DATA

${YELLOW}=== What was removed ===${NC}
- Docker containers: $PHP_CONTAINER, $CLEANUP_CONTAINER
- Application files and configuration
$(if [[ "$KEEP_DATA" == "false" ]]; then echo "- All user data (votes and images)"; fi)

$(if [[ "$KEEP_DATA" == "true" ]]; then
cat << DATAEOF
${YELLOW}=== Data Backup ===${NC}
Your votes and images data has been backed up to:
~/eatinator-data-backup-*

To restore data to a new installation:
1. Run the installation script
2. Copy backed up data to the new installation:
   cp -r ~/eatinator-data-backup-*/votes_data $INSTALL_PATH/www/api/
   cp -r ~/eatinator-data-backup-*/images_data $INSTALL_PATH/www/api/
3. Fix permissions:
   sudo chown -R 33:33 $INSTALL_PATH/www/api/*_data
   sudo chmod -R 775 $INSTALL_PATH/www/api/*_data

DATAEOF
fi)

${YELLOW}=== Manual Cleanup (if needed) ===${NC}
You may want to manually check and clean up:
- Docker volumes: docker volume ls
- Docker images: docker image ls | grep -E 'php|nginx'
- Nginx container configuration (if modified)

EOF
}

###################################################################################
# Parse command line arguments
###################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --install-path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        --keep-data)
            KEEP_DATA=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

###################################################################################
# Main uninstallation process
###################################################################################

main() {
    log_info "Starting Eatinator uninstallation..."
    log_info "Installation path: $INSTALL_PATH"
    log_info "Keep data: $KEEP_DATA"
    log_info "Force: $FORCE"
    log_info "Dry run: $DRY_RUN"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    if [[ "$DRY_RUN" == "false" ]] && [[ "$FORCE" == "false" ]]; then
        confirm_action "This will uninstall Eatinator and potentially remove data."
    fi
    
    stop_and_remove_containers
    remove_docker_network
    remove_installation_files
    show_completion_info
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run completed. Run without --dry-run to perform actual uninstallation."
    else
        log_success "Uninstallation completed successfully!"
    fi
}

# Run main function
main "$@"
