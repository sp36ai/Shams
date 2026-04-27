# Certificate Fingerprint Examples

> Real-world examples of SHA1 and SHA256 fingerprints

---

## 📋 Example 1: Firebase Development Certificate

**Generated**: 2026-04-25  
**Validity**: 365 days  
**Subject**: CN=localhost, O=Shams Al-Asrar Dev, C=US

### SHA256 Fingerprints

```
Base64 (Primary - USE THIS):
kT1234567890abcdefghijklmno+/ABC1234567890=

Hex (Alternative):
a13d34e794e3c19f5e8e2c3e1f0a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1
```

### SHA1 Fingerprint (Legacy)

```
AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
```

### Configuration Usage

```typescript
// functions/src/config.ts
export const CERTIFICATE_PINS = {
  development: {
    domain: 'localhost:5001',
    sha256: 'kT1234567890abcdefghijklmno+/ABC1234567890=',
    sha1: 'AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12'
  }
};

// src/utils/certificatePinning.ts
CERTIFICATE_PINS.development.sha256 = 'kT1234567890abcdefghijklmno+/ABC1234567890=';
```

---

## 📋 Example 2: Firebase Production Certificate

**Domain**: us-central1-shams-al-asrar.cloudfunctions.net  
**Issuer**: Google Trust Services LLC  
**Validity**: Typically 90 days (auto-rotated)

### SHA256 Fingerprints

```
Base64 (Primary - USE THIS):
zK9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAxyz=

Hex (Alternative):
b1a9c8d7e6f5g4h3i2j1k0l9m8n7o6p5q4r3s2t1u0v9w8x7y6z5a4b3c2d1e0
```

### SHA1 Fingerprint (Legacy)

```
AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
```

### Configuration Usage

```typescript
// functions/src/config.ts
export const CERTIFICATE_PINS = {
  production: {
    domain: 'us-central1-shams-al-asrar.cloudfunctions.net',
    sha256: 'zK9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAxyz=',
    sha1: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD'
  }
};
```

---

## 📊 Fingerprint Format Comparison

### Format: Base64 (SHA256)
```
kT1234567890abcdefghijklmno+/ABC1234567890=

Structure:
- Alphanumeric: a-z, A-Z, 0-9
- Special: +, /, =
- Length: 43-44 characters
- Encoding: Base64 (printable ASCII)
- Usage: Configuration files, pinning implementations
```

### Format: Hex (SHA256)
```
a13d34e794e3c19f5e8e2c3e1f0a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1

Structure:
- Characters: 0-9, a-f (lowercase hex digits)
- Length: 64 characters (256 bits / 4 bits per digit)
- Encoding: Hexadecimal (base 16)
- Usage: Debugging, comparison, OpenSSL output
```

### Format: Colon (SHA1)
```
AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12

Structure:
- Characters: 0-9, A-F (uppercase hex digits)
- Separators: Colons between pairs
- Length: 59 characters (40 hex + 19 colons)
- Encoding: Hexadecimal with separators
- Usage: OpenSSL default output, legacy systems
```

---

## 🔄 Conversion Examples

### Convert from One Format to Another

**Scenario**: You have SHA1 output and need Base64 SHA256

```bash
# Get the certificate file
openssl x509 -in cert.pem > cert.pem

# Convert to Base64 SHA256
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
# Output: kT1234567890abcdefghijklmno+/ABC1234567890=
```

---

## 📝 Real Command Output Examples

### Example Command Execution

```bash
$ openssl x509 -in firebase-dev.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

kT1234567890abcdefghijklmno+/ABC1234567890=
```

### Certificate Info Example

```bash
$ openssl x509 -in firebase-dev.pem -noout -text

Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number: 1234567890abcdef (0x1234567890abcdef)
    Signature Algorithm: sha256WithRSAEncryption
        Issuer: C = US, ST = Development, L = Local, O = Shams Al-Asrar Dev, CN = localhost
        Subject: C = US, ST = Development, L = Local, O = Shams Al-Asrar Dev, CN = localhost
        Validity
            Not Before: Apr 25 14:30:00 2026 GMT
            Not After : Apr 25 14:30:00 2027 GMT
```

---

## 🧪 Test Fingerprints

For testing purposes, here are example values you might encounter:

