// Feature flags for dev/QA toggles. Defaults must be safe for production.
// Do NOT enable any of these in production builds. Toggle only in local/dev
// builds for QA purposes.

export const FEATURE_FLAGS = Object.freeze({
  // When true (development only), keep legacy ReadingDetailModal reachable
  // from the History screen for QA comparisons. Default: false.
  ENABLE_LEGACY_READING_MODAL: false,
});
