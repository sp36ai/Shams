#!/bin/bash

################################################################################
# Android Build Script
################################################################################
# Builds debug and release APKs.
#
# Usage:
#   ./scripts/deploy/build-android.sh [--release] [--docker]
#
# Options:
#   --release    Build release APK (requires signing setup)
#   --docker     Build inside Docker container
#
# Requirements:
#   - Android SDK (or Docker if using --docker)
#   - Java 17+ (or Docker)
#   - gradle: ./gradlew
#
################################################################################

set -e

BUILD_TYPE="${1:-debug}"
USE_DOCKER=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --release)
      BUILD_TYPE="release"
      shift
      ;;
    --docker)
      USE_DOCKER=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Android Build                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

log_info "Build type: $BUILD_TYPE"
[ "$USE_DOCKER" = true ] && log_info "Using Docker container"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

if [ "$USE_DOCKER" = true ]; then
  log_info "Building in Docker container..."
  docker-compose exec -T android-build ./gradlew "assemble${BUILD_TYPE^}"
else
  cd "$PROJECT_ROOT"

  # Check prerequisites
  if [ ! -f "gradlew" ]; then
    log_warn "gradlew not found. Run: npm install"
    exit 1
  fi

  log_info "Checking gradle..."
  ./gradlew --version

  log_info "Building ${BUILD_TYPE} APK..."
  ./gradlew "assemble${BUILD_TYPE^}" -x lint

  APK_PATH="android/app/build/outputs/apk/${BUILD_TYPE}/app-${BUILD_TYPE}.apk"
  if [ -f "$APK_PATH" ]; then
    SIZE=$(du -h "$APK_PATH" | cut -f1)
    log_success "APK built: $APK_PATH ($SIZE)"
  fi
fi

echo ""
log_info "Next: Install and test on device/emulator"
echo "  adb install -r android/app/build/outputs/apk/${BUILD_TYPE}/app-${BUILD_TYPE}.apk"
echo ""
