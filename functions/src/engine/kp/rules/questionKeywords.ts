/**
 * ════════════════════════════════════════════════════════════════════
 * RKP Question Classification — Multilingual Keyword Matrix
 * ════════════════════════════════════════════════════════════════════
 *
 * Source of truth: docs/RKP_RULES_FROM_SARFARAZ.md §2
 * Provided by: Astro Sarfaraz.
 *
 * Detection rule (per owner spec):
 *   - Normalize the question text (lowercase, trim, collapse whitespace).
 *   - For each QuestionType in declaration order, test if ANY of its
 *     keywords appears as a substring in the normalized question.
 *   - First match wins. If none match, fall back to 'general'.
 *
 * Languages: English (en) / Urdu (ur) / Hindi (hi).
 * Keywords are intentionally permissive; false-positive into 'general'
 * is preferred over silent misclassification.
 *
 * ════════════════════════════════════════════════════════════════════
 */

import type { QuestionType } from './houseMatrix';

export const QUESTION_KEYWORDS: Readonly<Record<QuestionType, readonly string[]>> = Object.freeze({
  career: [
    // EN
    'job',
    'career',
    'work',
    'profession',
    'interview',
    'promotion',
    'employ',
    'hired',
    'salary',
    'office',
    'boss',
    // UR
    'نوکری',
    'کام',
    'ملازمت',
    'تنخواہ',
    'ترقی',
    // HI
    'नौकरी',
    'काम',
    'पेशा',
    'वेतन',
    'पदोन्नति',
  ],
  marriage: [
    // EN
    'marry',
    'marriage',
    'wedding',
    'husband',
    'wife',
    'partner',
    'relationship',
    'love',
    'propose',
    'nikah',
    'engaged',
    'spouse',
    // UR
    'شادی',
    'رشتہ',
    'نکاح',
    'منگنی',
    'شوہر',
    'بیوی',
    // HI
    'विवाह',
    'शादी',
    'जीवनसाथी',
    'पति',
    'पत्नी',
    'सगाई',
  ],
  finance: [
    // EN
    'money',
    'finance',
    'loan',
    'debt',
    'invest',
    'profit',
    'loss',
    'income',
    'wealth',
    'pay',
    'cash',
    // UR
    'پیسہ',
    'پیسے',
    'قرض',
    'دولت',
    'سرمایہ',
    'منافع',
    // HI
    'पैसा',
    'धन',
    'कर्ज',
    'निवेश',
    'लाभ',
    'हानि',
  ],
  health: [
    // EN
    'health',
    'ill',
    'illness',
    'disease',
    'recover',
    'sick',
    'hospital',
    'medicine',
    'treatment',
    'surgery',
    'pain',
    'fever',
    // UR
    'صحت',
    'بیماری',
    'علاج',
    'دوا',
    'اسپتال',
    'درد',
    // HI
    'स्वास्थ्य',
    'बीमारी',
    'इलाज',
    'दवा',
    'अस्पताल',
    'दर्द',
  ],
  property: [
    // EN
    'house',
    'property',
    'land',
    'flat',
    'plot',
    'home',
    'apartment',
    'real estate',
    // UR
    'مکان',
    'زمین',
    'گھر',
    'فلیٹ',
    'جائیداد',
    // HI
    'जायदाद',
    'घर',
    'जमीन',
    'मकान',
    'फ्लैट',
    'संपत्ति',
  ],
  travel: [
    // EN
    'travel',
    'journey',
    'trip',
    'visa',
    'abroad',
    'foreign',
    'flight',
    'migrate',
    'immigration',
    'relocate',
    // UR
    'سفر',
    'ویزہ',
    'بیرون',
    'بیرونِ ملک',
    'ہجرت',
    // HI
    'यात्रा',
    'वीजा',
    'विदेश',
    'प्रवास',
    'उड़ान',
  ],
  legal: [
    // EN
    'court',
    'case',
    'lawsuit',
    'legal',
    'judge',
    'dispute',
    'lawyer',
    'litigation',
    'verdict',
    // UR
    'عدالت',
    'مقدمہ',
    'وکیل',
    'فیصلہ',
    'تنازعہ',
    // HI
    'न्यायालय',
    'मुकदमा',
    'वकील',
    'विवाद',
    'न्याय',
  ],
  education: [
    // EN
    'study',
    'exam',
    'result',
    'degree',
    'admission',
    'university',
    'school',
    'pass',
    'fail',
    'college',
    'scholarship',
    // UR
    'تعلیم',
    'امتحان',
    'کالج',
    'یونیورسٹی',
    'ڈگری',
    'داخلہ',
    // HI
    'शिक्षा',
    'परीक्षा',
    'कॉलेज',
    'विश्वविद्यालय',
    'डिग्री',
    'दाखिला',
  ],
  business: [
    // EN
    'business',
    'venture',
    'startup',
    'company',
    'partnership',
    'trade',
    'enterprise',
    // UR
    'کاروبار',
    'تجارت',
    'کمپنی',
    'شراکت',
    // HI
    'व्यापार',
    'कारोबार',
    'कंपनी',
    'साझेदारी',
    'उद्यम',
  ],
  children: [
    // EN
    'child',
    'children',
    'baby',
    'pregnant',
    'birth',
    'son',
    'daughter',
    'conceive',
    'pregnancy',
    'kid',
    // UR
    'بچہ',
    'اولاد',
    'حمل',
    'بیٹا',
    'بیٹی',
    // HI
    'बच्चा',
    'संतान',
    'गर्भ',
    'बेटा',
    'बेटी',
  ],
  lostitem: [
    // EN
    'lost',
    'missing',
    'find',
    'where',
    'search',
    'stolen',
    'misplaced',
    // UR
    'گم',
    'کھو',
    'چوری',
    'گمشدہ',
    // HI
    'खोया',
    'गुम',
    'चोरी',
    'गायब',
    'खोई',
  ],
  enemies: [
    // EN
    'enemy',
    'rival',
    'competitor',
    'fight',
    'conflict',
    'opponent',
    // UR
    'دشمن',
    'مخالف',
    'حریف',
    'لڑائی',
    // HI
    'शत्रु',
    'दुश्मन',
    'विरोधी',
    'झगड़ा',
  ],
  spiritual: [
    // EN
    'spiritual',
    'meditation',
    'prayer',
    'god',
    'moksha',
    'pilgrimage',
    'enlightenment',
    'devotion',
    // UR
    'روحانی',
    'عبادت',
    'ذکر',
    'حج',
    'زیارت',
    // HI
    'आध्यात्मिक',
    'ध्यान',
    'पूजा',
    'मोक्ष',
    'तीर्थ',
  ],
  general: [],
}) as Readonly<Record<QuestionType, readonly string[]>>;

