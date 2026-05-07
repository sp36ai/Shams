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

// Captured 2026-05-07 via openssl s_client against live Google endpoints.
// Refresh if TLS handshake failures appear after a Google cert rotation.
//
// Native OkHttp pinner (MainApplication.kt) should pin ALL three domains.
// firebase.googleapis.com and identitytoolkit.googleapis.com share a leaf cert.
export const PRODUCTION_SPKI_PINS: Readonly<Record<string, string>> = Object.freeze({
  'firestore.googleapis.com':       'NHasLBXL7uS5JzodPAdAqd/YoGIy3AySHd7yyKRg5xo=',
  'firebase.googleapis.com':        'oVK9AMvzuTJhavj8JKMULZqcgPvnTenud/VH/97y/XY=',
  'identitytoolkit.googleapis.com': 'oVK9AMvzuTJhavj8JKMULZqcgPvnTenud/VH/97y/XY=',
});

export const CERTIFICATE_PINS: CertificatePinConfig = {
  production: {
    domain: 'firestore.googleapis.com',
    sha256: PRODUCTION_SPKI_PINS['firestore.googleapis.com']!,
  },
  development: {
    domain: 'localhost:5001',
    sha256: 'bypass-localhost',
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
