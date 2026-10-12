# In-app privacy notice: interim (Anthropic). Review draft

**Status: DRAFT FOR REVIEW. Not implemented in the app and not approved.**

This notice is the one promised by Section 9 of the privacy policy ("For significant changes, we will notify you within the app"). It ships only with the interim Anthropic policy on this branch (`claude/interim-privacy-policy`).

It describes current production processing. The update is disclosure-only: the app's processing does not change.

The OpenAI provider-change notice is kept separately, on `claude/openai-api-migration`. It ships only when OpenAI actually serves production requests. Do not show both notices, and never show this one after the OpenAI deployment.

## English

**Title:** We've updated our Privacy Policy

**Body:**

We've made our Privacy Policy clearer about how your readings are put into words. This is a clarification only: the way the app processes your information has not changed.

Our own engine calculates your readings, and Anthropic's Claude models put them into words. Anthropic may receive your question, follow-up messages, reading results and onboarding answers, and your name and your mother's name if you have entered them. Follow-up requests may also include the reading's date and time in UTC. We do not send Anthropic your GPS coordinates, precise device location, email address or payment details.

Anthropic does not use API data to train its models without permission. API content is generally deleted within 30 days, subject to applicable exceptions. Your information may be processed outside India, including in the United States.

Please read our updated Privacy Policy for details.

**Buttons:** Read the Privacy Policy · OK

## Urdu

**عنوان:** ہم نے اپنی پرائیویسی پالیسی اپ ڈیٹ کر دی ہے

**متن:**

ہم نے اپنی پرائیویسی پالیسی میں زیادہ وضاحت سے بتایا ہے کہ آپ کی ریڈنگ کو الفاظ میں کیسے ڈھالا جاتا ہے۔ یہ صرف وضاحت ہے: ایپ آپ کی معلومات کو جس طرح پروسیس کرتی ہے، اس میں کوئی تبدیلی نہیں ہوئی۔

آپ کی ریڈنگ کا حساب ہمارا اپنا انجن کرتا ہے، اور Anthropic کے Claude ماڈلز اسے الفاظ میں ڈھالتے ہیں۔ Anthropic کو آپ کا سوال، فالو اپ پیغامات، ریڈنگ کے نتائج اور آن بورڈنگ جوابات، اور اگر آپ نے درج کیے ہوں تو آپ کا نام اور آپ کی والدہ کا نام مل سکتے ہیں۔ فالو اپ درخواستوں میں ریڈنگ کی تاریخ اور وقت (UTC) بھی شامل ہو سکتا ہے۔ ہم Anthropic کو آپ کے GPS کوآرڈینیٹس، آلے کا درست مقام، ای میل ایڈریس یا ادائیگی کی تفصیلات نہیں بھیجتے۔

Anthropic اجازت کے بغیر API ڈیٹا کو اپنے ماڈلز کی تربیت کے لیے استعمال نہیں کرتا۔ API مواد عموماً 30 دن کے اندر حذف کر دیا جاتا ہے، لاگو استثنائی صورتوں کے تابع۔ آپ کی معلومات بھارت سے باہر، بشمول امریکہ، پروسیس کی جا سکتی ہیں۔

مزید تفصیل کے لیے براہِ کرم ہماری اپ ڈیٹ شدہ پرائیویسی پالیسی پڑھیں۔

**بٹن:** پرائیویسی پالیسی پڑھیں · ٹھیک ہے

## Hindi

**शीर्षक:** हमने अपनी गोपनीयता नीति अपडेट की है

**पाठ:**

हमने अपनी गोपनीयता नीति में और स्पष्ट रूप से बताया है कि आपकी रीडिंग को शब्दों में कैसे ढाला जाता है। यह केवल स्पष्टीकरण है: ऐप आपकी जानकारी को जिस तरह प्रोसेस करता है, उसमें कोई बदलाव नहीं हुआ है।

आपकी रीडिंग की गणना हमारा अपना इंजन करता है, और Anthropic के Claude मॉडल उसे शब्दों में ढालते हैं। Anthropic को आपका प्रश्न, फ़ॉलो-अप संदेश, रीडिंग के परिणाम और ऑनबोर्डिंग उत्तर, तथा यदि आपने दर्ज किए हों तो आपका नाम और आपकी माता का नाम मिल सकते हैं। फ़ॉलो-अप अनुरोधों में रीडिंग की तारीख और समय (UTC) भी शामिल हो सकता है। हम Anthropic को आपके GPS निर्देशांक, डिवाइस का सटीक स्थान, ईमेल पता या भुगतान विवरण नहीं भेजते।

Anthropic अनुमति के बिना API डेटा का उपयोग अपने मॉडल को प्रशिक्षित करने के लिए नहीं करता। API सामग्री सामान्यतः 30 दिनों के भीतर हटा दी जाती है, लागू अपवादों के अधीन। आपकी जानकारी भारत के बाहर, अमेरिका सहित, प्रोसेस की जा सकती है।

विवरण के लिए कृपया हमारी अपडेट की गई गोपनीयता नीति पढ़ें।

**बटन:** गोपनीयता नीति पढ़ें · ठीक है

## Basis for each claim

| Notice statement | Source |
|---|---|
| Engine calculates; the model only writes words | The RKP engine judges before any model call (`askWatchOracle.ts`) |
| Question, follow-ups, reading results, onboarding answers | Request contents in production code on `main` (`698e47a`): narration, discussion, question gate, profile inference |
| Names "if you have entered them" | Narration brief `SEEKER_NAME` / `MOTHER_NAME`. Sent with a new question only, not with follow-ups. |
| UTC time on follow-up requests | Discussion brief `Cast at`. Absent from the narration brief. |
| No GPS, precise location, email or payment details | No such field in any request. The oracle schema is strict and carries only a time-zone offset, which is not forwarded to the model. |
| Training and 30-day retention with exceptions | Anthropic Privacy Center, "How long do you store my organization's data?" (1 July 2026); Claude Platform docs, "API and data retention" |
| Processing outside India | To be confirmed by legal review |

## Required before release

1. **Legal review.**
   - Confirm the retention summary against Anthropic's commercial terms and Data Processing Addendum.
   - Confirm the sentence about processing outside India.
   - Decide whether to add an acceptance line; it is currently omitted, because Section 9 already covers acceptance.
2. **Account setting.** Confirm the Anthropic account has not opted in to data sharing for training. The "without permission" statement depends on it.
3. **Native-speaker review** of the Urdu and Hindi against the app's existing strings (`src/i18n/strings/ur.ts`, `hi.ts`), especially the words for privacy, processing, location and exceptions. "India" is written as بھارت in Urdu.
4. **Publish the matching policy first.** The notice links to `https://shams-app-4d0e7.web.app/privacy-policy.html`, which must already show this branch's policy.

## Display requirements (for implementation, once approved)

- Show once per policy version on the next app open. Store the dismissal on the device.
- Make the body scrollable, with both buttons always visible. Four paragraphs is long for a phone screen.
- "Read the Privacy Policy" opens the published policy URL above.
- Add the strings to `src/i18n/strings/en.ts`, `ur.ts` and `hi.ts`.
