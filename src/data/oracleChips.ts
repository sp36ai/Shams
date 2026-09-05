/**
 * oracleChips — quick-reply chip text for oracle question categories,
 * shared out so other modules (e.g. the home dashboard's "favored now"
 * card) can reference the exact same category labels without duplicating
 * strings.
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

// FOLLOWUP_CHIPS (static, unwired) was removed in favour of
// WatchOracleComposition.suggestedQuestions — chips generated per-reading
// from the actual diagnosis. See suggestedQuestions.ts and
// SuggestedQuestionsRow.tsx.
