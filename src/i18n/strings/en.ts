/**
 * English (en) — source of truth string table.
 * Every other language file (ur.ts, hi.ts) MUST satisfy `StringTable` against
 * this shape. Add a new key here first, then in the other languages.
 */

import type { StringTable } from '@i18n/types';

export const en: StringTable = {
  app: {
    name: 'Shams al-Asrar',
    tagline: 'Sacred Horary Oracle',
    poweredBy: 'Powered by Astro Sarfaraz',
  },

  common: {
    continue: 'Continue',
    cancel: 'Cancel',
    save: 'Save',
    retry: 'Retry',
    close: 'Close',
    back: 'Back',
    skip: 'Skip',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    loading: 'Loading…',
    error: 'Something went wrong',
    pleaseWait: 'Please wait…',
  },

  splash: {
    invocation: 'Chart the exact moment. Judge the exact question.',
  },

  permission: {
    locationTitle: 'Location for chart judgment',
    locationRationale:
      'Celestial counsel depends on the exact moment and place of the question. Without location, the heavens cannot be read for your precise position and the judgment cannot be trusted. Your coordinates stay on this device.',
    grantAccess: 'Grant location access',
    notNow: 'Not now',
    deniedTitle: 'Location is required',
    deniedBody:
      'Without location, the app cannot cast a reliable horary chart. You can enable it later in system settings.',
    openSettings: 'Open Settings',
  },

  auth: {
    signInTab: 'Sign In',
    signUpTab: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    name: 'Full name',
    phone: 'Phone (optional)',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign In',
    signUp: 'Create Account',
    orContinueWith: 'or continue with',
    google: 'Google',
    facebook: 'Facebook',
    apple: 'Apple',
    twitter: 'X',
    languageLabel: 'Language',
    termsNotice: 'By continuing, you agree to our',
    privacyLink: 'Privacy Policy',
    termsLink: 'Terms of Service',
    invalidEmail: 'Enter a valid email address',
    weakPassword: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    nameRequired: 'Please enter your name',
    forgotPasswordTitle: 'Reset your password',
    forgotPasswordBody: 'Enter your email and we will send you a reset link.',
    sendResetLink: 'Send reset link',
    resetLinkSent: 'Check your inbox for a reset link.',
  },

  oracle: {
    headerTitle: 'Shams al-Asrār',
    welcomeMessage:
      'Ask one clear question. The heavens will be read for the exact moment and place of asking, and the oracle will deliver its celestial counsel.',
    placeholder: 'Type your question…',
    sendButton: 'Ask',
    quotaRemaining: '{{count}} questions remaining this week',
    quotaExhausted:
      'Your free questions for this week are used. Upgrade to continue without limits.',
    upgradeCta: 'Upgrade',
    enginePending:
      'The judgment engine is being calibrated by Astro Sarfaraz. Your question has been received and a verdict will be available once calibration is complete.',
    thinking: 'Reading the chart…',
    askFollowUp: 'Ask a follow-up',
    askNewQuestion: 'Ask a new question',
    verdictYes: 'YES',
    verdictNo: 'NO',
    verdictConditional: 'CONDITIONAL',
    verdictDelayed: 'DELAYED',
    verdictUnclear: 'UNCLEAR',
    confidenceLabel: 'Confidence',
    reasoningLabel: 'Why',
    timingLabel: 'When',
    remedyLabel: 'Remedy',
    chartMomentLabel: 'Moment of question',
    locationLabel: 'Location',
  },

  skyClock: {
    headerTitle: 'Sky Clock',
    nowLabel: 'Now',
    saveWallpaper: 'Save as wallpaper',
    wallpaperSaved: 'Saved to your gallery',
    wallpaperFailed: 'Could not save wallpaper',
    horaLabel: 'Hora',
    moonPhaseLabel: 'Moon',
    ascendantLabel: 'Ascendant',
  },

  history: {
    headerTitle: 'Readings',
    emptyTitle: 'No readings yet',
    emptyBody: 'Your readings will appear here.',
    filterAll: 'All',
    filterYes: 'Yes',
    filterNo: 'No',
    filterConditional: 'Conditional',
    sortNewest: 'Newest first',
    sortOldest: 'Oldest first',
    deleteConfirm: 'Delete this reading? This cannot be undone.',
    deleteAction: 'Delete',
  },

  premium: {
    headerTitle: 'Choose Your Path',
    subheading: 'Two doors. Same oracle. Different depth.',
    tierStarter: 'Mureed',
    tierPremium: 'Khass',
    tierConsultation: 'Khass Annual',
    starterPrice: '₹249',
    premiumPrice: '₹699',
    consultationPrice: '₹6,990',
    starterPeriod: 'per month',
    premiumPeriod: 'per month',
    consultationPeriod: 'per year',
    starterDescription:
      '3 questions per day, single oracle mode access. Perfect for regular seekers.',
    premiumDescription:
      'Unlimited questions, both oracle modes, exportable reports, reading archive, direct feedback channel.',
    consultationDescription:
      'Everything in Khass at an annual rate, with 2 months free.',
    selectPlan: 'Select',
    currentPlan: 'Current path',
    moneyBackPromise: '7-day free trial',
    restorePurchase: 'Restore purchase',
    manageSubscription: 'Manage subscription',
    feature_unlimited_questions: 'Unlimited questions',
    feature_full_history: 'Full reading archive',
    feature_remedies: 'Spiritual remedies',
    feature_pdf_export: 'Exportable reports',
    feature_priority_windows: 'Both oracle modes',
    feature_strategic_sessions: 'Direct feedback channel',
  },

  settings: {
    headerTitle: 'Settings',
    profileSection: 'Profile',
    appearanceSection: 'Appearance',
    preferencesSection: 'Preferences',
    accountSection: 'Account',
    legalSection: 'Legal',
    themeLabel: 'Theme',
    languageLabel: 'Language',
    notificationsLabel: 'Notifications',
    notificationsHint: 'Get reminders when planetary windows align with your questions.',
    subscriptionLabel: 'Subscription',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    aboutLabel: 'About',
    versionLabel: 'Version',
    signOut: 'Sign Out',
    signOutConfirm: 'Sign out of Shams al-Asrar?',
  },

  theme: {
    teal: 'Teal',
    midnightGold: 'Midnight Gold',
    royalViolet: 'Royal Violet',
    crimsonDusk: 'Crimson Dusk',
    arcticSilver: 'Arctic Silver',
  },

  errors: {
    network: 'No internet connection. Check your network and try again.',
    unknown: 'An unexpected error occurred.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    signInFailed: 'Sign-in failed. Check your email and password.',
    signUpFailed: 'We could not create your account. Try again.',
    locationRequired: 'Location is required to cast the chart and judge the question.',
  },
};

export default en;
