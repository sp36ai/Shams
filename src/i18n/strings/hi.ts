/**
 * Hindi (hi) — culturally-native string table.
 *
 * NOT a literal translation of en.ts. Tone target: respectful, classical,
 * jyotiṣa-aware register. Sanskrit-derived vocabulary preferred over English
 * loanwords where the spiritual register reads better in Devanagari.
 *
 * Script: Devanagari, rendered via Noto Sans Devanagari.
 * Direction: LTR.
 *
 * Currency: ₹ (Indian Rupee, locked decision).
 */

import type { StringTable } from '@i18n/types';

export const hi: StringTable = {
  app: {
    name: 'शम्सुल असरार',
    tagline: 'दिव्य मार्गदर्शन का ज्योतिष ओरेकल',
    poweredBy: 'प्रस्तुति: एस्ट्रो सरफ़राज़',
  },

  common: {
    continue: 'जारी रखें',
    cancel: 'रद्द करें',
    save: 'सहेजें',
    retry: 'पुनः प्रयास',
    close: 'बंद करें',
    back: 'वापस',
    skip: 'छोड़ें',
    yes: 'हाँ',
    no: 'नहीं',
    ok: 'ठीक है',
    loading: 'लोड हो रहा है…',
    error: 'कुछ त्रुटि हुई',
    pleaseWait: 'कृपया प्रतीक्षा करें…',
  },

  splash: {
    invocation: 'आकाश सुन रहा है।',
  },

  nav: {
    homeTab: 'होम',
    askTab: 'पूछें',
    alFalakTab: 'अल-फ़लक',
    historyTab: 'रीडिंग',
  },

  permission: {
    locationTitle: 'आकाश पढ़ने की अनुमति',
    locationRationale:
      'प्रश्न-कुंडली उसी क्षण और उसी स्थान पर बंधी होती है जहाँ प्रश्न पूछा गया हो। बिना स्थान के भाव-कुस्प स्थापित नहीं हो सकते और निर्णय विश्वसनीय नहीं रहता। आपके निर्देशांक केवल इसी फ़ोन में रहते हैं।',
    grantAccess: 'स्थान की अनुमति दें',
    notNow: 'अभी नहीं',
    deniedTitle: 'स्थान आवश्यक है',
    deniedBody:
      'बिना स्थान के आपकी प्रश्न-कुंडली नहीं बन सकती। आप बाद में सेटिंग्स से इसे चालू कर सकते हैं।',
    openSettings: 'सेटिंग्स खोलें',
  },

  auth: {
    signInTab: 'साइन इन',
    signUpTab: 'खाता बनाएँ',
    email: 'ईमेल',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि',
    name: 'पूरा नाम',
    showPassword: 'पासवर्ड दिखाएँ',
    hidePassword: 'पासवर्ड छिपाएँ',
    forgotPassword: 'पासवर्ड भूल गए?',
    signIn: 'साइन इन',
    signUp: 'खाता बनाएँ',
    orContinueWith: 'या इससे जारी रखें',
    google: 'गूगल',
    languageLabel: 'भाषा',
    termsNotice: 'जारी रखकर आप हमारी',
    privacyLink: 'गोपनीयता नीति',
    termsLink: 'सेवा-शर्तें',
    invalidEmail: 'सही ईमेल पता दर्ज करें',
    weakPassword: 'पासवर्ड कम से कम आठ अक्षरों का होना चाहिए',
    passwordMismatch: 'पासवर्ड मेल नहीं खाते',
    nameRequired: 'कृपया अपना नाम दर्ज करें',
    forgotPasswordTitle: 'पासवर्ड पुनः सेट करें',
    forgotPasswordBody: 'अपना ईमेल दर्ज करें, हम आपको पुनःसेट लिंक भेजेंगे।',
    sendResetLink: 'पुनःसेट लिंक भेजें',
    resetLinkSent:
      'पुनःसेट लिंक आपके इनबॉक्स में भेजा जा रहा है। उस पर जाकर नया पासवर्ड सेट करें, फिर यहाँ लौटकर साइन इन करें।',
    accountCreated: 'आपका खाता अंकित हो गया। शम्स आपकी प्रतीक्षा में है।',
    accountExists: 'यह ईमेल पहले से हमारे साथ है। जारी रखने के लिए साइन इन करें।',
    haveAccount: 'पहले से साधकों में शामिल हैं? ',
    noAccount: 'शम्स में नए हैं? ',
  },

  oracle: {
    headerTitle: 'शम्स की वाणी',
    welcomeMessage:
      'मैं शम्स हूँ। एक स्पष्ट प्रश्न पूछिए — विवाह, करियर, स्वास्थ्य, धन, यात्रा, या कोई भी विषय जो आपके मन पर भार है। प्रश्न का क्षण ही कुंडली निर्धारित करता है, और कुंडली ही निर्णय खोलती है।',
    placeholder: 'अपना प्रश्न लिखें…',
    sendButton: 'पूछें',
    quotaRemaining: 'इस सप्ताह {{count}} प्रश्न शेष',
    quotaExhausted:
      'इस सप्ताह के निःशुल्क प्रश्न समाप्त हो चुके हैं। बिना सीमा जारी रखने के लिए अपग्रेड करें।',
    upgradeCta: 'अपग्रेड',
    enginePending:
      'निर्णय-तंत्र एस्ट्रो सरफ़राज़ की निगरानी में संरेखित किया जा रहा है। आपका प्रश्न प्राप्त हो गया है, और संरेखण पूर्ण होते ही निर्णय प्रस्तुत किया जाएगा।',
    thinking: 'कुंडली पढ़ी जा रही है…',
    askFollowUp: 'और पूछें',
    askNewQuestion: 'नया प्रश्न पूछें',
    verdictYes: 'हाँ',
    verdictNo: 'नहीं',
    verdictConditional: 'सशर्त',
    verdictDelayed: 'विलंब से',
    verdictUnclear: 'अस्पष्ट',
    confidenceLabel: 'विश्वास',
    reasoningLabel: 'कारण',
    timingLabel: 'समय',
    remedyLabel: 'उपाय',
    chartMomentLabel: 'प्रश्न का क्षण',
    locationLabel: 'स्थान',
    dailySkyTitle: 'आज का आकाश आपके लिए',
    askShamsCta: 'शम्स से पूछें',
    moonWatchTitle: 'चंद्र निगरानी',
    voidOfCourseBanner:
      'चंद्रमा {{time}} तक निष्प्रभावी (void of course) है — ओरेकल नए प्रश्न के लिए प्रतीक्षा को प्राथमिकता देता है।',
    sunriseLabel: 'सूर्योदय',
    sunsetLabel: 'सूर्यास्त',
    favoredNowTitle: 'अभी अनुकूल',
    favoredNowBody: 'यह घड़ी अनुकूल है:',
    dailyDhikrTitle: 'आज का ज़िक्र',
    dailyDhikrRecite: 'पढ़ें',
    blessingTitle: 'आज की बरकत',
    currentHoraLabel: 'वर्तमान होरा',
    remainingLabel: 'शेष',
    todaysQuotaLabel: 'आज का कोटा',
    yourTierLabel: 'आपका स्तर',
    tierWanderer: 'साधक',
    askNewQuestionCta: 'नया प्रश्न पूछें',
    consultOracleSubtitle: 'ओरेकल से परामर्श करें',
    readingHistoryCta: 'पिछली रीडिंग',
    viewPastReadingsSubtitle: 'अपनी पिछली रीडिंग देखें',
    moonManzilTitle: 'मंज़िल-ए-क़मर',
    askQuestionTitle: 'अपना प्रश्न पूछें',
    chartCastSubtitle: 'चार्ट इसी क्षण के लिए तैयार किया जा रहा है।',
    rulingPlanetsNowLabel: 'वर्तमान शासक ग्रह',
    currentHoraLordLabel: 'वर्तमान होरा स्वामी',
    sealAskCta: 'मुहर लगाएँ और ओरेकल से पूछें',
  },

  skyClock: {
    headerTitle: 'आकाश-घटिका',
    nowLabel: 'अभी',
    saveWallpaper: 'वॉलपेपर के रूप में सहेजें',
    wallpaperSaved: 'गैलरी में सहेजा गया',
    wallpaperFailed: 'वॉलपेपर सहेजा नहीं जा सका',
    horaLabel: 'होरा',
    moonPhaseLabel: 'चंद्र',
    ascendantLabel: 'लग्न',
  },

  history: {
    headerTitle: 'पूर्व निर्णय',
    emptyTitle: 'अभी कोई निर्णय नहीं',
    emptyBody: 'आपके पिछले प्रश्न और निर्णय यहाँ दिखेंगे।',
    filterAll: 'सभी',
    filterYes: 'हाँ',
    filterNo: 'नहीं',
    filterConditional: 'सशर्त',
    sortNewest: 'नए पहले',
    sortOldest: 'पुराने पहले',
    deleteConfirm: 'इस निर्णय को हटाएँ? यह वापस नहीं आएगा।',
    deleteAction: 'हटाएँ',
  },

  premium: {
    headerTitle: 'अपना मार्ग चुनें',
    subheading: 'तीन द्वार। एक ही तंत्र। भिन्न गहराई।',
    tierStarter: 'प्रारंभिक',
    tierPremium: 'प्रीमियम',
    tierConsultation: 'परामर्श',
    starterPrice: '₹299',
    premiumPrice: '₹999',
    consultationPrice: '₹1,499',
    starterPeriod: 'प्रति सप्ताह',
    premiumPeriod: 'प्रति माह',
    consultationPeriod: 'प्रति माह',
    starterDescription: 'एक सप्ताह के लिए असीमित प्रश्न। एक विषय के लिए उत्तम।',
    premiumDescription: 'हर माह असीमित प्रश्न, पूर्ण इतिहास, और उपाय-मार्गदर्शन।',
    consultationDescription:
      'प्रीमियम की सभी सुविधाओं के साथ रणनीतिक बहु-प्रश्न सत्र, प्राथमिक ग्रह-काल, और पीडीएफ रिपोर्ट।',
    selectPlan: 'चुनें',
    currentPlan: 'वर्तमान योजना',
    moneyBackPromise: '7 दिन में धन-वापसी',
    restorePurchase: 'खरीद पुनःस्थापित करें',
    manageSubscription: 'सदस्यता प्रबंधन',
    feature_unlimited_questions: 'असीमित प्रश्न',
    feature_full_history: 'पूर्ण निर्णय-इतिहास',
    feature_remedies: 'उपाय-मार्गदर्शन',
    feature_pdf_export: 'पीडीएफ रिपोर्ट',
    feature_priority_windows: 'प्राथमिक ग्रह-काल',
    feature_strategic_sessions: 'रणनीतिक सत्र',
  },

  settings: {
    headerTitle: 'सेटिंग्स',
    profileSection: 'प्रोफ़ाइल',
    appearanceSection: 'रूप-रंग',
    preferencesSection: 'प्राथमिकताएँ',
    accountSection: 'खाता',
    legalSection: 'क़ानूनी',
    themeLabel: 'थीम',
    languageLabel: 'भाषा',
    notificationsLabel: 'सूचनाएँ',
    notificationsHint: 'जब ग्रह-काल आपके प्रश्नों के अनुरूप हों, तब स्मरण पाएँ।',
    subscriptionLabel: 'सदस्यता',
    privacyPolicy: 'गोपनीयता नीति',
    termsOfService: 'सेवा-शर्तें',
    aboutLabel: 'परिचय',
    versionLabel: 'संस्करण',
    signOut: 'साइन आउट',
    signOutConfirm: 'शम्सुल असरार से साइन आउट करें?',
  },

  theme: {
    darAlShams: 'दारुल शम्स',
    laylAlBahr: 'लैलुल बह्र',
    narAlHadid: 'नारुल हदीद',
    subhAlWahy: 'सुब्हुल वह्य',
    zaytunAlHikma: 'ज़ैतूनुल हिक्मा',
  },

  errors: {
    network: 'इंटरनेट उपलब्ध नहीं। नेटवर्क जाँचकर पुनः प्रयास करें।',
    unknown: 'एक अप्रत्याशित त्रुटि हुई।',
    sessionExpired: 'आपका सत्र समाप्त हो गया है। पुनः साइन इन करें।',
    signInFailed: 'द्वार नहीं खुला। अपना ईमेल और पासवर्ड जाँचें।',
    signUpFailed: 'खाता अंकित नहीं हो सका। कृपया पुनः प्रयास करें।',
    locationRequired: 'कुंडली बनाने के लिए स्थान आवश्यक है।',
    tooManyAttempts: 'बहुत अधिक प्रयास। द्वार {{seconds}} सेकंड के लिए विश्राम में है।',
    tooManyAttemptsWait: 'बहुत अधिक प्रयास। पुनः प्रयास से पहले थोड़ा रुकें।',
  },
};

export default hi;
