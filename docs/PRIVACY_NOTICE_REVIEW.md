# In-app privacy notice: provider change (OpenAI). Review draft

**Status: DRAFT FOR REVIEW. Not implemented in the app and not approved.**

This notice is the one promised by Section 9 of the privacy policy ("For significant changes, we will notify you within the app"). It announces an actual change of processor, from Anthropic to OpenAI.

It ships only when OpenAI is actually processing production requests and this branch's OpenAI policy (`claude/openai-api-migration`) is published. It replaces the interim Anthropic notice kept on `claude/interim-privacy-policy`.

## English

**Title:** Our Privacy Policy has changed

**Body:**

From [effective date], we use OpenAI models instead of Anthropic's Claude to put your readings into words. Our own engine continues to calculate your readings.

OpenAI may receive your question, follow-up messages, reading results and onboarding answers, and your name and your mother's name if you have entered them. Follow-up requests may also include the reading's date and time in UTC. We do not send OpenAI your GPS coordinates, precise device location, email address or payment details.

OpenAI does not use API data to train its models by default. API content may be retained for abuse monitoring for up to 30 days, subject to applicable exceptions. Your information may be processed outside India, including in the United States.

Please read our updated Privacy Policy for details.

**Buttons:** Read the Privacy Policy · OK

## Urdu

**عنوان:** ہماری پرائیویسی پالیسی میں تبدیلی ہوئی ہے

**متن:**

[مؤثر تاریخ] سے ہم آپ کی ریڈنگ کو الفاظ میں ڈھالنے کے لیے Anthropic کے Claude کے بجائے OpenAI کے ماڈلز استعمال کرتے ہیں۔ آپ کی ریڈنگ کا حساب بدستور ہمارا اپنا انجن کرتا ہے۔

OpenAI کو آپ کا سوال، فالو اپ پیغامات، ریڈنگ کے نتائج اور آن بورڈنگ جوابات، اور اگر آپ نے درج کیے ہوں تو آپ کا نام اور آپ کی والدہ کا نام مل سکتے ہیں۔ فالو اپ درخواستوں میں ریڈنگ کی تاریخ اور وقت (UTC) بھی شامل ہو سکتا ہے۔ ہم OpenAI کو آپ کے GPS کوآرڈینیٹس، آلے کا درست مقام، ای میل ایڈریس یا ادائیگی کی تفصیلات نہیں بھیجتے۔

OpenAI بطورِ طے شدہ API ڈیٹا کو اپنے ماڈلز کی تربیت کے لیے استعمال نہیں کرتا۔ غلط استعمال کی نگرانی کے لیے API مواد 30 دن تک رکھا جا سکتا ہے، لاگو استثنائی صورتوں کے تابع۔ آپ کی معلومات بھارت سے باہر، بشمول امریکہ، پروسیس کی جا سکتی ہیں۔

مزید تفصیل کے لیے براہِ کرم ہماری اپ ڈیٹ شدہ پرائیویسی پالیسی پڑھیں۔

**بٹن:** پرائیویسی پالیسی پڑھیں · ٹھیک ہے

## Hindi

**शीर्षक:** हमारी गोपनीयता नीति बदल गई है

**पाठ:**

[प्रभावी तिथि] से हम आपकी रीडिंग को शब्दों में ढालने के लिए Anthropic के Claude के बजाय OpenAI के मॉडल का उपयोग करते हैं। आपकी रीडिंग की गणना पहले की तरह हमारा अपना इंजन करता है।

OpenAI को आपका प्रश्न, फ़ॉलो-अप संदेश, रीडिंग के परिणाम और ऑनबोर्डिंग उत्तर, तथा यदि आपने दर्ज किए हों तो आपका नाम और आपकी माता का नाम मिल सकते हैं। फ़ॉलो-अप अनुरोधों में रीडिंग की तारीख और समय (UTC) भी शामिल हो सकता है। हम OpenAI को आपके GPS निर्देशांक, डिवाइस का सटीक स्थान, ईमेल पता या भुगतान विवरण नहीं भेजते।

OpenAI डिफ़ॉल्ट रूप से API डेटा का उपयोग अपने मॉडल को प्रशिक्षित करने के लिए नहीं करता। दुरुपयोग की निगरानी के लिए API सामग्री 30 दिनों तक रखी जा सकती है, लागू अपवादों के अधीन। आपकी जानकारी भारत के बाहर, अमेरिका सहित, प्रोसेस की जा सकती है।

विवरण के लिए कृपया हमारी अपडेट की गई गोपनीयता नीति पढ़ें।

**बटन:** गोपनीयता नीति पढ़ें · ठीक है

## Basis for each claim

| Notice statement | Source |
|---|---|
| Engine calculates; the model only writes words | The RKP engine judges before any model call (`askWatchOracle.ts`) |
| Question, follow-ups, reading results, onboarding answers | Request bodies captured on this branch: 58 harness requests plus the question-gate and profile requests |
| Names "if you have entered them" | Narration request only (`SEEKER_NAME` / `MOTHER_NAME`). Not sent with follow-ups. |
| UTC time on follow-up requests | Discussion brief `Cast at`. Absent from the narration request. |
| No GPS, precise location, email or payment details | No such field in any captured request |
| Training "by default"; abuse-monitoring retention up to 30 days with exceptions | OpenAI, "Data controls in the OpenAI platform": `/v1/responses` row and abuse-monitoring section. Requests send `store: false`, which disables stored application state but not abuse-monitoring logs. |
| Processing outside India | To be confirmed by legal review |

## Required before release

1. **OpenAI actually serves production.** Live verification and the transcript review are complete, and the deploy is authorized. Until then this notice must not be shown.
2. **Legal review.**
   - Confirm the retention summary against OpenAI's applicable API data policies and terms.
   - Confirm the sentence about processing outside India.
   - Decide whether to add an acceptance line; it is currently omitted, because Section 9 already covers acceptance.
3. **Account setting.** Confirm the OpenAI organization or project has not opted in to sharing API data for training. The "by default" statement depends on it.
4. **Native-speaker review** of the Urdu and Hindi against the app's existing strings (`src/i18n/strings/ur.ts`, `hi.ts`).
5. **Effective date.** Fill in `[effective date]` with the deploy date, and set the policy's "Last Updated" to match.
6. **Publish the matching policy first.** The notice links to `https://shams-app-4d0e7.web.app/privacy-policy.html`, which must already show this branch's OpenAI policy.

## Display requirements (for implementation, once approved)

- Show once per policy version on the next app open. Store the dismissal on the device. A user who saw the interim notice still sees this one, because it is a new version.
- Make the body scrollable, with both buttons always visible.
- "Read the Privacy Policy" opens the published policy URL above.
- Add the strings to `src/i18n/strings/en.ts`, `ur.ts` and `hi.ts`.
