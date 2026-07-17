/**
 * i18n type contracts — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Two-language scope (locked, do not extend without product sign-off):
 *   - en  : English (LTR, default)
 *   - ur  : Urdu    (RTL, Nastaliq)
 *
 * Hindi is deliberately NOT supported (product decision). Engine narration
 * produces a SEPARATE template per language per verdict — never
 * machine-translated. Strings file shape is identical across languages so
 * TS catches missing keys at compile time (see StringTable type below).
 */

export type LangCode = 'en' | 'ur';

export const LANG_CODES: readonly LangCode[] = ['en', 'ur'];

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
});

export function isValidLang(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as readonly string[]).includes(value);
}

/**
 * Canonical string-table shape. The `en` file is the source of truth; `ur`
 * MUST satisfy `StringTable` so missing keys fail typecheck.
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
    prominentTitle: string;
    prominentBody: string;
  };
  onboarding: {
    bismillah: string;
    enterApp: string;
    q1Eyebrow: string;
    q1Text: string;
    q1c1: string;
    q1c2: string;
    q1c3: string;
    q1c4: string;
    q2Eyebrow: string;
    q2Text: string;
    q2c1: string;
    q2c2: string;
    q2c3: string;
    q2c4: string;
    q3Eyebrow: string;
    q3Text: string;
    q3c1: string;
    q3c2: string;
    q3c3: string;
    q3c4: string;
  };
  auth: {
    signInTab: string;
    signUpTab: string;
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    signIn: string;
    signUp: string;
    orContinueWith: string;
    google: string;
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
    accountCreated: string;
    accountExists: string;
    haveAccount: string;
    noAccount: string;
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
    awaitsHint: string;
    redirectConversational: string;
    redirectAmbiguous: string;
    errSealed: string;
    errQuotaClosed: string;
    errNeedsAuth: string;
    errNeedsVerification: string;
    errChannelInterrupted: string;
    quotaModalBody: string;
    quotaModalDismiss: string;
    quotaUnlockLink: string;
    newQuestionTitle: string;
    newQuestionBody: string;
    disclaimer: string;
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
    narrationLabel: string;
    significatorsLabel: string;
    moonSubLordLabel: string;
    dayLordLabel: string;
    horaLordLabel: string;
    minuteLordLabel: string;
    rpScoreLabel: string;
    horaSuffix: string;
    houseLabel: string;
    avoidLabel: string;
  };
  premium: {
    headerTitleDefault: string;
    headerTitleExpired: string;
    headerSubtitleDefault: string;
    headerSubtitleExpired: string;
    trialBanner: string;
    mureedTitle: string;
    mureedSubtitle: string;
    khassTitle: string;
    khassSubtitle: string;
    billingMonthly: string;
    billingAnnual: string;
    perMonth: string;
    perYear: string;
    annualSaveNote: string;
    mureedFeature1: string;
    mureedFeature2: string;
    mureedFeature3: string;
    mureedFeature4: string;
    mureedFeature5: string;
    khassFeature1: string;
    khassFeature2: string;
    khassFeature3: string;
    khassFeature4: string;
    khassFeature5: string;
    ctaMureed: string;
    ctaKhass: string;
    processing: string;
    restorePurchase: string;
    selectPlanLabel: string;
    billingLabel: string;
    errorTitle: string;
    paymentFailed: string;
    restoreTitle: string;
    noPurchases: string;
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
    dataDeletion: string;
    aboutLabel: string;
    versionLabel: string;
    signOut: string;
    signOutConfirm: string;
    deleteAccount: string;
    deleteAccountAction: string;
    deleteAccountConfirm: string;
    deleteAccountFailed: string;
    resetProfileTitle: string;
    resetProfileBody: string;
    resetProfileAction: string;
    resetProfileButton: string;
    seekerIdentitySection: string;
    yourNameLabel: string;
    yourNamePlaceholder: string;
    motherNameLabel: string;
    motherNamePlaceholder: string;
    identityHint: string;
    readingStatsSection: string;
    planFree: string;
    unlimitedReadings: string;
    questionsUsedToday: string;
    statTotal: string;
    statYes: string;
    statNo: string;
    statCond: string;
  };
  theme: {
    darAlShams: string;
    laylAlBahr: string;
    narAlHadid: string;
    subhAlWahy: string;
    zaytunAlHikma: string;
  };
  errors: {
    network: string;
    unknown: string;
    sessionExpired: string;
    signInFailed: string;
    signUpFailed: string;
    locationRequired: string;
    /** Client lockout countdown — interpolates {{seconds}}. */
    tooManyAttempts: string;
    /** Firebase server-side throttle (no known countdown). */
    tooManyAttemptsWait: string;
  };
}
