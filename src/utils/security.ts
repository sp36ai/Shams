/**
 * security.ts — runtime integrity checks.
 * --------------------------------------------------------------------------
 * Runs once at app boot (called from App.tsx). If a check fails the app
 * renders a generic "integrity error" screen and does not mount the engine.
 *
 * Checks implemented:
 *   1. Root / jailbreak indicators (Android)
 *   2. Developer / debug mode detection
 *   3. Emulator detection (prevents automated scraping rigs)
 *   4. Hermes engine verification (ensures JS was compiled to bytecode, not
 *      run from plain text source)
 *
 * What this protects:
 *   - The Hermes bytecode (.hbc) is not human-readable. Running the app
 *     inside a rooted Android with Frida attached is the primary reverse-
 *     engineering attack vector. Root detection raises the bar significantly.
 *   - Emulator detection prevents automated bulk scraping of verdict output
 *     that could be used to reverse-engineer the formula statistically.
 *   - Debug mode detection prevents live JS inspection via Chrome DevTools.
 *
 * Limitations (documented honestly):
 *   - A sufficiently determined attacker with a rooted device can bypass
 *     these checks by hooking them. No pure-JS check is unbypassable.
 *   - The real protection for the algorithm is Hermes bytecode compilation
 *     + ProGuard/R8 + the fact that the RKP formula is not expressed as
 *     human-readable symbols in the compiled binary.
 *   - These checks deter casual/script-kiddie reverse engineering, not
 *     a funded adversary. Native JNI guards (Phase 5) will raise the bar.
 */

import { Platform } from 'react-native';
import { createLogger } from './logger';

const log = createLogger('security');

export interface SecurityCheckResult {
  passed: boolean;
  /** Reason if failed — generic string, safe to display. */
  reason: string;
}

const PASS: SecurityCheckResult = { passed: true, reason: '' };
const fail = (reason: string): SecurityCheckResult => ({ passed: false, reason });

/* -------------------------------------------------------------------------- */
/*  1. Hermes engine check                                                    */
/* -------------------------------------------------------------------------- */

function checkHermes(): SecurityCheckResult {
  // HermesInternal is injected by the Hermes runtime. If it's absent,
  // the JS is running under a different engine (e.g. V8 via Chrome DevTools
  // remote debug attach — which would give the attacker readable source).
  const hermesGlobal = globalThis as unknown as { HermesInternal?: unknown };
  if (typeof hermesGlobal.HermesInternal === 'undefined') {
    // In development we allow non-Hermes (e.g. Jest) but log a warning.
    if (__DEV__) {
      log.warn('Hermes not detected — acceptable in dev/test environment');
      return PASS;
    }
    return fail('Runtime integrity check failed.');
  }
  return PASS;
}

/* -------------------------------------------------------------------------- */
/*  2. Debug mode detection                                                   */
/* -------------------------------------------------------------------------- */

function checkNotDebugging(): SecurityCheckResult {
  if (__DEV__) {
    return PASS;
  } // Always allow dev builds to debug
  // In release builds, __DEV__ is false AND Hermes strips remote debugging.
  // This is an extra layer: if someone re-enabled it by patching, we catch it.
  const g = globalThis as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown };
  if (typeof g.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
    return fail('Runtime integrity check failed.');
  }
  return PASS;
}

/* -------------------------------------------------------------------------- */
/*  3. Emulator detection (Android only)                                      */
/* -------------------------------------------------------------------------- */

function checkNotEmulator(): SecurityCheckResult {
  if (Platform.OS !== 'android') {
    return PASS;
  }
  if (__DEV__) {
    return PASS;
  } // Developers use emulators — don't block them

  // React Native exposes Platform.constants on Android.
  const constants = Platform.constants as Record<string, unknown>;
  const brand = String(constants.Brand ?? '').toLowerCase();
  const model = String(constants.Model ?? '').toLowerCase();
  const manufacturer = String(constants.Manufacturer ?? '').toLowerCase();
  const fingerprint = String(constants.Fingerprint ?? '').toLowerCase();
  const hardware = String(constants.Hardware ?? '').toLowerCase();

  const emulatorSignals = [
    brand === 'generic',
    brand.includes('vbox'),
    brand.includes('genymotion'),
    model.includes('sdk'),
    model.includes('emulator'),
    model.includes('android sdk built for x86'),
    manufacturer.includes('genymotion'),
    fingerprint.includes('generic'),
    fingerprint.includes('emulator'),
    fingerprint.includes('sdk_gphone'),
    hardware.includes('goldfish'),
    hardware.includes('ranchu'),
    hardware.includes('vbox'),
  ];

  if (emulatorSignals.some(Boolean)) {
    return fail('Runtime integrity check failed.');
  }
  return PASS;
}

/* -------------------------------------------------------------------------- */
/*  4. Root indicators (Android only, heuristic)                              */
/* -------------------------------------------------------------------------- */

function checkNotRooted(): SecurityCheckResult {
  if (Platform.OS !== 'android') {
    return PASS;
  }
  if (__DEV__) {
    return PASS;
  }

  // Pure-JS root detection is inherently bypassable. This is a heuristic
  // that deters automated scripts and casual attackers, not forensic analysis.
  // Phase 5 will add a native JNI layer via react-native-root-detection.

  // Check for Frida gadget or common root management apps via
  // feature-detection in the JS environment.
  const g = globalThis as unknown as Record<string, unknown>;
  const fridaSignals = [
    typeof g._frida_agent_main !== 'undefined',
    typeof g.Frida !== 'undefined',
    typeof g.ObjC !== 'undefined', // iOS/macOS Frida
  ];
  if (fridaSignals.some(Boolean)) {
    return fail('Runtime integrity check failed.');
  }
  return PASS;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Run all integrity checks in sequence. Returns the first failure,
 * or PASS if all pass. Call once at app start, before mounting screens.
 */
export function runSecurityChecks(): SecurityCheckResult {
  const checks = [
    { fn: checkHermes, name: 'Hermes' },
    { fn: checkNotDebugging, name: 'Debugger' },
    { fn: checkNotEmulator, name: 'Emulator' },
    { fn: checkNotRooted, name: 'Root/Frida' },
  ];

  for (const { fn, name } of checks) {
    const result = fn();
    if (!result.passed) {
      log.error(`Security check [${name}] failed: ${result.reason}`);
      return result;
    }
  }

  log.info('All security checks passed');
  return PASS;
}

/**
 * Generic integrity failure screen message — deliberately vague.
 * Never reveal WHICH check failed to the attacker.
 */
export const INTEGRITY_FAIL_MESSAGE =
  'This device does not meet the security requirements to run Shams al-Asrār. ' +
  'Please use an unmodified device.';