/**
 * Normalize a free-text question for keyword matching.
 * Lowercases, trims, collapses whitespace. Preserves Unicode (Urdu/Hindi).
 */
export function normalizeQuestion(text: string): string {
  return text.toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Classify a free-text question into a QuestionType per the owner-provided
 * keyword matrix. First-substring-match wins; falls back to 'general' on no
 * hit. Iteration order matches `Object.keys(QUESTION_KEYWORDS)`, which in
 * JS preserves insertion order of the frozen literal above.
 *
 * Determinism contract: for a given input string, the output is fixed.
 * No randomness, no locale-dependent collation beyond `toLocaleLowerCase`.
 *
 * Phase 1 caller: src/screens/OracleScreen.tsx (engine stub).
 * Phase 3 caller: src/astrology/kp/judgment/judgeHorary.ts (real engine).
 */
export function classifyQuestion(text: string): QuestionType {
  const normalized = normalizeQuestion(text);
  if (normalized.length === 0) {
    return 'general';
  }

  const types = Object.keys(QUESTION_KEYWORDS) as QuestionType[];
  for (const type of types) {
    if (type === 'general') {
      continue;
    } // catch-all, evaluated last by skip
    const keywords = QUESTION_KEYWORDS[type];
    for (const kw of keywords) {
      const lowerKw = kw.toLocaleLowerCase();
      // Match whole words/phrases using Unicode-aware boundaries.
      // This prevents "work" from matching in "artwork".
      const regex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${lowerKw}(?=[^\\p{L}\\p{N}]|$)`, 'u');
      if (regex.test(normalized)) {
        return type;
      }
    }
  }
  return 'general';
}
