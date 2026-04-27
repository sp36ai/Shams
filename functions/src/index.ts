/**
 * Cloud Functions entry point — Shams al-Asrar
 *
 * Exported functions:
 *   askOracle                — callable — compute horary reading (server builds chart)
 *   getQuota                 — callable — get caller's quota status
 *   syncReadings             — callable — bulk-sync local readings to Firestore
 *   deleteReading            — callable — delete a single reading (owner only)
 *   verifyGooglePlayPurchase — callable — verify IAP, upgrade plan + set custom claims
 *   razorpayWebhook          — HTTP    — Razorpay payment event handler
 *
 * Auth model:
 *   All callable functions use Firebase Auth (request.auth populated by the SDK).
 *   App Check is enforced in production (enforceAppCheck: true per function).
 *   Plan tier is stored in Firebase custom claims { plan, planExpiry }.
 */

// Shared admin initialisation — must be imported first
import './utils/admin';

export { askOracle } from './functions/askOracle';
export { getQuota } from './functions/quota';
export { syncReadings, deleteReading } from './functions/readings';
export { verifyGooglePlayPurchase } from './functions/payments/googlePlay';
export { razorpayWebhook } from './functions/payments/razorpay';
