/**
 * Urdu (ur) — culturally-native string table.
 *
 * NOT a literal translation of en.ts. Tone target: respectful, classical,
 * spiritual register suitable for an oracle product. Phrasing leans Urdu
 * (Persianate vocabulary preferred over Hindi cognates) so a Pakistani /
 * Urdu-speaking diaspora user reads it as native, not as machine-translated.
 *
 * Script: Naskh stored, rendered in Nastaliq via Noto Nastaliq Urdu.
 * Direction: RTL (handled at provider level via I18nManager.forceRTL).
 *
 * Currency in pricing: Indian Rupee symbol ₹ retained per locked decision.
 */

import type { StringTable } from '@i18n/types';

export const ur: StringTable = {
  app: {
    name: 'شمسُ الاسرار',
    tagline: 'بھیدوں کا سورج',
    poweredBy: 'پیشکش: آسٹرو سرفراز',
  },

  common: {
    continue: 'جاری رکھیں',
    cancel: 'منسوخ',
    save: 'محفوظ کریں',
    retry: 'دوبارہ کوشش',
    close: 'بند کریں',
    back: 'واپس',
    skip: 'چھوڑ دیں',
    yes: 'ہاں',
    no: 'نہیں',
    ok: 'ٹھیک ہے',
    loading: 'جاری ہے…',
    error: 'کچھ خرابی ہو گئی',
    pleaseWait: 'براہِ کرم انتظار کیجیے…',
  },

  splash: {
    invocation: 'آسمان سن رہا ہے۔',
  },

  permission: {
    locationTitle: 'آسمان پڑھنے کی اجازت',
    locationRationale:
      'سوال کا چارٹ اُسی لمحے اور اُسی مقام سے باندھا جاتا ہے جہاں سوال پوچھا گیا ہو۔ مقام کے بغیر گھر مقرر نہیں ہو سکتے اور فیصلہ قابلِ اعتبار نہیں رہتا۔ آپ کے مقام کی معلومات اِسی فون میں رہتی ہیں۔',
    grantAccess: 'مقام کی اجازت دیں',
    notNow: 'ابھی نہیں',
    deniedTitle: 'مقام درکار ہے',
    deniedBody:
      'مقام کے بغیر آپ کا پرشنا چارٹ نہیں بن سکتا۔ آپ بعد میں ترتیبات سے اسے فعال کر سکتے ہیں۔',
    openSettings: 'ترتیبات کھولیں',
  },

  auth: {
    signInTab: 'داخل ہوں',
    signUpTab: 'کھاتہ بنائیں',
    email: 'ای میل',
    password: 'پاس ورڈ',
    confirmPassword: 'پاس ورڈ کی تصدیق',
    name: 'پورا نام',
    phone: 'فون نمبر (اختیاری)',
    showPassword: 'پاس ورڈ دکھائیں',
    hidePassword: 'پاس ورڈ چھپائیں',
    forgotPassword: 'پاس ورڈ بھول گئے؟',
    signIn: 'داخل ہوں',
    signUp: 'کھاتہ بنائیں',
    orContinueWith: 'یا اِس سے جاری رکھیں',
    google: 'گوگل',
    facebook: 'فیس بک',
    apple: 'ایپل',
    twitter: 'ایکس',
    languageLabel: 'زبان',
    termsNotice: 'جاری رکھ کر آپ ہماری',
    privacyLink: 'رازداری کی پالیسی',
    termsLink: 'شرائطِ استعمال',
    invalidEmail: 'درست ای میل پتہ درج کریں',
    weakPassword: 'پاس ورڈ کم از کم آٹھ حروف کا ہونا چاہیے',
    passwordMismatch: 'پاس ورڈ مماثل نہیں',
    nameRequired: 'برائے مہربانی اپنا نام درج کریں',
    forgotPasswordTitle: 'پاس ورڈ از سرِ نو ترتیب دیں',
    forgotPasswordBody: 'اپنا ای میل درج کریں، ہم آپ کو بحالی کا ربط بھیج دیں گے۔',
    sendResetLink: 'بحالی کا ربط بھیجیں',
    resetLinkSent: 'بحالی کا ربط آپ کے میل باکس میں بھیج دیا گیا ہے۔',
  },

  oracle: {
    headerTitle: 'شمس کی آواز',
    welcomeMessage:
      'میں شمس ہوں۔ ایک واضح سوال پوچھیں — نکاح، روزگار، صحت، مال، سفر، یا کوئی بھی معاملہ جو آپ کے دل پر بوجھ ہے۔ جس لمحے آپ پوچھتے ہیں، وہی لمحہ چارٹ مقرر کرتا ہے، اور چارٹ ہی فیصلہ کھولتا ہے۔',
    placeholder: 'اپنا سوال لکھیں…',
    sendButton: 'پوچھیں',
    quotaRemaining: 'اِس ہفتے {{count}} سوال باقی ہیں',
    quotaExhausted:
      'اِس ہفتے کے مفت سوالات ختم ہو چکے ہیں۔ بغیر کسی حد کے جاری رکھنے کے لیے اپ گریڈ کریں۔',
    upgradeCta: 'اپ گریڈ',
    enginePending:
      'فیصلہ ساز نظام آسٹرو سرفراز کی نگرانی میں ترتیب پا رہا ہے۔ آپ کا سوال محفوظ کر لیا گیا ہے، اور تنظیم مکمل ہوتے ہی فیصلہ پیش کیا جائے گا۔',
    thinking: 'چارٹ پڑھا جا رہا ہے…',
    askFollowUp: 'مزید پوچھیں',
    askNewQuestion: 'نیا سوال پوچھیں',
    verdictYes: 'ہاں',
    verdictNo: 'نہیں',
    verdictConditional: 'مشروط',
    verdictDelayed: 'تاخیر کے ساتھ',
    verdictUnclear: 'غیر واضح',
    confidenceLabel: 'یقین',
    reasoningLabel: 'وجہ',
    timingLabel: 'وقت',
    remedyLabel: 'تدبیر',
    chartMomentLabel: 'سوال کا لمحہ',
    locationLabel: 'مقام',
  },

  skyClock: {
    headerTitle: 'فلکی گھڑی',
    nowLabel: 'اِس وقت',
    saveWallpaper: 'پسِ منظر کے طور پر محفوظ کریں',
    wallpaperSaved: 'گیلری میں محفوظ ہو گیا',
    wallpaperFailed: 'پسِ منظر محفوظ نہیں ہو سکا',
    horaLabel: 'ہورا',
    moonPhaseLabel: 'چاند',
    ascendantLabel: 'لگن',
  },

  history: {
    headerTitle: 'ماضی کے فیصلے',
    emptyTitle: 'ابھی کوئی فیصلہ نہیں',
    emptyBody: 'آپ کے گزشتہ سوالات اور فیصلے یہاں نظر آئیں گے۔',
    filterAll: 'سب',
    filterYes: 'ہاں',
    filterNo: 'نہیں',
    filterConditional: 'مشروط',
    sortNewest: 'پہلے نئے',
    sortOldest: 'پہلے پرانے',
    deleteConfirm: 'یہ فیصلہ حذف کریں؟ یہ واپس نہیں آ سکتا۔',
    deleteAction: 'حذف کریں',
  },

  premium: {
    headerTitle: 'اپنا راستہ چنیں',
    subheading: 'تین دروازے۔ ایک ہی نظام۔ مختلف گہرائیاں۔',
    tierStarter: 'ابتدائی',
    tierPremium: 'پریمیم',
    tierConsultation: 'مشاورت',
    starterPrice: '₹۲۹۹',
    premiumPrice: '₹۹۹۹',
    consultationPrice: '₹۱،۴۹۹',
    starterPeriod: 'فی ہفتہ',
    premiumPeriod: 'فی ماہ',
    consultationPeriod: 'فی ماہ',
    starterDescription: 'ایک ہفتے کے لیے لامحدود سوالات۔ ایک ہی معاملے کے لیے بہترین۔',
    premiumDescription: 'ہر ماہ لامحدود سوالات، مکمل ماضی، اور تدابیر کی رہنمائی۔',
    consultationDescription:
      'پریمیم کی تمام سہولیات کے ساتھ، حکمت عملی پر مبنی نشستیں، ترجیحی فلکی اوقات، اور پی ڈی ایف رپورٹ۔',
    selectPlan: 'منتخب کریں',
    currentPlan: 'موجودہ منصوبہ',
    moneyBackPromise: '۷ دن میں رقم واپسی کی ضمانت',
    restorePurchase: 'خریداری بحال کریں',
    manageSubscription: 'سبسکرپشن کا انتظام',
    feature_unlimited_questions: 'لامحدود سوالات',
    feature_full_history: 'مکمل ماضی کا ریکارڈ',
    feature_remedies: 'تدابیر کی رہنمائی',
    feature_pdf_export: 'پی ڈی ایف رپورٹ',
    feature_priority_windows: 'ترجیحی فلکی اوقات',
    feature_strategic_sessions: 'حکمت عملی نشستیں',
  },

  settings: {
    headerTitle: 'ترتیبات',
    profileSection: 'پروفائل',
    appearanceSection: 'ظاہری انداز',
    preferencesSection: 'ترجیحات',
    accountSection: 'کھاتہ',
    legalSection: 'قانونی',
    themeLabel: 'تھیم',
    languageLabel: 'زبان',
    notificationsLabel: 'اطلاعات',
    notificationsHint: 'جب فلکی اوقات آپ کے سوالات سے ہم آہنگ ہوں تو یاد دہانی پائیں۔',
    subscriptionLabel: 'سبسکرپشن',
    privacyPolicy: 'رازداری کی پالیسی',
    termsOfService: 'شرائطِ استعمال',
    aboutLabel: 'تعارف',
    versionLabel: 'ورژن',
    signOut: 'باہر نکلیں',
    signOutConfirm: 'شمسُ الاسرار سے باہر نکلیں؟',
  },

  theme: {
    darAlShams: 'دارُ الشمس',
    laylAlBahr: 'لیلُ البحر',
    narAlHadid: 'نارُ الحدید',
    subhAlWahy: 'صبحُ الوحی',
    zaytunAlHikma: 'زیتونُ الحکمہ',
  },

  errors: {
    network: 'انٹرنیٹ موجود نہیں۔ نیٹ ورک دیکھ کر دوبارہ کوشش کریں۔',
    unknown: 'غیر متوقع خرابی پیش آئی۔',
    sessionExpired: 'آپ کا سیشن ختم ہو چکا ہے۔ دوبارہ داخل ہوں۔',
    signInFailed: 'داخلہ ناکام۔ ای میل اور پاس ورڈ دیکھ لیں۔',
    signUpFailed: 'کھاتہ نہیں بن سکا۔ دوبارہ کوشش کریں۔',
    locationRequired: 'چارٹ بنانے کے لیے مقام درکار ہے۔',
  },
};

export default ur;
