/**
 * Certificate pinning configuration for Shams al-Asrār.
 *
 * React Native certificate pinning is enforced at the native layer:
 *   Android — OkHttp CertificatePinner in MainApplication.kt
 *   iOS      — NSURLSession delegate in AppDelegate.mm
 *
 * This file holds the shared pin constants and JS-side helpers.
 * It intentionally has no axios dependency — the app uses Firebase SDK
 * for all network calls; pinning is applied by the native TLS stack.
 */

export interface CertificatePin {
  domain: string;
  /** Base64-encoded SHA-256 public key hash (SPKI). */
  sha256: string;
  /** Hex-encoded — for debugging and openssl comparison only. */
  sha256Hex?: string;
}

export interface CertificatePinConfig {
  production: CertificatePin;
  development: CertificatePin;
  enabled: boolean;
  /** If true, the native layer blocks the request on pin mismatch. */
  failOnPinMismatch: boolean;
}

/**
 * Certificate pins for the Shams al-Asrār Firebase backend.
 *
 * Replace the placeholder values with real fingerprints:
 *   openssl s_client -connect us-central1-shams-al-asrar.cloudfunctions.net:443 \
 *     -showcerts 2>/dev/null | openssl x509 -pubkey -noout \
 *     | openssl pkey -pubin -outform DER \
 *     | openssl dgst -sha256 -binary | openssl enc -base64
 */
export const CERTIFICATE_PINS: CertificatePinConfig = {
  production: {
    domain: 'us-central1-shams-al-asrar.cloudfunctions.net',
    sha256: 'REPLACE_WITH_FIREBASE_PRODUCTION_SHA256',
  },
  development: {
    domain: 'localhost:5001',
    sha256: 'REPLACE_WITH_DEVELOPMENT_SHA256',
  },
  enabled: true,
  failOnPinMismatch: true,
};

/** Returns the pin appropriate for the current environment. */
export function getActiveCertificatePin(): CertificatePin {
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_EMULATOR === 'true';
  return isDev ? CERTIFICATE_PINS.development : CERTIFICATE_PINS.production;
}

/**
 * Verify a fingerprint against the active pin (JS-side only).
 * The authoritative check is performed by the native TLS layer.
 */
export async function verifyCertificatePin(domain: string, fingerprint: string): Promise<boolean> {
  try {
    if (domain.includes('localhost')) {
      return true;
    }
    const pin = getActiveCertificatePin();
    const match = fingerprint === pin.sha256;
    if (!match) {
      console.error(`[Security] Pin mismatch for ${domain}`);
    }
    return match;
  } catch (err) {
    console.error('[Security] Certificate verification error:', err);
    return false;
  }
}

/** Log active pin config — call from __DEV__ blocks only. */
export function logCertificatePinInfo(): void {
  const pin = getActiveCertificatePin();
  // eslint-disable-next-line no-console
  console.log(
    `[Security] Active pin\n  domain : ${pin.domain}\n  sha256 : ${pin.sha256}\n  enabled: ${String(CERTIFICATE_PINS.enabled)}`,
  );
}
