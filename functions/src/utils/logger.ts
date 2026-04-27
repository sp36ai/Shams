/**
 * Structured logger — wraps console with severity levels.
 *
 * Security rules:
 *  - Never log raw PII (email, full name, raw question text).
 *  - User IDs are logged because they are opaque UUIDs, not PII by themselves.
 *  - Question text is hashed (FNV-1a) before logging so we can correlate
 *    without storing the actual question.
 */

type Level = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  severity: Uppercase<Level>;
  message: string;
  [key: string]: unknown;
}

/* eslint-disable no-console */
function emit(level: Level, message: string, meta: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    severity: level.toUpperCase() as Uppercase<Level>,
    message,
    ...meta,
  };
  // Firebase Functions automatically picks up structured JSON on stdout.
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
};

/** FNV-1a 32-bit — deterministic one-way hash for question text in logs. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
