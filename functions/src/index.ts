/**
 * Cloud Functions entry point — Shams al-Asrar
 *
 * Exported functions:
 *   askOracle                — callable — DEPRECATED, not called by the shipped app;
 *                              see its own file header before removing or building on it
 *   askWatchOracle           — callable — the live Oracle path; compute a Digital Watch
 *                              Oracle reading (no location needed)
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

export { askOracle } from './functions/askOracle';
export { askWatchOracle } from './functions/askWatchOracle';
export { activateTrial } from './functions/activateTrial';
export { getQuota } from './functions/quota';
export { syncReadings, deleteReading } from './functions/readings';
export { deleteAccount } from './functions/account';
export { verifyGooglePlayPurchase } from './functions/payments/googlePlay';
export { razorpayWebhook } from './functions/payments/razorpay';
export { health } from './functions/health';
export { setAdminClaim } from './functions/admin';
export { classifyQuestion } from './functions/classifyQuestion';
export { classifyIntent } from './functions/classifyIntent';
export { inferProfile } from './functions/inferProfile';
export { selectRemedies } from './functions/selectRemedies';
