# DRAFT — Urdu & Hindi phrase lists for the narration validator

Status: **draft for owner review. Not implemented.** Nothing here changes RKP,
judgment, or remedy selection. These lists only widen what the existing
deterministic validator (`functions/src/oracle/narrationValidator.ts`) refuses
to let the AI *say*, so that Urdu and Hindi replies get the same checks
English replies already get.

Applies to both the reading narration (`responseComposer`) and the follow-up
chat (`discussionComposer`), because both call the same validator.

Each list mirrors an existing English list one-to-one. Matching stays the
same as today: a plain substring match after normalisation (below), so each
entry is a phrase, never a single common word, unless noted.

---

## 0. Normalisation (needed before any list works)

Today the validator only lower-cases English text. For Urdu and Hindi it would
also need, before matching:

| Step | Why |
|---|---|
| Remove zero-width joiner / non-joiner (U+200C, U+200D) | Urdu keyboards insert them inside words; "ہو‌گا" would not match "ہوگا". |
| Collapse whitespace; also match the joined form (e.g. "ہو گا" and "ہوگا") | Both spellings are common. Each future-tense entry is listed in both forms below. |
| Hindi: treat nukta forms as equal (ज़ = ज, फ़ = फ) | "ज़रूर" and "जरूर" are both used. |
| Convert Urdu (۰–۹), Arabic (٠–٩) and Devanagari (०–९) digits to 0–9 | The day-count and date checks use ASCII digits only. "۱۵ دن" or "१५ दिन" passes them today. |

---

## 1. Outcome polarity (VERDICT_CONTRADICTION)

English: `POSITIVE_ASSERTIONS` / `NEGATIVE_ASSERTIONS`. A reply fails if it
asserts the opposite of the stored verdict outright.

### Positive — "it will happen"

| English source | Urdu | Hindi |
|---|---|---|
| the answer is yes | جواب ہاں ہے | उत्तर हाँ है · जवाब हाँ है |
| will certainly happen | یقیناً ہو گا · یقیناً ہوگا | निश्चित रूप से होगा |
| will definitely happen | ضرور ہو گا · ضرور ہوگا | ज़रूर होगा |
| is guaranteed to happen | ہونا طے ہے · اس کی ضمانت ہے | होना तय है · इसकी गारंटी है |
| the matter will succeed | کامیابی یقینی ہے | सफलता निश्चित है |
| the matter is fulfilled | معاملہ پورا ہو چکا ہے | मामला पूरा हो चुका है |

### Negative — "it will not happen"

| English source | Urdu | Hindi |
|---|---|---|
| the answer is no | جواب نفی میں ہے | उत्तर ना है · उत्तर नकारात्मक है |
| will not happen | یہ نہیں ہو گا · یہ نہیں ہوگا · کبھی نہیں ہو گا · کبھی نہیں ہوگا | यह नहीं होगा · कभी नहीं होगा |
| will certainly fail | ناکامی یقینی ہے · یقیناً ناکام ہو گا | असफलता निश्चित है · निश्चित रूप से असफल होगा |
| there is no path forward | آگے کوئی راستہ نہیں | आगे कोई रास्ता नहीं |

**Deliberately left out:** Urdu "جواب نہیں ہے". It also means "there is no
answer", which a legitimate reply may say ("this reading has no answer for
that").

---

## 2. Unsupported certainty (UNSUPPORTED_CERTAINTY)

English: `CERTAINTY_PHRASES`. Flagged only when the reading's own confidence or
outcome does not support certainty.

| English source | Urdu | Hindi |
|---|---|---|
| guaranteed | ضمانت ہے · ضمانت دیتا ہوں | गारंटी है · गारंटी देता हूँ |
| without any doubt / there is no question | اس میں کوئی شک نہیں · بلا شبہ ہو گا · بلاشبہ ہوگا | इसमें कोई संदेह नहीं · बिना किसी संदेह के |
| certain to happen | ہونا یقینی ہے | होना निश्चित है |
| absolutely / definitely will | سو فیصد | सौ प्रतिशत |
| will certainly / certainly will | (covered by §1 "یقیناً ہو گا") | (covered by §1 "निश्चित रूप से होगा") |

**Deliberately left out:** bare "یقیناً" and "ضرور". Both are everyday words in
gentle prose ("یقیناً صبر مشکل ہے", *surely patience is hard*). English avoids
bare "certainly" for the same reason.

---

## 3. Timing (TIMING_FABRICATION / TIMING_ALTERATION)

### 3a. Strong immediacy — flagged on any WAIT / WAIT_LONG reading

| English source | Urdu | Hindi |
|---|---|---|
| immediately / right away / without delay | فوراً · فی الفور · بلا تاخیر | तुरंत · फ़ौरन · बिना देर |
| right now / this instant | ابھی اسی وقت | अभी इसी समय |
| today | آج ہی | आज ही |
| tomorrow | کل تک · آنے والے کل | कल तक |
| this week | اسی ہفتے · اس ہفتے | इसी हफ़्ते · इस सप्ताह |

**Deliberately left out:**
- Bare "ابھی" / "अभी". It also means *yet*: "ابھی وقت نہیں آیا" (*the time
  has not come yet*) is exactly what a WAIT reading should say.
