#!/bin/bash

################################################################################
# Shams al-Asrār — Automated Deployment Script
################################################################################
# This script automates Firebase + Cloud Functions deployment.
#
# Usage:
#   ./scripts/deploy/deploy.sh [options]
#
# Options:
#   --dry-run              Show what would be deployed, don't deploy
#   --skip-functions       Skip Cloud Functions, deploy only Firestore rules
#   --skip-rules           Skip Firestore rules, deploy only Cloud Functions
#   --project PROJECT_ID   Override GCP project ID (default: shams-app-4d0e7)
#   --region REGION        Cloud Functions region (default: asia-south1)
#   --help                 Show this message
#
# Requirements:
#   - Node.js 22+
#   - firebase-tools: npm install -g firebase-tools
#   - gcloud CLI: https://cloud.google.com/sdk/docs/install
#   - Authenticated: gcloud auth login && firebase login
#
# Example:
#   ./scripts/deploy/deploy.sh --dry-run
#   ./scripts/deploy/deploy.sh --project shams-app-4d0e7
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${PROJECT_ID:-shams-app-4d0e7}"
REGION="asia-south1"
DRY_RUN=false
SKIP_FUNCTIONS=false
SKIP_RULES=false
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-functions)
      SKIP_FUNCTIONS=true
      shift
      ;;
    --skip-rules)
      SKIP_RULES=true
      shift
      ;;
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --help)
      head -30 "$0" | tail -24
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Install from https://nodejs.org"
    exit 1
  fi
  log_success "Node.js $(node --version)"

  # Check firebase-tools
  if ! command -v firebase &> /dev/null; then
    log_error "firebase-tools not found. Install: npm install -g firebase-tools"
    exit 1
  fi
  log_success "firebase-tools $(firebase --version | head -1)"

  # Check gcloud
  if ! command -v gcloud &> /dev/null; then
    log_warn "gcloud CLI not found (optional). Some features may be unavailable."
  else
    log_success "gcloud $(gcloud --version | head -1)"
  fi

  # Check authentication
  if ! firebase projects:list > /dev/null 2>&1; then
    log_error "Not authenticated to Firebase. Run: firebase login"
    exit 1
  fi
  log_success "Firebase authenticated"
}

verify_project() {
  log_info "Verifying Firebase project: $PROJECT_ID"

  if firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
    log_success "Project $PROJECT_ID found"
  else
    log_error "Project $PROJECT_ID not found in Firebase"
    log_info "Available projects:"
    firebase projects:list
    exit 1
  fi
}

build_functions() {
  log_info "Building Cloud Functions..."

  cd "$PROJECT_ROOT/functions"
  npm install
  npm run build
  cd "$PROJECT_ROOT"

  log_success "Cloud Functions built"
}

deploy_functions() {
  log_info "Deploying Cloud Functions to $REGION..."

  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN: Would deploy to --region $REGION"
    echo "Command: firebase deploy --only functions --project $PROJECT_ID --region $REGION"
    return 0
  fi

  firebase deploy --only functions \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --non-interactive

  log_success "Cloud Functions deployed"
}

deploy_firestore() {
  log_info "Deploying Firestore rules and indexes..."

  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN: Would deploy Firestore"
    echo "Command: firebase deploy --only firestore --project $PROJECT_ID"
    return 0
  fi

  firebase deploy --only firestore \
    --project "$PROJECT_ID" \
    --non-interactive

  log_success "Firestore rules and indexes deployed"
}

verify_deployment() {
  log_info "Verifying deployment..."

  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN: Skipping verification"
    return 0
  fi

  # List deployed functions
  log_info "Deployed functions:"
  firebase functions:list --project "$PROJECT_ID" --region "$REGION" || true

  # Test health endpoint (if available)
  log_info "Testing health endpoint..."
  HEALTH_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/health"

  if command -v curl &> /dev/null; then
    if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
      log_success "Health endpoint is accessible"
      curl -s "$HEALTH_URL" | head -c 200
      echo ""
    else
      log_warn "Health endpoint not yet accessible (may take a few seconds)"
    fi
  fi
}

setup_secrets() {
  log_info "Setting up GCP secrets..."

  if ! command -v gcloud &> /dev/null; then
    log_warn "gcloud CLI not found. Cannot set up secrets automatically."
    log_info "See DEPLOYMENT.md 'Environment Variables & Secrets' section for manual setup."
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN: Would create secrets in GCP Secret Manager"
    return 0
  fi

  # Check if secrets already exist
  SECRETS=$(gcloud secrets list --format="value(name)" --project="$PROJECT_ID" 2>/dev/null || echo "")

  if echo "$SECRETS" | grep -q "GOOGLE_PLAY_CLIENT_EMAIL"; then
    log_success "GOOGLE_PLAY_CLIENT_EMAIL already exists"
  else
    log_warn "GOOGLE_PLAY_CLIENT_EMAIL not found. You'll need to create it manually."
    log_info "See DEPLOYMENT.md for instructions."
  fi

  log_info "Checking Cloud Functions service account access to secrets..."
  SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

  for secret in GOOGLE_PLAY_CLIENT_EMAIL GOOGLE_PLAY_PRIVATE_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
    if gcloud secrets describe "$secret" --project="$PROJECT_ID" > /dev/null 2>&1; then
      # Grant access if not already granted
      gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || true
    fi
  done

  log_success "Secret access configured"
}

main() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Shams al-Asrār — Deployment              ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
  echo ""

  log_info "Project: $PROJECT_ID"
  log_info "Region: $REGION"
  [ "$DRY_RUN" = true ] && log_warn "DRY RUN MODE"
  echo ""

  # Execute steps
  check_prerequisites
  verify_project

  if [ "$SKIP_FUNCTIONS" = false ]; then
    build_functions
    deploy_functions
  fi

  if [ "$SKIP_RULES" = false ]; then
    deploy_firestore
  fi

  verify_deployment
  setup_secrets

  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✓ Deployment Complete                    ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "  1. Build Android APK: ./gradlew assembleDebug"
  echo "  2. Test in emulator or device"
  echo "  3. Set up Cloud Build trigger (see DEPLOYMENT.md)"
  echo "  4. Monitor logs: firebase functions:log --project $PROJECT_ID"
  echo ""
}

main "$@"
