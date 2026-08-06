/**
 * dailyDhikr — a short dhikr tied to today's day lord.
 * --------------------------------------------------------------------------
 * Distinct from the per-reading remedy pipeline (data/remedySelector.ts),
 * which needs a specific verdict/severity context and calls a Cloud
 * Function. This is a general, always-available home-screen card, so it's
 * a small curated table instead — one of the 99 Names (Asma al-Husna)
 * classically associated with each planet's nature, same voice as the
 * "asma" field already used in oracle verdict remedies.
 */

import type { Planet } from '@astrology/types/chart';

type Lang = 'en' | 'ur' | 'hi';

export interface DailyDhikr {
  name: string; // the Name, transliterated
  arabic: string;
  meaning: Record<Lang, string>;
  intention: Record<Lang, string>;
}

export const PLANET_DHIKR: Record<Planet, DailyDhikr> = {
  Sun: {
    name: 'Ya Nur',
    arabic: 'يَا نُور',
    meaning: { en: 'O Light', ur: 'اے نور', hi: 'हे नूर' },
    intention: {
      en: 'for clarity in matters of standing and recognition',
      ur: 'مرتبے اور پہچان کے معاملات میں وضاحت کے لیے',
      hi: 'प्रतिष्ठा और पहचान के मामलों में स्पष्टता के लिए',
    },
  },
  Moon: {
    name: 'Ya Latif',
    arabic: 'يَا لَطِيف',
    meaning: { en: 'O Gentle One', ur: 'اے لطیف', hi: 'हे लतीफ़' },
    intention: {
      en: 'for ease of heart and mind',
      ur: 'دل و دماغ کے سکون کے لیے',
      hi: 'हृदय और मन की शांति के लिए',
    },
  },
  Mars: {
    name: 'Ya Salam',
    arabic: 'يَا سَلَام',
    meaning: { en: 'O Source of Peace', ur: 'اے سلام', hi: 'हे सलाम' },
    intention: {
      en: 'to temper haste and conflict',
      ur: 'جلد بازی اور نزاع کو دور کرنے کے لیے',
      hi: 'जल्दबाज़ी और संघर्ष को शांत करने के लिए',
    },
  },
  Mercury: {
    name: 'Ya Alim',
    arabic: 'يَا عَلِيم',
    meaning: { en: 'O All-Knowing', ur: 'اے علیم', hi: 'हे अलीम' },
    intention: {
      en: 'for clarity in words, decisions and details',
      ur: 'باتوں، فیصلوں اور تفصیلات میں وضاحت کے لیے',
      hi: 'शब्दों, निर्णयों और विवरणों में स्पष्टता के लिए',
    },
  },
  Jupiter: {
    name: 'Ya Fattah',
    arabic: 'يَا فَتَّاح',
    meaning: { en: 'O Opener', ur: 'اے فتاح', hi: 'हे फ़त्ताह' },
    intention: {
      en: 'for the opening of provision and growth',
      ur: 'رزق اور ترقی کے دروازے کھلنے کے لیے',
      hi: 'रोज़ी और विकास के द्वार खुलने के लिए',
    },
  },
  Venus: {
    name: 'Ya Wadud',
    arabic: 'يَا وَدُود',
    meaning: { en: 'O Loving One', ur: 'اے ودود', hi: 'हे वदूद' },
    intention: {
      en: 'for matters of the heart and relationship',
      ur: 'دل اور رشتوں کے معاملات کے لیے',
      hi: 'हृदय और रिश्तों के मामलों के लिए',
    },
  },
  Saturn: {
    name: 'Ya Sabur',
    arabic: 'يَا صَبُور',
    meaning: { en: 'O Most Patient', ur: 'اے صبور', hi: 'हे सबूर' },
    intention: {
      en: 'for endurance through delay',
      ur: 'تاخیر کے دوران صبر و استقامت کے لیے',
      hi: 'देरी के दौरान धैर्य के लिए',
    },
  },
  Rahu: {
    name: 'Ya Hafiz',
    arabic: 'يَا حَفِيظ',
    meaning: { en: 'O Protector', ur: 'اے حفیظ', hi: 'हे हफ़ीज़' },
    intention: {
      en: 'for protection amid sudden change',
      ur: 'اچانک تبدیلی میں حفاظت کے لیے',
      hi: 'अचानक परिवर्तन में सुरक्षा के लिए',
    },
  },
  Ketu: {
    name: 'Ya Batin',
    arabic: 'يَا بَاطِن',
    meaning: { en: 'O the Hidden', ur: 'اے باطن', hi: 'हे बातिन' },
    intention: {
      en: 'for insight into what lies beneath the surface',
      ur: 'پوشیدہ حقیقتوں کی سمجھ کے لیے',
      hi: 'छिपी हुई सच्चाइयों की समझ के लिए',
    },
  },
};