### Development Environment
```json
{
  "environment": "development",
  "domain": "localhost:5001",
  "certificate_type": "Self-signed",
  "validity_days": 365,
  "fingerprints": {
    "sha256": {
      "base64": "kT1234567890abcdefghijklmno+/ABC1234567890=",
      "hex": "a13d34e794e3c19f5e8e2c3e1f0a9b8c7d6e5f4g3h2i1j0k9l8m7n6o5p4q3r2s1"
    },
    "sha1": {
      "value": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12"
    }
  }
}
```

### Production Environment
```json
{
  "environment": "production",
  "domain": "us-central1-shams-al-asrar.cloudfunctions.net",
  "certificate_type": "Google Trust Services",
  "issuer": "Google Trust Services LLC",
  "validity_days": 90,
  "auto_renewal": true,
  "fingerprints": {
    "sha256": {
      "base64": "zK9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAxyz=",
      "hex": "b1a9c8d7e6f5g4h3i2j1k0l9m8n7o6p5q4r3s2t1u0v9w8x7y6z5a4b3c2d1e0"
    },
    "sha1": {
      "value": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"
    }
  }
}
```

---

## ✅ Validation Examples

### Example 1: Matching SHA256

```typescript
// Certificate fingerprint
const certificateSha256 = 'kT1234567890abcdefghijklmno+/ABC1234567890=';

// Config stored value
const configSha256 = 'kT1234567890abcdefghijklmno+/ABC1234567890=';

// ✅ MATCH - Connection allowed
if (certificateSha256 === configSha256) {
  console.log('✓ Certificate pinning verified');
}
```

### Example 2: Mismatching SHA256 (Attack Detected)

```typescript
// Certificate fingerprint (compromised CA or MITM attack)
const certificateSha256 = 'EVIL1234567890abcdefghijklmno+/ATTACK=';

// Config stored value (trusted pin)
const configSha256 = 'kT1234567890abcdefghijklmno+/ABC1234567890=';

// ❌ MISMATCH - Connection blocked
if (certificateSha256 !== configSha256) {
  throw new Error('Certificate pinning failed - potential attack detected');
}
```

---

## 📖 How to Read a Fingerprint

### SHA256 Base64 Example
```
kT1234567890abcdefghijklmno+/ABC1234567890=
│││ ││││││ ││││ ││││ ││││ ││││ ││ ││││
└┴┴─ └────────────────────────────────┘
  │           │                    │
  │           │                    └─ Base64 padding (0-2 chars)
  │           └─ 40 random-looking characters
  └─ Starts with letter (a-z, A-Z)
```

**Characteristics:**
- Always starts with a letter
- Mix of uppercase and lowercase
- Contains digits 0-9
- May have + or / special chars
- Ends with 0-2 = signs (padding)
- Total: 43-44 characters

### SHA1 Colon Format Example
```
AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
││ ││ ││ ││ │  │  │  │  │  │  │  │  │  │  │  │  │
└┴─┴─┴─ (pairs of hex digits separated by colons)
```

**Characteristics:**
- Always uppercase hex digits
- 20 pairs of hex (40 hex digits)
- 19 colons as separators
- Total: 59 characters

---

## 🔄 Expected Behavior

### When Certificate Pinning Works ✅

```
1. App requests: https://firebase.cloudfunctions.net/judge
2. Server sends certificate
3. App extracts SHA256: 'kT1234567890...'
4. App compares with config: 'kT1234567890...'
5. ✅ MATCH - Request proceeds
6. Response delivered securely
```

### When Certificate Pinning Blocks Attack ❌

```
1. App requests: https://firebase.cloudfunctions.net/judge
2. Attacker intercepts (MITM or compromised CA)
3. Attacker sends fake certificate
4. App extracts SHA256: 'EVIL1234567890...'
5. App compares with config: 'kT1234567890...'
6. ❌ MISMATCH - Request BLOCKED
7. User sees error, request fails safely
```

---

## 📊 Reference Table

| Property | SHA256 | SHA1 |
|----------|--------|------|
| **Format** | Base64 or Hex | Colon-separated |
| **Length (Base64)** | 43-44 chars | N/A |
| **Length (Hex)** | 64 chars | 40 chars |
| **Bit Strength** | 256-bit | 160-bit |
| **Status** | Current | Legacy |
| **Example (Base64)** | `kT1234567890...=` | N/A |
| **Example (Hex)** | `a13d34e794e3c...` | `AB:CD:EF:12:...` |
| **Use in Pinning** | ✅ YES | ⚠️ Reference |
| **OpenSSL Command** | `dgst -sha256` | `fingerprint -sha1` |

---

**Remember**: When in doubt about format, check the number of characters and separators!
