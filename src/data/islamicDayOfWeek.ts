/**
 * islamicDayOfWeek — short, well-attested Islamic significance per weekday.
 * --------------------------------------------------------------------------
 * Deliberately conservative: only widely-accepted, hadith-grounded points
 * (Monday/Thursday fasting sunnah, Friday's virtue) are included. Days
 * without a strong, uncontroversial tradition get a light, generic line
 * rather than a fabricated ruling.
 *
 * Keyed by JS Date#getDay() (0 = Sunday … 6 = Saturday), using the device's
 * local calendar day — no Hijri conversion (no such dependency in the app).
 */

type Lang = 'en' | 'ur' | 'hi';

export interface DayNote {
  name: Record<Lang, string>;
  note: Record<Lang, string>;
}

export const ISLAMIC_DAY_NOTES: Readonly<Record<number, DayNote>> = {
  0: {
    name: { en: 'Yawm al-Ahad', ur: 'یوم الاحد', hi: 'यौम अल-अहद' },
    note: {
      en: 'A day for fresh intentions — begin the week with a clear one.',
      ur: 'نئے ارادوں کا دن — ہفتے کا آغاز واضح نیت سے کریں۔',
      hi: 'नए इरादों का दिन — सप्ताह की शुरुआत स्पष्ट नीयत से करें।',
    },
  },
  1: {
    name: { en: 'Yawm al-Ithnayn', ur: 'یوم الاثنین', hi: 'यौम अल-इस्नैन' },
    note: {
      en: 'Deeds are presented to Allah today — a recommended day of voluntary fasting.',
      ur: 'آج اعمال اللہ کے حضور پیش کیے جاتے ہیں — نفلی روزے کی فضیلت والا دن۔',
      hi: 'आज कर्म अल्लाह के समक्ष प्रस्तुत होते हैं — नफ़्ल रोज़े का पुण्य दिन।',
    },
  },
  2: {
    name: { en: 'Yawm al-Thulatha', ur: 'یوم الثلاثاء', hi: 'यौम अस-सुलासा' },
    note: {
      en: 'A steady day — good for the patient, unremarkable work that adds up.',
      ur: 'ایک مستحکم دن — مستقل مزاجی سے کیے گئے کام کے لیے موزوں۔',
      hi: 'एक स्थिर दिन — धैर्यपूर्ण, निरंतर काम के लिए उपयुक्त।',
    },
  },
  3: {
    name: { en: 'Yawm al-Arbi‘a', ur: 'یوم الاربعاء', hi: 'यौम अल-अरबिआ' },
    note: {
      en: 'Midweek — a fair day to review intentions before the week turns.',
      ur: 'ہفتے کا وسط — ارادوں پر نظرِ ثانی کے لیے مناسب دن۔',
      hi: 'सप्ताह का मध्य — इरादों की समीक्षा के लिए उपयुक्त दिन।',
    },
  },
  4: {
    name: { en: 'Yawm al-Khamis', ur: 'یوم الخمیس', hi: 'यौम अल-ख़मीस' },
    note: {
      en: 'Deeds are presented to Allah today too — another recommended day of voluntary fasting, and the eve of Jumu‘ah.',
      ur: 'آج بھی اعمال پیش کیے جاتے ہیں — نفلی روزے اور جمعہ کی شب کی تیاری کا دن۔',
      hi: 'आज भी कर्म प्रस्तुत होते हैं — नफ़्ल रोज़े और जुमा की रात की तैयारी का दिन।',
    },
  },
  5: {
    name: { en: 'Yawm al-Jumu‘ah', ur: 'یوم الجمعہ', hi: 'यौम अल-जुमा' },
    note: {
      en: 'The best day of the week — there is an hour of accepted dua within it. Ask sincerely.',
      ur: 'ہفتے کا بہترین دن — اس میں دعا کی قبولیت کی ایک گھڑی ہے۔ خلوصِ دل سے مانگیں۔',
      hi: 'सप्ताह का सबसे उत्तम दिन — इसमें दुआ स्वीकार होने की एक घड़ी है। सच्चे दिल से माँगें।',
    },
  },
  6: {
    name: { en: 'Yawm al-Sabt', ur: 'یوم السبت', hi: 'यौम अस-सब्त' },
    note: {
      en: 'A quiet day — good for rest and taking stock before the week begins again.',
      ur: 'ایک پرسکون دن — آرام اور جائزے کے لیے موزوں، اگلے ہفتے سے پہلے۔',
      hi: 'एक शांत दिन — विश्राम और आत्मनिरीक्षण के लिए उपयुक्त, अगले सप्ताह से पहले।',
    },
  },
};

export function todaysIslamicNote(date: Date): DayNote {
  const idx = date.getDay();
  return ISLAMIC_DAY_NOTES[idx] ?? ISLAMIC_DAY_NOTES[0]!;
}
