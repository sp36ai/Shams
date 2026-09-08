/**
 * Cloud Functions entry point — Shams al-Asrar
 *
 * Exported functions:
 *   askWatchOracle           — callable — Digital Watch Oracle reading (no location)
 *   discussReading           — callable — follow-up conversation about a given reading
 *   activateTrial            — callable — idempotent server-side trial registration
 *   getQuota                 — callable — get caller's quota status
 *   syncReadings             — callable — bulk-sync local readings to Firestore
 *   deleteReading            — callable — delete a single reading (owner only)
 *   deleteAccount            — callable — permanently delete the caller's account + data
 *   verifyGooglePlayPurchase — callable — verify IAP, upgrade plan + set custom claims
 *   razorpayWebhook          — HTTP    — Razorpay payment event handler
 *   setAdminClaim            — callable — manage administrative privileges
 *   health                   — HTTP    — readiness/liveness check
 *
 * Auth model:
 *   All callable functions use Firebase Auth (request.auth populated by the SDK).
 *   App Check is enforced in production (enforceAppCheck: true per function).
 *   Plan tier is stored in Firebase custom claims { plan, planExpiry }.
 */

// Shared admin initialisation — must be imported first
import './utils/admin';

export { askWatchOracle } from './functions/askWatchOracle';
export { discussReading } from './functions/discussReading';
export { activateTrial } from './functions/activateTrial';
export { getQuota } from './functions/quota';
export { syncReadings, deleteReading } from './functions/readings';
export { deleteAccount } from './functions/account';
export { verifyGooglePlayPurchase } from './functions/payments/googlePlay';
export { razorpayWebhook } from './functions/payments/razorpay';
export { health } from './functions/health';
export { setAdminClaim } from './functions/admin';
export { classifyQuestion } from './functions/classifyQuestion';
export { inferProfile } from './functions/inferProfile';
// selectRemedies — PHASE 2B: unexported. It was the second, LLM-driven
// remedy-selection authority (see docs/audit/REMEDY_MIGRATION_PLAN.md and
// docs/audit/PHASE_2B_ENGINE_MIGRATION.md); its one client caller was
// disconnected in ReadingScreen.tsx this same phase. Removing the export
// here means the next deploy stops shipping this callable at all — the
// authoritative fix, not just a client-side one. The implementation file
// (functions/src/functions/selectRemedies.ts) is retained on disk,
// deprecated, not deleted — see that file's own header.
