# Certificate Pinning Setup Guide

> Secure your Firebase Cloud Functions with certificate pinning

---

## Part 1: Firebase Production Certificate (SHA256 Only)

Firebase automatically handles HTTPS/TLS. You need the public key hash for pinning.

### Get Firebase Certificate Fingerprint

```bash
# 1. Get Firebase Cloud Functions domain
# Format: https://REGION-PROJECT_ID.cloudfunctions.net
# Example: https://us-central1-shams-al-asrar.cloudfunctions.net

# 2. Download certificate using OpenSSL
openssl s_client -connect us-central1-shams-al-asrar.cloudfunctions.net:443 -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM -out firebase_cert.pem

# 3. Extract public key and generate SHA256 fingerprint
openssl x509 -in firebase_cert.pem -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl enc -base64

# 4. Extract SHA1 fingerprint (legacy, for reference only)
openssl x509 -in firebase_cert.pem -noout -fingerprint -sha1
```

### Expected Output

```
SHA256 (Base64): kT1234567890abcdefghijklmno+/ABC1234567890=

SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
```

---

## Part 2: Development & Testing Certificates

For Firebase Emulator and local testing.

### Generate Self-Signed Certificate (Valid 365 Days)

```bash
# Generate private key
openssl genrsa -out firebase-dev.key 2048

# Generate self-signed certificate
openssl req -new -x509 -key firebase-dev.key -out firebase-dev.crt -days 365 \
  -subj "/CN=localhost/O=Shams Al-Asrar Dev/C=US"

# Convert to PEM (for Node.js)
openssl x509 -in firebase-dev.crt -out firebase-dev.pem

# Extract SHA256 fingerprint
openssl x509 -in firebase-dev.pem -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl enc -base64

# Extract SHA1 fingerprint
openssl x509 -in firebase-dev.pem -noout -fingerprint -sha1
```

### Output Storage

```
functions/certs/
├── firebase-dev.key          (Private key - NEVER commit!)
├── firebase-dev.crt          (Self-signed certificate)
├── firebase-dev.pem          (PEM format)
└── fingerprints.json         (SHA1 & SHA256 for pinning)
```

---

## Part 3: Extract Fingerprint from Existing Certificate

If you have a `.pem` or `.crt` file:

```bash
# SHA256 (RECOMMENDED for production pinning)
openssl x509 -in certificate.pem -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl enc -base64

# SHA1 (Legacy - for reference only)
openssl x509 -in certificate.pem -noout -fingerprint -sha1

# Full SHA256 (Hex format - alternative)
openssl x509 -in certificate.pem -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256
```

---

## Part 4: Certificate Pinning Implementation

### React Native Setup

Store certificates in `functions/certs/fingerprints.json`:

```json
{
  "production": {
    "domain": "us-central1-shams-al-asrar.cloudfunctions.net",
    "sha256": "kT1234567890abcdefghijklmno+/ABC1234567890=",
    "sha256Hex": "a13d34e794e3c19f5e8e2c3e1f0a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1",
    "sha1": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12"
  },
  "development": {
    "domain": "localhost",
    "sha256": "devCertSHA256Base64String==",
    "sha1": "AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:11:22:33:44"
  }
}
```

### Pinning in Code

See `functions/src/security/certificatePinning.ts` for implementation.

---

## Part 5: Update Config

Edit `functions/src/config.ts`:

```ts
export const CERTIFICATE_PINS = {
  production: {
    domain: 'us-central1-shams-al-asrar.cloudfunctions.net',
    sha256: 'YOUR_SHA256_HERE', // Get from Part 1
    sha1: 'YOUR_SHA1_HERE'
  },
  development: {
    domain: 'localhost:5001',
    sha256: 'YOUR_DEV_SHA256_HERE', // Get from Part 2
    sha1: 'YOUR_DEV_SHA1_HERE'
  }
};
```

---

## Part 6: Verification Commands

```bash
# Verify SHA256 fingerprint matches
openssl x509 -in firebase-dev.pem -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl enc -base64

# Verify certificate validity
openssl x509 -in firebase-dev.pem -text -noout

# Test HTTPS connection with certificate pinning
curl -v --cacert firebase-dev.pem https://localhost:5001/
```

---

## Deployment Steps

1. **Generate Firebase certificate fingerprint** (Part 1)
2. **Store SHA256 in config** (Part 5)
3. **Deploy to production**:
   ```bash
   firebase deploy --only functions
   ```
4. **Update React Native app** to use new certificate pins
5. **Test with real device** to verify pinning works

---

## Security Notes

| Aspect | Notes |
|--------|-------|
| **SHA256** | ✅ Use for production - cryptographically secure |
| **SHA1** | ⚠️ Legacy - included for reference only, not recommended |
| **Private Key** | 🔒 NEVER commit to Git (`functions/certs/*.key` in .gitignore) |
| **Pin Updates** | Update when certificates rotate (Firebase auto-rotates annually) |
| **Fallback** | System Certificate Authority validates if pin fails |

---

## Troubleshooting

### "Certificate verification failed"
- Verify SHA256 matches certificate
- Check domain name is correct
- Ensure certificate is not expired

### "Fingerprint mismatch"
- Regenerate fingerprint from certificate
- Check you're using public key hash (not certificate hash)
- Verify using `openssl` commands from Part 3

### "Connection refused"
- Check Firebase Emulator is running: `firebase emulators:start`
- Verify port 5001 is accessible
- Check firewall rules
