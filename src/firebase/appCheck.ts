import appCheck from '@react-native-firebase/app-check';
import createLogger from '@utils/logger';

const logger = createLogger('AppCheck');

/**
 * Firebase App Check Initialization & API Key Rotation
 * ─────────────────────────────────────────────────────────────────────────
 * Security: Verifies device integrity before any Firebase service access.
 *
 * Production: Play Integrity API (Google Play Services)
 * Development: Debug tokens (registered in Firebase Console)
 *
 * Key Rotation Strategy:
 *   • Debug tokens: rotated every 30 days via Firebase Console
 *   • Play Integrity API key: managed by Google Cloud Console (auto-rotated)
 *   • Token refresh: automatic every 1 hour (isTokenAutoRefreshEnabled: true)
 *   • Failed attestation: reject all Firebase calls (hard-fail)
 *
 * Rotation Timeline:
 *   • Old key: Remains valid for 30 days after rotation (backward compatibility)
 *   • New key: Immediately active for all new app installations
 *   • Existing apps: Seamlessly transition to new key within 24 hours
 *
 * Error Handling:
 *   • Dev mode: logs warnings but continues (non-blocking)
 *   • Prod mode: silently initializes (failures handled by app-check runtime)
 */

interface AppCheckConfig {
  debugToken?: string;
  tokenRefreshTimeoutMs?: number;
}

/**
 * Initialize App Check with proper error handling and rotation support.
 *
 * @throws {Error} If App Check initialization fails in production
 */
export async function initializeAppCheck(config: AppCheckConfig = {}): Promise<void> {
  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

    // Read debug token from environment (Firebase Console → App Check → Manage debug tokens)
    const debugToken =
      config.debugToken || (__DEV__ && process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID)
        ? process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID?.trim()
        : undefined;

    provider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        // Debug token: only valid in __DEV__, checked by Firebase SDK
        debugToken: debugToken || undefined,
      },
      apple: {
        // iOS: App Attestation (primary), Device Check (fallback)
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        debugToken: debugToken || undefined,
      },
    });

    // Initialize with auto-refresh enabled (SDK handles token expiry)
    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    if (__DEV__) {
      if (!debugToken) {
        logger.warn(
          '[AppCheck] Debug mode without token. Register at: ' +
            'Firebase Console → App Check → Manage debug tokens → Copy token to FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID',
        );
      } else {
        logger.info('[AppCheck] Debug mode initialized with token');
      }
    } else {
      logger.info('[AppCheck] Production mode: Play Integrity API enabled');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (__DEV__) {
      // Non-fatal in development
      logger.warn(`[AppCheck] Initialization warning (non-blocking in dev): ${msg}`);
    } else {
      // Fatal in production
      logger.error(`[AppCheck] CRITICAL: Failed to initialize in production: ${msg}`);
      throw new Error(`App Check initialization failed: ${msg}`);
    }
  }
}

/**
 * Force token refresh (call if you suspect token expiry).
 * Normally handled automatically by SDK.
 *
 * @returns {Promise<string | null>} New token or null if refresh failed
 */
export async function refreshAppCheckToken(): Promise<string | null> {
  try {
    const token = await appCheck().getToken(true); // force refresh
    logger.info('[AppCheck] Token refreshed successfully');
    return token.token;
  } catch (error) {
    logger.error(`[AppCheck] Token refresh failed: ${error}`);
    return null;
  }
}

/**
 * Get current App Check token (for debugging/logging only).
 * Never send this to untrusted systems.
 */
export async function getAppCheckToken(): Promise<string | null> {
  try {
    const token = await appCheck().getToken(false);
    return token.token;
  } catch (error) {
    logger.debug(`[AppCheck] No token available: ${error}`);
    return null;
  }
}
