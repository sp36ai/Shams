/**
 * MMKV storage — single shared instance for the whole app.
 * --------------------------------------------------------------------------
 * Why one instance, not per-domain:
 *   - MMKV is fast (<1ms reads) but each instance opens its own mmap file.
 *     Multiple instances inflate APK install footprint and cold-start I/O.
 *   - Namespacing is done via key prefixes (see KEYS below) — same effect,
 *     one file.
 *
 * Persistence semantics relied on by Zustand stores:
 *   - getString(key) returns string | undefined  (NEVER null)
 *   - set(key, value) is synchronous and durable on next event loop tick
 *   - delete(key) is synchronous
 */

import { MMKV } from 'react-native-mmkv';

/** Singleton store. Do NOT instantiate MMKV elsewhere. */
export const storage = new MMKV({
  id: 'shams-default',
});

/**
 * Namespaced key registry. Every persisted key in the app MUST be declared
 * here so we have one place to audit storage shape during migrations.
 *
 * Convention: <domain>.<field>
 * Versioning: bump suffix (e.g. `auth.session.v2`) when shape changes.
 */
export const KEYS = Object.freeze({
  // Settings domain
  SETTINGS_THEME: 'settings.themeId.v1',
  SETTINGS_LANG: 'settings.lang.v1',

  // Readings cache (most-recent N readings for offline open of History)
  READINGS_CACHE: 'readings.cache.v1',

  // Onboarding flags
  ONBOARDING_SEEN: 'onboarding.seen.v1',
  ONBOARDING_LOCATION_PROMPTED: 'onboarding.locationPrompted.v1',
  ONBOARDING_PERMISSION_GRANTED: 'onboarding.permissionGranted.v1',

  // Last known location (for chart construction fallback if GPS slow)
  LOCATION_LAST_LAT: 'location.lastLat.v1',
  LOCATION_LAST_LON: 'location.lastLon.v1',
  LOCATION_LAST_LABEL: 'location.lastLabel.v1',
  LOCATION_LAST_TIMESTAMP: 'location.lastTimestamp.v1',

  // Quota domain
  QUOTA_WEEK: 'quota.week.v1',
  QUOTA_COUNT: 'quota.count.v1',
  QUOTA_PLAN: 'quota.plan.v1',
  QUOTA_PLAN_EXPIRY: 'quota.planExpiry.v1',
  TRIAL_START: 'shams_trial_start',

  // Auth domain
  AUTH_USER_ID: 'auth.userId.v1',
  AUTH_USER_NAME: 'auth.userName.v1',
  AUTH_USER_EMAIL: 'auth.userEmail.v1',
} as const);

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
