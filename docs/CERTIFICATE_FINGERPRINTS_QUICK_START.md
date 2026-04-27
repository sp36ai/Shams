# Certificate Fingerprint - Visual Quick Start

## 🎯 What Are Certificate Fingerprints?

```
Certificate (PEM/CRT)
         ↓
   Extract Public Key
         ↓
   Hash with SHA256/SHA1
         ↓
   Fingerprint (unique ID)
         ↓
   Pin to app config
         ↓
   App verifies before connecting
```

---

## ⚡ 5-Minute Setup

### Step 1: Generate Test Certificates (Windows)
```powershell
.\scripts\Generate-FirebaseCertificates.ps1
```

**Output:**
```
✓ functions/certs/firebase-dev.key      (private)
✓ functions/certs/firebase-dev.crt
✓ functions/certs/firebase-dev.pem
✓ functions/certs/fingerprints.json     (SHA1 & SHA256)
```

### Step 2: Get Firebase Production Fingerprint (macOS/Linux)
```bash
# 1. Download certificate
openssl s_client -connect us-central1-shams-al-asrar.cloudfunctions.net:443 \
  -showcerts </dev/null 2>/dev/null | \
  openssl x509 -outform PEM -out firebase_cert.pem

# 2. Extract fingerprints
./scripts/extract-fingerprints.sh firebase_cert.pem
```

**Output:**
```
SHA256 Base64: kT1234567890abcdefghijklmno+/ABC1234567890=
SHA1:          AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
```

### Step 3: Update Configuration
**File: `functions/src/config.ts`**
```typescript
export const CERTIFICATE_PINS = {
  production: {
    sha256: 'kT1234567890abcdefghijklmno+/ABC1234567890=',
    sha1: 'AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12'
  }
};
```

### Step 4: Deploy
```bash
firebase deploy --only functions
```

---

## 📊 File Reference

| File | Purpose | Type |
|------|---------|------|
| `scripts/Generate-FirebaseCertificates.ps1` | Auto-generate test certs | PowerShell |
| `scripts/extract-fingerprints.sh` | Extract SHA1/SHA256 from cert | Bash |
| `src/utils/certificatePinning.ts` | App-side pinning logic | TypeScript |
| `functions/src/config.ts` | Store fingerprints | TypeScript |
| `docs/CERTIFICATE_PINNING_SETUP.md` | Detailed guide | Markdown |
| `docs/CERTIFICATE_FINGERPRINTS_QUICK_REFERENCE.md` | Commands reference | Markdown |
| `docs/CERTIFICATE_FINGERPRINTS_IMPLEMENTATION_SUMMARY.md` | Complete walkthrough | Markdown |

---

## 🔐 Fingerprint Types Explained

```
┌──────────────────────────────────────────────────────┐
│ CERTIFICATE                                          │
│ ├─ Subject: CN=localhost                            │
│ ├─ Public Key (2048-bit RSA)                        │
│ └─ Valid: 2026-04-25 to 2027-04-25                  │
└──────────────────────────────────────────────────────┘
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
  SHA256              SHA1
  (256-bit)          (160-bit)
  Current Standard   Legacy
    ↓                   ↓
  [Base64]           [Colon Format]
  kT1234...=         AB:CD:EF:...
  ↑                  ↑
  USE FOR            REFERENCE
  PRODUCTION         ONLY
```

---

## 🚀 Deployment Flow

```
┌─────────────────────┐
│  React Native App   │
│  (Development)      │
└──────────┬──────────┘
           │
           ├─► Generate test certs
           │   (./scripts/Generate-Firebase...)
           │
           ├─► Extract SHA256/SHA1
           │
           ├─► Update config
           │   (functions/src/config.ts)
           │
           └─► Start emulator
               (firebase emulators:start)
               │
               ↓
        ┌──────────────┐
        │ Development  │
        │  Verified    │
        └──────┬───────┘
               │
               ├─► Get Firebase cert
               │   (openssl s_client...)
               │
               ├─► Extract SHA256/SHA1
               │   (./scripts/extract-fingerprints.sh)
               │
               ├─► Update production config
               │
               └─► Deploy to production
                   (firebase deploy)
                   │
                   ↓
        ┌──────────────────────┐
        │ Firebase Cloud       │
        │ Functions Live       │
        │ Certificate Pinning  │
        │ Enabled              │
        └──────────────────────┘
```

---

## ✅ Pre-Deployment Checklist

