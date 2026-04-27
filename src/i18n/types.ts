/**
 * i18n type contracts — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Three-language scope (locked, do not extend without product sign-off):
 *   - en  : English (LTR, default)
 *   - ur  : Urdu    (RTL, Nastaliq)
 *   - hi  : Hindi   (LTR, Devanagari)
 *
 * Engine narration produces three SEPARATE templates per verdict — never
 * machine-translated. Strings file shape is identical across languages so
 * TS catches missing keys at compile time (see StringTable type below).
 */

export type LangCode = 'en' | 'ur' | 'hi';

export const LANG_CODES: readonly LangCode[] = ['en', 'ur', 'hi'];

export const DEFAULT_LANG: LangCode = 'en';

/** Display metadata for the language picker UI */
export interface LangMeta {
  code: LangCode;
  /** Native-script self-name (rendered in picker) */
  nativeName: string;
  /** English label (used in settings analytics) */
  englishName: string;
  /** Layout direction */
  isRTL: boolean;
}

export const LANG_META: Readonly<Record<LangCode, LangMeta>> = Object.freeze({
  en: { code: 'en', nativeName: 'English', englishName: 'English', isRTL: false },
  ur: { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', isRTL: true },
  hi: { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', isRTL: false },
});

export function isValidLang(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as readonly string[]).includes(value);
}

/**
 * Canonical string-table shape. The `en` file is the source of truth; `ur`
 * and `hi` MUST satisfy `StringTable` so missing keys fail typecheck.
 *
 * Grouped by feature surface to keep large tables navigable.
 */
export interface StringTable {
  app: {
    name: string;
    tagline: string;
    poweredBy: string;
  };
  common: {
    continue: string;
    cancel: string;
    save: string;
    retry: string;
    close: string;
    back: string;
    skip: string;
    yes: string;
    no: string;
    ok: string;
    loading: string;
    error: string;
    pleaseWait: string;
  };
  splash: {
    invocation: string;
  };
  permission: {
    locationTitle: string;
    locationRationale: string;
    grantAccess: string;
    notNow: string;
    deniedTitle: string;
    deniedBody: string;
    openSettings: string;
  };
  auth: {
    signInTab: string;
    signUpTab: string;
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    phone: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    signIn: string;
    signUp: string;
    orContinueWith: string;
    google: string;
    facebook: string;
    apple: string;
    twitter: string;
    languageLabel: string;
    termsNotice: string;
    privacyLink: string;
    termsLink: string;
    invalidEmail: string;
    weakPassword: string;
    passwordMismatch: string;
    nameRequired: string;
    forgotPasswordTitle: string;
    forgotPasswordBody: string;
    sendResetLink: string;
    resetLinkSent: string;
  };
  oracle: {
    headerTitle: string;
    welcomeMessage: string;
    placeholder: string;
    sendButton: string;
    quotaRemaining: string;
    quotaExhausted: string;
    upgradeCta: string;
    enginePending: string;
    thinking: string;
    askFollowUp: string;
    askNewQuestion: string;
    verdictYes: string;
    verdictNo: string;
    verdictConditional: string;
    verdictDelayed: string;
    verdictUnclear: string;
    confidenceLabel: string;
    reasoningLabel: string;
    timingLabel: string;
    remedyLabel: string;
    chartMomentLabel: string;
    locationLabel: string;
  };
  skyClock: {
    headerTitle: string;
    nowLabel: string;
    saveWallpaper: string;
    wallpaperSaved: string;
    wallpaperFailed: string;
    horaLabel: string;
    moonPhaseLabel: string;
    ascendantLabel: string;
  };
  history: {
    headerTitle: string;
    emptyTitle: string;
    emptyBody: string;
    filterAll: string;
    filterYes: string;
    filterNo: string;
    filterConditional: string;
    sortNewest: string;
    sortOldest: string;
    deleteConfirm: string;
    deleteAction: string;
  };
  premium: {
    headerTitle: string;
    subheading: string;
    tierStarter: string;
    tierPremium: string;
    tierConsultation: string;
    starterPrice: string;
    premiumPrice: string;
    consultationPrice: string;
    starterPeriod: string;
    premiumPeriod: string;
    consultationPeriod: string;
    starterDescription: string;
    premiumDescription: string;
    consultationDescription: string;
    selectPlan: string;
    currentPlan: string;
    moneyBackPromise: string;
    restorePurchase: string;
    manageSubscription: string;
    feature_unlimited_questions: string;
    feature_full_history: string;
    feature_remedies: string;
    feature_pdf_export: string;
    feature_priority_windows: string;
    feature_strategic_sessions: string;
  };
  settings: {
    headerTitle: string;
    profileSection: string;
    appearanceSection: string;
    preferencesSection: string;
    accountSection: string;
    legalSection: string;
    themeLabel: string;
    languageLabel: string;
    notificationsLabel: string;
    notificationsHint: string;
    subscriptionLabel: string;
    privacyPolicy: string;
    termsOfService: string;
    aboutLabel: string;
    versionLabel: string;
    signOut: string;
    signOutConfirm: string;
  };
  theme: {
    teal: string;
    midnightGold: string;
    royalViolet: string;
    crimsonDusk: string;
    arcticSilver: string;
  };
  errors: {
    network: string;
    unknown: string;
    sessionExpired: string;
    signInFailed: string;
    signUpFailed: string;
    locationRequired: string;
  };
}
