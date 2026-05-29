#!/bin/bash

################################################################################
# GCP Secret Manager Setup — Interactive
################################################################################
# Creates secrets in GCP Secret Manager for Cloud Functions.
#
# Usage:
#   ./scripts/deploy/setup-secrets.sh --project shams-app-4d0e7
#
# Requirements:
#   - gcloud CLI
#   - Authenticated: gcloud auth login
#   - Project with Secret Manager API enabled
#
################################################################################

set -e

PROJECT_ID="${1:-shams-app-4d0e7}"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

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
echo -e "${BLUE}║  GCP Secret Manager Setup                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

log_info "Project: $PROJECT_ID"
log_info "Service Account: $SERVICE_ACCOUNT"
echo ""

# Check gcloud
if ! command -v gcloud &> /dev/null; then
  echo "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
  log_warn "Not authenticated. Run: gcloud auth login"
  exit 1
fi

log_success "gcloud authenticated"
echo ""

# Function to create/update secret
create_secret() {
  local name="$1"
  local value="$2"

  if gcloud secrets describe "$name" --project="$PROJECT_ID" > /dev/null 2>&1; then
    log_info "Secret '$name' already exists. Updating..."
    echo "$value" | gcloud secrets versions add "$name" \
      --data-file=- \
      --project="$PROJECT_ID" > /dev/null
  else
    log_info "Creating secret '$name'..."
    echo "$value" | gcloud secrets create "$name" \
      --data-file=- \
      --replication-policy="automatic" \
      --project="$PROJECT_ID" > /dev/null
  fi

  # Grant service account access
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" \
    --quiet > /dev/null 2>&1 || true

  log_success "Secret '$name' ready"
}

# Interactive secret input
echo -e "${YELLOW}Enter credentials below (or press Enter to use test values)${NC}"
echo ""

# Google Play
read -p "Google Play Client Email (or Enter for test): " GOOGLE_PLAY_CLIENT_EMAIL
GOOGLE_PLAY_CLIENT_EMAIL="${GOOGLE_PLAY_CLIENT_EMAIL:-test-client@test.iam.gserviceaccount.com}"

read -p "Google Play Private Key (or Enter for test): " GOOGLE_PLAY_PRIVATE_KEY
GOOGLE_PLAY_PRIVATE_KEY="${GOOGLE_PLAY_PRIVATE_KEY:-{\"type\":\"service_account\",\"project_id\":\"test\"}}"

# Razorpay
read -p "Razorpay Key ID (or Enter for test): " RAZORPAY_KEY_ID
RAZORPAY_KEY_ID="${RAZORPAY_KEY_ID:-rzp_test_xxxxxxxxxx}"

read -p "Razorpay Key Secret (or Enter for test): " RAZORPAY_KEY_SECRET
RAZORPAY_KEY_SECRET="${RAZORPAY_KEY_SECRET:-test_secret}"

read -p "Razorpay Webhook Secret (or Enter for test): " RAZORPAY_WEBHOOK_SECRET
RAZORPAY_WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-test_webhook_secret}"

echo ""
log_info "Creating secrets..."
echo ""

create_secret "GOOGLE_PLAY_CLIENT_EMAIL" "$GOOGLE_PLAY_CLIENT_EMAIL"
create_secret "GOOGLE_PLAY_PRIVATE_KEY" "$GOOGLE_PLAY_PRIVATE_KEY"
create_secret "RAZORPAY_KEY_ID" "$RAZORPAY_KEY_ID"
create_secret "RAZORPAY_KEY_SECRET" "$RAZORPAY_KEY_SECRET"
create_secret "RAZORPAY_WEBHOOK_SECRET" "$RAZORPAY_WEBHOOK_SECRET"

echo ""
echo -e "${GREEN}✓ All secrets configured${NC}"
echo ""
log_info "Next: Deploy Cloud Functions"
echo "  ./scripts/deploy/deploy.sh --project $PROJECT_ID"
echo ""
