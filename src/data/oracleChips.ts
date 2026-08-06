/**
 * oracleChips — quick-reply chip text shown in OracleChatScreen, shared out
 * so other modules (e.g. the home dashboard's "favored now" card) can
 * reference the exact same category labels without duplicating strings.
 */

export const INITIAL_CHIPS: Record<'en' | 'ur' | 'hi', readonly string[]> = {
  en: [
    'Will I succeed?',
    'Career & livelihood',
    'Marriage & love',
    'Finance',
    'Health',
    'Travel',
    'Legal matter',
    'Lost item',
  ],
  ur: [
    'کیا میں کامیاب ہوں گا؟',
    'نوکری اور روزگار',
    'شادی اور رشتہ',
    'مالی معاملہ',
    'صحت',
    'سفر',
    'قانونی تنازع',
    'گمشدہ چیز',
  ],
  hi: [
    'क्या मैं सफल होऊंगा?',
    'करियर',
    'विवाह और प्रेम',
    'वित्त',
    'स्वास्थ्य',
    'यात्रा',
    'कानूनी मामला',
    'खोई वस्तु',
  ],
};

export const FOLLOWUP_CHIPS: Record<'en' | 'ur' | 'hi', readonly string[]> = {
  en: ['When will it happen?', 'Why this verdict?', 'What remedy?', 'New question'],
  ur: ['کب ہوگا؟', 'یہ فیصلہ کیوں؟', 'علاج کیا ہے؟', 'نیا سوال'],
  hi: ['कब होगा?', 'यह निर्णय क्यों?', 'उपाय क्या है?', 'नया सवाल'],
};
