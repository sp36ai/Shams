/**
 * telemetry.ts — Performance monitoring middleware.
 */

import { logger } from '../utils/logger';

/**
 * Wraps a function logic to measure execution duration.
 * Outputs to Cloud Logging for Issue #17 compliance.
 */
export async function measure<T>(name: string, userId: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  logger.info(`perf:${name}`, {
    userId,
    durationMs: Math.round(duration),
  });
  return result;
}