```
☐ Test certificate generated
  ☐ functions/certs/firebase-dev.key exists
  ☐ functions/certs/fingerprints.json exists

☐ Firebase certificate obtained
  ☐ firebase_cert.pem exists
  ☐ SHA256 fingerprint extracted

☐ Configuration updated
  ☐ functions/src/config.ts has production SHA256
  ☐ functions/src/config.ts has development SHA256
  ☐ src/utils/certificatePinning.ts matches config

☐ Security practices
  ☐ *.key files in .gitignore
  ☐ fingerprints.json in version control
  ☐ No private keys committed

☐ Testing complete
  ☐ Local: firebase emulators:start works
  ☐ Local: App connects to emulator
  ☐ Logs: "Certificate pinning enabled" appears

☐ Ready to deploy
  ☐ firebase deploy --only functions succeeds
  ☐ Cloud Functions logs accessible
  ☐ App connects to production Cloud Functions
```

---

## 🔍 Quick Verification

### Verify SHA256 matches certificate
```bash
# Should output same base64 as in config
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

### Verify certificate not expired
```bash
# Should show future date
openssl x509 -in cert.pem -noout -dates
```

### Verify pinning is active
```bash
# Development: Should show "Certificate pinning enabled"
firebase emulators:start &
npm start
# Check console output
```

---

## 📁 Directory Structure After Setup

```
shams-al-asrar/
├── functions/
│   ├── certs/
│   │   ├── firebase-dev.key              ← Private (DO NOT COMMIT)
│   │   ├── firebase-dev.crt
│   │   ├── firebase-dev.pem
│   │   └── fingerprints.json             ← SHA1 & SHA256
│   └── src/
│       └── config.ts                     ← UPDATED with SHA256/SHA1
├── src/
│   └── utils/
│       └── certificatePinning.ts         ← NEW: Pinning logic
├── scripts/
│   ├── Generate-FirebaseCertificates.ps1 ← NEW: Cert generator
│   └── extract-fingerprints.sh           ← NEW: SHA1/SHA256 extractor
└── docs/
    ├── CERTIFICATE_PINNING_SETUP.md
    ├── CERTIFICATE_FINGERPRINTS_QUICK_REFERENCE.md
    ├── CERTIFICATE_FINGERPRINTS_IMPLEMENTATION_SUMMARY.md
    └── CERTIFICATE_FINGERPRINTS_QUICK_START.md (this file)
```

---

## 🎓 Key Points

| Point | Details |
|-------|---------|
| **SHA256** | Primary fingerprint, 256-bit security, Base64 format |
| **SHA1** | Legacy fingerprint, 160-bit security, reference only |
| **Base64** | Text format suitable for config files, `abc123+/==` |
| **Hex** | Text format for debugging, `a1b2c3d4e5f6...` |
| **Colon Format** | OpenSSL default output, `AB:CD:EF:12:...` |
| **Private Key** | Secret - NEVER commit to Git |
| **Fingerprint** | Public - safe to commit |
| **Pinning** | Verification happens app-side before connecting |

---

## 🚨 Common Mistakes

❌ **WRONG**: Committing private keys
```bash
git add functions/certs/firebase-dev.key  # NO!
```

✅ **RIGHT**: Ignore private keys
```bash
echo "*.key" >> .gitignore
git add .gitignore
```

---

❌ **WRONG**: Using wrong fingerprint format
```typescript
sha256: 'AB:CD:EF:12...'  // This is SHA1 format!
```

✅ **RIGHT**: Use Base64 for SHA256
```typescript
sha256: 'kT1234567890abcdefghijklmno+/ABC1234567890='
```

---

❌ **WRONG**: Forgetting to update both config files
```typescript
// functions/src/config.ts has new SHA256
// But src/utils/certificatePinning.ts is missing it
```

✅ **RIGHT**: Update all references
```bash
grep -r "CERTIFICATE_PINS" src/ functions/
# Make sure all have same values
```

---

## 📞 Need Help?

| Issue | File |
|-------|------|
| General setup | `docs/CERTIFICATE_PINNING_SETUP.md` |
| Quick commands | `docs/CERTIFICATE_FINGERPRINTS_QUICK_REFERENCE.md` |
| Full walkthrough | `docs/CERTIFICATE_FINGERPRINTS_IMPLEMENTATION_SUMMARY.md` |
| Implementation | `src/utils/certificatePinning.ts` |

---

## ⏱️ Estimated Times

| Task | Time |
|------|------|
| Generate test certs | 5 min |
| Extract production fingerprints | 2 min |
| Update configuration | 5 min |
| Deploy to production | 5 min |
| **Total** | **17 minutes** |

---

**Next Step**: Run `.\scripts\Generate-FirebaseCertificates.ps1` to begin! 🚀
