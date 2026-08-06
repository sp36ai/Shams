/**
 * dailySkyMessage — builds the "Today's Sky for You" home-screen card content.
 * --------------------------------------------------------------------------
 * Pure presentation logic: takes the already-computed hora/day lord (from
 * useTimingStrip) plus the seeker's onboarding profile, and returns the
 * structured pieces the DailySkyCard renders. No network calls, no new
 * astrology math — this only labels values the app already computes.
 */

import type { Planet } from '@astrology/types/chart';
import type { SeekerProfile } from '@stores/settingsStore';

type Lang = 'en' | 'ur' | 'hi';

const PLANET_THEME: Partial<Record<Planet, Record<Lang, string>>> = {
  Sun: { en: 'authority and recognition', ur: 'اختیار اور پہچان', hi: 'अधिकार और पहचान' },
  Moon: { en: 'emotion and intuition', ur: 'جذبات اور وجدان', hi: 'भावना और अंतर्ज्ञान' },
  Mars: { en: 'courage and swift action', ur: 'ہمت اور تیز عمل', hi: 'साहस और त्वरित कार्य' },
  Mercury: { en: 'communication and commerce', ur: 'رابطہ اور تجارت', hi: 'संचार और वाणिज्य' },
  Jupiter: { en: 'wisdom and expansion', ur: 'حکمت اور وسعت', hi: 'ज्ञान और विस्तार' },
  Venus: { en: 'love and harmony', ur: 'محبت اور ہم آہنگی', hi: 'प्रेम और सामंजस्य' },
  Saturn: { en: 'patience and discipline', ur: 'صبر اور نظم', hi: 'धैर्य और अनुशासन' },
  Rahu: {
    en: 'ambition and sudden change',
    ur: 'خواہش اور اچانک تبدیلی',
    hi: 'महत्वाकांक्षा और अचानक बदलाव',
  },
  Ketu: { en: 'detachment and reflection', ur: 'بے تعلقی اور غور و فکر', hi: 'वैराग्य और चिंतन' },
};

const PROFILE_GUIDANCE: Record<SeekerProfile, Record<Lang, string>> = {
  clarity: {
    en: 'Ask your question when the mind is calm — clarity favors the still moment.',
    ur: 'اپنا سوال اس وقت پوچھیں جب ذہن پرسکون ہو — سکون میں وضاحت ملتی ہے۔',
    hi: 'अपना प्रश्न तब पूछें जब मन शांत हो — स्पष्टता शांत क्षण में मिलती है।',
  },
  comfort: {
    en: "Let today's small comforts steady you — peace is its own answer.",
    ur: 'آج کی چھوٹی راحتیں آپ کو سہارا دیں — سکون خود ایک جواب ہے۔',
    hi: 'आज की छोटी राहतें आपको संबल दें — शांति स्वयं एक उत्तर है।',
  },
  action: {
    en: 'This hour rewards a bold step where you have hesitated.',
    ur: 'یہ گھڑی اس جرات کا صلہ دیتی ہے جہاں آپ نے ہچکچاہٹ کی۔',
    hi: 'यह घड़ी उस साहस का प्रतिफल देती है जहाँ आपने संकोच किया।',
  },
  surrender: {
    en: 'Release what you cannot control — the unfolding is not yours to force.',
    ur: 'جو آپ کے اختیار میں نہیں اسے چھوڑ دیں — معاملات کا کھلنا زور سے نہیں ہوتا۔',
    hi: 'जो आपके वश में नहीं उसे छोड़ दें — घटनाओं का प्रकट होना बल से नहीं होता।',
  },
};

export interface DailySkyMessage {
  greeting: string;
  dayLord: Planet;
  dayTheme: string;
  horaLord: Planet;
  horaTheme: string;
  guidance: string | null;
}

export function buildDailySkyMessage(args: {
  dayLord: Planet;
  horaLord: Planet;
  seekerProfile: SeekerProfile | null;
  seekerName: string | null;
  lang: Lang;
}): DailySkyMessage {
  const { dayLord, horaLord, seekerProfile, seekerName, lang } = args;

  const dayTheme = PLANET_THEME[dayLord]?.[lang] ?? dayLord;
  const horaTheme = PLANET_THEME[horaLord]?.[lang] ?? horaLord;
  const guidance = seekerProfile ? (PROFILE_GUIDANCE[seekerProfile]?.[lang] ?? null) : null;

  const greeting =
    lang === 'ur'
      ? seekerName
        ? `${seekerName}, آج کا آسمان`
        : 'آج کا آسمان'
      : lang === 'hi'
        ? seekerName
          ? `${seekerName}, आज का आकाश`
          : 'आज का आकाश'
        : seekerName
          ? `${seekerName}, today's sky`
          : "Today's sky";

  return { greeting, dayLord, dayTheme, horaLord, horaTheme, guidance };
}
