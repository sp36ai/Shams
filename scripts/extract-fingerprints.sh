#!/usr/bin/env bash
# Extract certificate fingerprints (SHA1 & SHA256) from certificate file
# Usage: ./extract-fingerprints.sh <certificate-file> [domain]

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <certificate-file> [domain]"
    echo ""
    echo "Examples:"
    echo "  $0 firebase_cert.pem"
    echo "  $0 firebase_cert.pem us-central1-shams-al-asrar.cloudfunctions.net"
    echo ""
    echo "To get certificate from Firebase:"
    echo "  openssl s_client -connect DOMAIN:443 -showcerts < /dev/null 2>/dev/null | \\
       openssl x509 -outform PEM -out firebase_cert.pem"
    exit 1
fi

CERT_FILE="$1"
DOMAIN="${2:-Unknown}"

# Check if file exists
if [ ! -f "$CERT_FILE" ]; then
    echo "Error: Certificate file not found: $CERT_FILE"
    exit 1
fi

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "Error: OpenSSL not found. Please install OpenSSL."
    exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Certificate Fingerprint Extractor               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📄 Certificate: $CERT_FILE"
echo "🌐 Domain: $DOMAIN"
echo ""

# Extract certificate info
SUBJECT=$(openssl x509 -in "$CERT_FILE" -noout -subject 2>/dev/null | sed 's/subject=//' || echo "Unknown")
ISSUER=$(openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null | sed 's/issuer=//' || echo "Unknown")
NOT_BEFORE=$(openssl x509 -in "$CERT_FILE" -noout -dates 2>/dev/null | grep notBefore | sed 's/notBefore=//' || echo "Unknown")
NOT_AFTER=$(openssl x509 -in "$CERT_FILE" -noout -dates 2>/dev/null | grep notAfter | sed 's/notAfter=//' || echo "Unknown")

echo "📋 Certificate Information:"
echo "   Subject: $SUBJECT"
echo "   Issuer: $ISSUER"
echo "   Valid From: $NOT_BEFORE"
echo "   Valid Until: $NOT_AFTER"
echo ""

# Extract SHA256 fingerprint (Base64)
echo "🔐 SHA256 Fingerprints:"
echo ""

SHA256_BASE64=$(openssl x509 -in "$CERT_FILE" -pubkey -noout 2>/dev/null | \
                openssl pkey -pubin -outform DER 2>/dev/null | \
                openssl dgst -sha256 -binary 2>/dev/null | \
                openssl enc -base64 2>/dev/null | tr -d '\n')

echo "Base64 (USE THIS FOR CERTIFICATE PINNING):"
echo "  $SHA256_BASE64"
echo ""

# Extract SHA256 fingerprint (Hex)
SHA256_HEX=$(openssl x509 -in "$CERT_FILE" -pubkey -noout 2>/dev/null | \
             openssl pkey -pubin -outform DER 2>/dev/null | \
             openssl dgst -sha256 2>/dev/null | sed 's/^.* //')

echo "Hex (for debugging):"
echo "  $SHA256_HEX"
echo ""

# Extract SHA1 fingerprint (Legacy)
echo "📝 SHA1 Fingerprint (Legacy - for reference only):"
echo ""

SHA1=$(openssl x509 -in "$CERT_FILE" -noout -fingerprint -sha1 2>/dev/null | \
       sed 's/SHA1 Fingerprint=//')

echo "$SHA1"
echo ""

# Generate JSON output
JSON_OUTPUT="{
  \"domain\": \"$DOMAIN\",
  \"certificate\": \"$CERT_FILE\",
  \"extracted\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"fingerprints\": {
    \"sha256\": {
      \"base64\": \"$SHA256_BASE64\",
      \"hex\": \"$SHA256_HEX\",
      \"purpose\": \"Use for certificate pinning\"
    },
    \"sha1\": {
      \"value\": \"$SHA1\",
      \"purpose\": \"Legacy - reference only\"
    }
  },
  \"certificate_info\": {
    \"subject\": \"$SUBJECT\",
    \"issuer\": \"$ISSUER\",
    \"valid_from\": \"$NOT_BEFORE\",
    \"valid_until\": \"$NOT_AFTER\"
  }
}"

# Save to JSON file
OUTPUT_FILE="${CERT_FILE%.*}_fingerprints.json"
echo "$JSON_OUTPUT" > "$OUTPUT_FILE"

echo "✅ Results saved to: $OUTPUT_FILE"
echo ""
echo "📝 Next steps:"
echo "   1. Copy the SHA256 Base64 value above"
echo "   2. Update functions/src/config.ts"
echo "   3. Update src/utils/certificatePinning.ts"
echo "   4. Commit changes and deploy"
echo ""