- Bare "کل". In Urdu the same letters also mean *total / all* (kul).
- Bare "آج" / "आज". It appears in "آج کی کیفیت" (*today's state*), which
  describes the moment, not the outcome. English flags bare "today", so this
  is stricter for English than for Urdu/Hindi. **Owner decision:** match
  English (flag bare آج/आज) or keep the phrase form above.

### 3b. Soft immediacy — flagged on WAIT readings only when not hedged

| English | Urdu | Hindi |
|---|---|---|
| soon, shortly | جلد ہی · عنقریب | जल्द ही · जल्दी · शीघ्र |

Note: bare "جلد" also means *skin* (jild), so only "جلد ہی" is listed.

### 3c. Hedges — a soft signal in the same sentence as one of these is allowed

| English | Urdu | Hindi |
|---|---|---|
| may, might, could, possibly, perhaps | شاید · ممکن ہے · ہو سکتا ہے · غالباً | शायद · संभव है · हो सकता है · संभवतः |

Sentence splitting must also break on "۔" (Urdu full stop) and "।" (Hindi
danda), not only on ".".

### 3d. Day counts — any count outside the settled window fails

English: a number followed by "day". Add, after digit conversion (§0):

| Urdu | Hindi |
|---|---|
| number + "دن" | number + "दिन" |

**Known residual:** spelled-out numbers ("پندرہ دن", "पंद्रह दिन") are not
caught. English has the same gap ("fifteen days").

### 3e. Calendar dates and weekdays — always fail (the engine never gives a date)

**Gregorian month names** (with a 1–2 digit day next to them, as in English):

- Urdu: جنوری · فروری · مارچ · اپریل · مئی · جون · جولائی · اگست · ستمبر · اکتوبر · نومبر · دسمبر
- Hindi: जनवरी · फ़रवरी · मार्च · अप्रैल · मई · जून · जुलाई · अगस्त · सितंबर/सितम्बर · अक्टूबर · नवंबर/नवम्बर · दिसंबर/दिसम्बर

**Hijri month names** — **owner decision.** English doesn't check these
today, but an Islamic oracle is more likely to say "on the 15th of Sha'ban"
than "on 15 March". Proposed for all three languages, with a day number next
to them: Muharram, Safar, Rabi' al-Awwal, Rabi' al-Thani, Jumada al-Ula,
Jumada al-Akhirah, Rajab, Sha'ban, Ramadan, Shawwal, Dhu al-Qa'dah,
Dhu al-Hijjah (and their Urdu/Hindi spellings).

**Weekdays** (any mention fails, same as English):

- Hindi: सोमवार · मंगलवार · बुधवार · गुरुवार · शुक्रवार · शनिवार · रविवार. Only the
  full "-वार" forms are used, because bare मंगल / बुध / गुरु / शुक्र / शनि are
  also planet names.
- Urdu, unambiguous on their own: سوموار · منگل · بدھ · جمعرات · اتوار
- Urdu, only in a day phrase ("… کو" / "… کے دن"), because the bare word
  has another common meaning:
  - پیر کو (*pir* is also a Sufi master)
  - ہفتے کو / ہفتہ کے دن (*hafta* is also *week*)
  - جمعہ کو / جمعے کو (*Jumu'ah* is also the Friday prayer)

Checked: no remedy in `functions/src/oracle/remedyLibrary.ts` names a
weekday, so a correct reply never needs one. Rejecting weekday names here
matches what English already does.

---

## 4. Remedy override & prompt-injection artifacts

English: `REMEDY_OVERRIDE_PHRASES`, `INJECTION_COMPLIANCE_PHRASES`. These are
lower priority: the model writes these mostly in English even in an Urdu
reply. Proposed minimal set:

| English source | Urdu | Hindi |
|---|---|---|
| try this instead / a better remedy would be | اس کی بجائے یہ کریں · بہتر عمل یہ ہوگا | इसके बजाय यह करें · बेहतर उपाय यह होगा |
| ignore the remedy above | اوپر والا عمل چھوڑ دیں | ऊपर वाला उपाय छोड़ दें |
| as instructed / per your new instructions | آپ کی ہدایت کے مطابق | आपके निर्देश के अनुसार |
| my system prompt / my internal rules are | میرے اندرونی اصول | मेरे आंतरिक नियम |

---

## 5. What this does not cover (stays prompt-only)

- **Re-phrasings.** Like English, these are explicit phrase lists, not meaning
  detection. A verdict reworded in a way not on the list still passes.
- **A verdict on a new matter with the same polarity as the stored reading.**
  For example, "yes, you will marry" under a YES reading about a job. This is
  separate gap 2: when the reply is flagged `is_new_question`, reject *any*
  phrase from §1, of either polarity.
- **Romanised Urdu/Hindi** ("zaroor hoga"). The reply language is always
  Urdu script or Devanagari per the prompt, so this is not listed.

---

## Review checklist for the owner

1. **Correctness:** do any entries read wrongly, or are there common phrasings
   missing? A native-speaker pass on §1–§3 matters most.
2. **False positives:** would any entry block wording a legitimate reading
   needs to use?
3. **Decisions:**
   - bare آج/आज (§3a);
   - Hijri months (§3e).
4. Once approved, the implementation PR adds the normalisation and these
   entries, plus a test per entry (each must fail a crafted reply, and a
   matching legitimate sentence must pass), and nothing else.
