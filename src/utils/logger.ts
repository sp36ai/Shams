/**
 * Logger — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Thin wrapper around `console` with three guarantees:
 *
 *   1. Production builds (`__DEV__ === false`) suppress `debug` and `info`.
 *      Only `warn` and `error` survive minification — keeps logcat clean
 *      and prevents leaking PII (email, GPS, question text) into device
 *      logs visible to other apps via `adb logcat -d`.
 *
 *   2. Every log line is namespaced (`[Shams][<scope>]`) so engineers
 *      filtering with `adb logcat *:S ReactNativeJS:V | grep Shams` can
 *      isolate our output from the dozens of RN noise lines per second.
 *
 *   3. Errors carry a structured payload that downstream telemetry
 *      (Sentry/Crashlytics, wired in Phase 5) can ingest as breadcrumbs
 *      without a rewrite — see `LogPayload` shape below.
 *
 * Why not a full logging library (winston, bunyan, react-native-logs)?
 *   - +400 KB JS bundle for what is fundamentally `console.log` with a tag.
 *   - Most pull in Node-only deps that crash on Hermes.
 *   - We re-evaluate at Phase 5 when telemetry SDK lands.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured payload attached to every log line.
 * Keys deliberately match Sentry breadcrumb shape (category/message/data/level)
 * so the Phase 5 telemetry adapter is a one-line transform, not a rewrite.
 */
export interface LogPayload {
  /** Free-form structured data — never include raw user text or coordinates */
  [key: string]: unknown;
}

// ── Build-time gate ────────────────────────────────────────────────────────
// `__DEV__` is injected by Metro's babel-plugin-transform-define. In release
// bundles it constant-folds to `false` and dead-code-eliminates the debug
// branches, so production APKs ship with zero console noise.
declare const __DEV__: boolean;

const isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

// Min level to emit, by build mode.
const MIN_LEVEL: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const PROD_THRESHOLD = MIN_LEVEL.warn;

function shouldEmit(level: LogLevel): boolean {
  if (isDev) {
    return true;
  }
  return MIN_LEVEL[level] >= PROD_THRESHOLD;
}

function format(scope: string, message: string): string {
  const timestamp = isDev ? `[${new Date().toLocaleTimeString()}]` : '';
  return `[Shams]${timestamp}[${scope}] ${message}`;
}

/**
 * Scoped logger factory. Pass a stable scope name once, get a logger that
 * tags every line. Recommended pattern at the top of each module:
 *
 *     import { createLogger } from '@utils/logger';
 *     const log = createLogger('AuthStore');
 *     log.debug('Bootstrapping session…', { hasPersisted: true });
 */
/* eslint-disable no-console */
export function createLogger(scope: string) {
  return {
    debug(message: string, payload?: LogPayload): void {
      if (!shouldEmit('debug')) {
        return;
      }

      if (payload) {
        console.log(format(scope, message), payload);
      } else {
        console.log(format(scope, message));
      }
    },

    info(message: string, payload?: LogPayload): void {
      if (!shouldEmit('info')) {
        return;
      }

      if (payload) {
        console.info(format(scope, message), payload);
      } else {
        console.info(format(scope, message));
      }
    },

    warn(message: string, payload?: LogPayload): void {
      if (!shouldEmit('warn')) {
        return;
      }

      if (payload) {
        console.warn(format(scope, message), payload);
      } else {
        console.warn(format(scope, message));
      }
    },

    /**
     * Errors always emit. Accepts an `Error` *or* a string + payload — both
     * common patterns are explicitly supported so callers don't have to
     * remember which one to use.
     */
    error(messageOrError: string | Error, payload?: LogPayload): void {
      const out: LogPayload = { ...(payload ?? {}) };
      let message: string;

      if (messageOrError instanceof Error) {
        message = messageOrError.message;
        out.name = messageOrError.name;
        out.stack = messageOrError.stack;
      } else {
        message = messageOrError;
      }

      console.error(format(scope, message), out);
    },

    /**
     * Records a breadcrumb for Phase 5 Telemetry.
     * In DEV, it logs to console. In PROD, it buffers for Sentry.
     */
    breadcrumb(message: string, category: string, data?: LogPayload): void {
      const breadcrumb = {
        message,
        category: `${scope}:${category}`,
        data,
        level: 'info' as LogLevel,
        timestamp: Date.now() / 1000,
      };

      // Placeholder for Phase 5: Sentry.addBreadcrumb(breadcrumb);
      if (isDev) {
        this.debug(`[Breadcrumb] ${category}: ${message}`, data);
      }
    },
  };
}

/** Shortcut singleton for one-off logs from places without a clear scope. */
export const log = createLogger('app');

export default createLogger;
