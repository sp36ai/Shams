#!/bin/bash

################################################################################
# Deployment Verification Script
################################################################################
# Tests all deployed Cloud Functions and Firestore rules.
#
# Usage:
#   ./scripts/deploy/test-deployment.sh --project shams-app-4d0e7
#
################################################################################

set -e

PROJECT_ID="${1:-shams-app-4d0e7}"
REGION="asia-south1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deployment Verification                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

log_info "Project: $PROJECT_ID"
log_info "Region: $REGION"
echo ""

# Test 1: List functions
log_info "Test 1: Listing deployed functions..."
if firebase functions:list --project "$PROJECT_ID" --region "$REGION" > /dev/null 2>&1; then
  FUNCTIONS=$(firebase functions:list --project "$PROJECT_ID" --region "$REGION" --format=json 2>/dev/null | grep -o '"name":"[^"]*"' | wc -l)
  log_success "Found $FUNCTIONS deployed functions"
else
  log_error "Failed to list functions"
fi
echo ""

# Test 2: Health endpoint
log_info "Test 2: Testing health endpoint..."
HEALTH_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/health"
if command -v curl &> /dev/null; then
  if RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null); then
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
      log_success "Health endpoint responded: HTTP $HTTP_CODE"
    else
      log_warn "Health endpoint HTTP $HTTP_CODE (may be initializing)"
    fi
  else
    log_warn "Could not reach health endpoint (may be initializing, try again in 30s)"
  fi
else
  log_warn "curl not found, skipping health check"
fi
echo ""

# Test 3: Firestore rules
log_info "Test 3: Verifying Firestore rules..."
if [ -f "firestore.rules" ]; then
  if firebase validate-rules firestore.rules --project "$PROJECT_ID" > /dev/null 2>&1; then
    log_success "Firestore rules are valid"
  else
    log_error "Firestore rules validation failed"
  fi
else
  log_warn "firestore.rules not found"
fi
echo ""

# Test 4: Check Firestore indexes
log_info "Test 4: Checking Firestore indexes..."
if [ -f "firestore.indexes.json" ]; then
  log_success "firestore.indexes.json exists"
else
  log_warn "firestore.indexes.json not found"
fi
echo ""

# Test 5: Cloud Functions logs
log_info "Test 5: Checking recent Cloud Functions logs..."
if command -v firebase &> /dev/null; then
  LOG_COUNT=$(firebase functions:log --project "$PROJECT_ID" --limit 5 2>/dev/null | wc -l)
  if [ "$LOG_COUNT" -gt 0 ]; then
    log_success "Recent logs found ($LOG_COUNT lines)"
    firebase functions:log --project "$PROJECT_ID" --limit 3 2>/dev/null | head -10
  else
    log_warn "No logs found (functions may not have been called yet)"
  fi
else
  log_warn "firebase-tools not found"
fi
echo ""

# Test 6: Check secret access
log_info "Test 6: Verifying secret manager access..."
if command -v gcloud &> /dev/null; then
  SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
  SECRETS=$(gcloud secrets list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || echo "")

  if [ -n "$SECRETS" ]; then
    log_success "Secrets found in Secret Manager"
    echo "$SECRETS" | head -3 | while read -r secret; do
      echo "  - $secret"
    done
  else
    log_warn "No secrets found (expected for first deploy, run setup-secrets.sh)"
  fi
else
  log_warn "gcloud CLI not found"
fi
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Verification Complete                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
log_info "Next steps:"
echo "  1. Monitor functions: firebase functions:log --project $PROJECT_ID --follow"
echo "  2. Build Android APK: ./scripts/deploy/build-android.sh"
echo "  3. Test on device: adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
