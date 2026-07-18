/**
 * analytics.ts — thin wrapper over Firebase Analytics.
 *
 * Firebase Analytics auto-collects baseline events (first_open, session_start,
 * app_open). This module adds the product funnel events we care about:
 * paywall views, plan purchases, and oracle asks. Every call is best-effort —
 * analytics must never throw into a product code path.
 *
 * Custom event names avoid Firebase's reserved names (e.g. `purchase`,
 * `screen_view`) which would be rejected by logEvent.
 */

import analytics from '@react-native-firebase/analytics';
import { createLogger } from '@utils/logger';

const log = createLogger('analytics');

type EventParams = Record<string, string | number | boolean>;

export async function logEvent(name: string, params?: EventParams): Promise<void> {
  try {
    await analytics().logEvent(name, params);
  } catch (e) {
    log.warn('logEvent failed', { name, err: String(e) });
  }
}

/** User viewed the paywall. `source` = where it was opened from. */
export function logPaywallView(source: string): void {
  void logEvent('paywall_viewed', { source });
}

/** A subscription was verified and the plan granted. */
export function logPlanPurchased(plan: string): void {
  void logEvent('plan_purchased', { plan });
}

/** A completed oracle reading (server verdict returned). */
export function logOracleAsked(category: string, verdict: string): void {
  void logEvent('oracle_asked', { category, verdict });
}
