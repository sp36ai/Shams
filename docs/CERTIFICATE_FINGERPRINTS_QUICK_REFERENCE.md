# Certificate Fingerprints - Quick Reference

> SHA1 and SHA256 fingerprints for Firebase Cloud Functions

---

## 🚀 Quick Start

### Generate Test Certificates (Development)

```powershell
# Run this script
.\scripts\Generate-FirebaseCertificates.ps1

# Output: functions/certs/fingerprints.json with SHA1 & SHA256
```

### Get Production Fingerprints (Firebase)

```bash
# For your Firebase Cloud Functions domain:
# https://us-central1-shams-al-asrar.cloudfunctions.net

openssl s_client -connect us-central1-shams-al-asrar.cloudfunctions.net:443 \
  -showcerts </dev/null 2>/dev/null | \
  openssl x509 -outform PEM -out firebase_cert.pem

# SHA256 (Base64 - USE THIS)
openssl x509 -in firebase_cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

# SHA1 (Legacy - for reference)
openssl x509 -in firebase_cert.pem -noout -fingerprint -sha1
```

---

## 📋 File Locations

| Purpose | Path | Format |
|---------|------|--------|
| Setup Guide | `docs/CERTIFICATE_PINNING_SETUP.md` | Markdown |
| Pinning Logic | `src/utils/certificatePinning.ts` | TypeScript |
| Certificate Generator | `scripts/Generate-FirebaseCertificates.ps1` | PowerShell |
| Test Certs | `functions/certs/firebase-dev.*` | PEM/CRT/KEY |
| Fingerprints | `functions/certs/fingerprints.json` | JSON |

---

## 🔐 SHA1 vs SHA256

### SHA256 (Recommended)
- ✅ Cryptographically secure
- ✅ 256-bit strength
- ✅ Used by modern systems
- **USE FOR PRODUCTION**

### SHA1 (Legacy)
- ⚠️ Older algorithm
- ⚠️ 160-bit strength
- ⚠️ Still widely supported
- **FOR REFERENCE ONLY**

---

## 📝 Configuration

### Step 1: Generate Certificates

**Development:**
```powershell
.\scripts\Generate-FirebaseCertificates.ps1
```

**Production:**
```bash
openssl s_client -connect YOUR_DOMAIN:443 -showcerts < /dev/null 2>/dev/null | \
  openssl x509 -outform PEM -out cert.pem
```

### Step 2: Extract Fingerprints

**SHA256 from certificate:**
```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

**SHA1 from certificate:**
```bash
openssl x509 -in cert.pem -noout -fingerprint -sha1
```

### Step 3: Update Config

**`functions/src/config.ts`:**
```ts
export const CERTIFICATE_PINS = {
  production: {
    domain: 'us-central1-shams-al-asrar.cloudfunctions.net',
    sha256: 'kT1234567890abcdefghijklmno+/ABC1234567890=',
    sha1: 'AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12'
  },
  development: {
    domain: 'localhost:5001',
    sha256: 'devCertSHA256==',
    sha1: 'AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:11:22:33:44'
  }
};
```

### Step 4: Use in React Native

```ts
import { setupCertificatePinning, displayCertificatePinInfo } from '@utils/certificatePinning';

// Display current pins
displayCertificatePinInfo();

// Setup axios client
const client = axios.create({ baseURL: FIREBASE_URL });
setupCertificatePinning(client);
```

---

## 🧪 Verification Commands

### Test Certificate Validity
```bash
openssl x509 -in cert.pem -text -noout
```

### Verify Fingerprint Match
```bash
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

### Test HTTPS with Pin
```bash
curl -v --cacert cert.pem https://YOUR_DOMAIN/
```

---

## 🔍 Common Issues

| Issue | Solution |
|-------|----------|
| "Certificate verification failed" | Verify SHA256 matches certificate |
| "OpenSSL not found" | Install: `choco install openssl` |
| "Private key leaked" | Rotate immediately, revoke certificate |
| "Certificate expired" | Regenerate or get new certificate |
| "Fingerprint mismatch" | Ensure using public key hash, not cert hash |

---

## 📊 Fingerprint Format

### Base64 Format (SHA256 for pinning)
```
kT1234567890abcdefghijklmno+/ABC1234567890=
│  └─ 43-44 characters typically
└─ Always ends with optional '=' padding
```

### Hex Format (SHA256 alternative)
```
a13d34e794e3c19f5e8e2c3e1f0a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1
│  └─ 64 characters (256-bit = 64 hex digits)
└─ Lowercase, used for debugging
```

### Colon Format (SHA1 legacy)
```
AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
│  └─ 59 characters (40 hex digits + 19 colons)
└─ Used by OpenSSL output
```

---

## 🛡️ Security Checklist

- [ ] SHA256 fingerprints obtained from trusted source
- [ ] Private keys never committed to Git
- [ ] `.gitignore` includes `*.key`
- [ ] Certificates stored securely
- [ ] Certificate pinning enabled in production
- [ ] Rotation plan in place
- [ ] Audit logs enable certificate change tracking
- [ ] Team trained on certificate management

---

## 📚 References

- [RFC 7469 - Public Key Pinning Extension](https://tools.ietf.org/html/rfc7469)
- [OWASP Certificate Pinning](https://owasp.org/www-community/controls/Certificate_Pinning)
- [Firebase Security Best Practices](https://firebase.google.com/docs/projects/learn-more)
- [OpenSSL Commands Reference](https://www.openssl.org/docs/man1.1.1/)
