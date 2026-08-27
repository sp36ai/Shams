/**
 * i18n type contracts — Shams al-Asrār
 * --------------------------------------------------------------------------
 * Three-language scope (locked, do not extend without product sign-off):
 *   - en  : English (LTR, default)          — active
 *   - ur  : Urdu    (RTL, Nastaliq)         — active
 *   - hi  : Hindi   (LTR, Devanagari)       — frozen (see below)
 *
 * Engine narration produces SEPARATE templates per verdict — never
 * machine-translated. Strings file shape is identical across languages so
 * TS catches missing keys at compile time (see StringTable type below).
 *
 * Maintenance status (product decision, not a technical limit):
 *   As the product focuses on its Urdu/Arabic-speaking audience, Hindi is
 *   FROZEN rather than removed. Concretely:
 *     - `hi` remains a valid LangCode. Persisted 'hi' in MMKV still loads,
 *       still renders, and is never silently rewritten. No user data breaks.
 *     - `hi.ts` is kept at its current coverage. New keys are NOT translated
 *       into it; they fall through to English via I18nProvider's fallback.
 *     - The Settings picker offers only ACTIVE languages to new users, but
 *       still shows a frozen language to a user already on it, so they keep
 *       a visible control and can switch away.
 *   To thaw a language, flip its `status` back to 'active' and backfill the
 *   missing keys — nothing else needs to change.
 */

export type LangCode = 'en' | 'ur' | 'hi';

export const LANG_CODES: readonly LangCode[] = ['en', 'ur', 'hi'];

export const DEFAULT_LANG: LangCode = 'en';

/**
 * Translation-maintenance state.
 *   'active' — kept in sync with `en`; offered to everyone in the picker.
 *   'frozen' — kept working, no longer backfilled; offered only to users
 *              already on it. New strings fall back to English.
 */
export type LangStatus = 'active' | 'frozen';

/** Display metadata for the language picker UI */
export interface LangMeta {
  code: LangCode;
  /** Native-script self-name (rendered in picker) */
  nativeName: string;
  /** English label (used in settings analytics) */
  englishName: string;
  /** Layout direction */
  isRTL: boolean;
  /** Translation-maintenance state. Drives picker prominence — see file header. */
  status: LangStatus;
}

export const LANG_META: Readonly<Record<LangCode, LangMeta>> = Object.freeze({
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    isRTL: false,
    status: 'active',
  },
  ur: { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', isRTL: true, status: 'active' },
  hi: {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    isRTL: false,
    status: 'frozen',
  },
});

export function isValidLang(value: unknown): value is LangCode {
  return typeof value === 'string' && (LANG_CODES as readonly string[]).includes(value);
}

/**
 * Codes a language picker should render, in canonical order.
 *
 * Active languages always. A frozen language appears ONLY when it is the
 * user's current one — so existing speakers keep a working, visible control
 * (and a way out), while new users are never offered a frozen language.
 */
export function languagePickerCodes(current: LangCode): readonly LangCode[] {
  return LANG_CODES.filter(code => LANG_META[code].status === 'active' || code === current);
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
  nav: {
    homeTab: string;
    alFalakTab: string;
    readingsTab: string;
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
    verdictYes: string;
    verdictNo: string;
    verdictConditional: string;
    verdictDelayed: string;
    verdictUnclear: string;
    confidenceLabel: string;
    reasoningLabel: string;
    timingLabel: string;
    remedyLabel: string;
    dailySkyTitle: string;
    askShamsCta: string;
    moonWatchTitle: string;
    voidOfCourseBanner: string;
    sunriseLabel: string;
    sunsetLabel: string;
    favoredNowTitle: string;
    favoredNowBody: string;
    dailyDhikrTitle: string;
    dailyDhikrRecite: string;
    blessingTitle: string;
    currentHoraLabel: string;
    remainingLabel: string;
    todaysQuotaLabel: string;
    yourTierLabel: string;
    tierWanderer: string;
    askNewQuestionCta: string;
    /** Home composer — the line above the field, and the field's own hint. */
    askPrompt: string;
    askPlaceholder: string;
    consultOracleSubtitle: string;
    readingHistoryCta: string;
    viewPastReadingsSubtitle: string;
    moonManzilTitle: string;
    rulingPlanetsNowLabel: string;
    currentHoraLordLabel: string;
  };
  oracleChat: {
    headerTitle: string;
    placeholder: string;
    listening: string;
    send: string;
    voiceInputTag: string;
    startRecording: string;
    stopRecording: string;
    readingChart: string;
    retry: string;
    failedGeneric: string;
    quotaExhausted: string;
    micPermissionDenied: string;
    noSpeechDetected: string;
    errorTimeout: string;
    errorSignIn: string;
    listenToVerdict: string;
    playNarration: string;
    pauseNarration: string;
    speaking: string;
    paused: string;
    emptyTitle: string;
    emptyBody: string;
    /** Send-button label while the composer is in discussion mode. */
    reply: string;
    /** Pending-bubble caption for a follow-up — no chart is being read. */
    considering: string;
    modeDiscuss: string;
    modeNewQuestion: string;
    placeholderDiscuss: string;
    askAsNewQuestion: string;
    discussionUnavailable: string;
    discussionReadingGone: string;
  };
  /** One Reading — its header, its actions, its states. */
  reading: {
    sectionLabel: string;
    yourQuestion: string;
    newReading: string;
    shareReading: string;
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
    /** Your Readings — search, grouping and empty states. */
    searchPlaceholder: string;
    noResults: string;
    newReading: string;
    beginReading: string;
    groupToday: string;
    groupYesterday: string;
    groupPrevious7: string;
    groupPrevious30: string;
    groupOlder: string;
    pendingReading: string;
    failedReading: string;
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
    /** Shown under the picker when the active language is frozen (see LangStatus). */
    languageFrozenNotice: string;
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
