# RKP rule verification — prompt for Google AI

Paste everything between the two `=====` lines into Google AI as one message.
Do NOT paste `RKP_RULE_VERIFICATION_ANSWER_KEY.md` — that holds the engine's own
verdicts and must stay hidden until Google AI has answered Part C.

=====

You are acting as a rule auditor for the RKP (Astro Sarfaraz) watch-minute
system. I have built software that implements RKP. I need you to check my
implementation against RKP itself, rule by rule, and tell me where I am wrong.

GROUND RULES — read before answering
1. Do not flatter the implementation. I want errors found, not approval.
2. Every line you judge must get exactly one label:
   CORRECT — this is RKP as taught.
   WRONG — RKP says something different. State the correct rule.
   NOT-RKP — this comes from another system (KP, Parashari, Jaimini, Western,
             Lal Kitab, etc.), not from RKP. Name the system.
   UNKNOWN — you cannot confirm it from a source. Say so; do not guess.
3. For every CORRECT / WRONG label, name the source (book, lecturer, lesson,
   or "general Vedic convention"). If you cannot name one, the label is
   UNKNOWN. Never invent a source or a rule to fill a gap.
4. Keep "RKP", "classical Vedic", and "KP / Krishnamurti Paddhati" strictly
   separate. KP rules (sub-lords, cuspal sub-lords, significator tiers,
   Placidus cusps, ruling planets by sub) must NOT be used to judge this
   system. If a rule I describe looks KP-like, label it NOT-RKP.
5. Use these names: Hamal=Aries, Saur=Taurus, Jauza=Gemini, Sartan=Cancer,
   Asad=Leo, Sunbula=Virgo, Meezan=Libra, Aqrab=Scorpio, Qaus=Sagittarius,
   Jadi=Capricorn, Dalw=Aquarius, Hoot=Pisces. Shams=Sun, Qamar=Moon,
   Mirrikh=Mars, Utarid=Mercury, Mushtari=Jupiter, Zuhrah=Venus, Zuhal=Saturn,
   Ras al-Tinnin=Rahu, Dhanab al-Tinnin=Ketu. "Ghar"=house.

-----------------------------------------------------------------------------
PART A — THE CHART FRAME (verify each numbered line)
-----------------------------------------------------------------------------
A1. The question's local clock MINUTE selects the 1st Ghar. Minutes are split
    into twelve 5-minute brackets: 00–04 → Hamal is the 1st Ghar, 05–09 → Saur,
    10–14 → Jauza, 15–19 → Sartan, 20–24 → Asad, 25–29 → Sunbula, 30–34 →
    Meezan, 35–39 → Aqrab, 40–44 → Qaus, 45–49 → Jadi, 50–54 → Dalw,
    55–59 → Hoot. The other eleven signs follow in zodiac order as Ghars 2–12.
    Only the minute is used — not the hour, date, or place.
A2. Planets are NOT simulated. Their real sidereal sign positions at the
    moment of the question are dropped into whichever Ghar that sign occupies
    in the frame from A1. Which ayanamsa does RKP use (Lahiri, Raman, KP, other)?
A3. Rahu and Ketu are the mean nodes and are always shown retrograde.
    Which node does RKP use, mean or true?

-----------------------------------------------------------------------------
PART B — THE JUDGMENT RULES (verify each numbered line)
-----------------------------------------------------------------------------
B1. House routing (target Ghar / favourable / denial Ghars):
    career 10 / 6,10,11 / 5,8,12      marriage 7 / 7,11,2 / 6,8,12
    finance 2 / 2,6,11 / 8,12         health 1 / 1,5,11 / 6,8,12
    property 4 / 4,11,2 / 8,12        travel 9 / 3,9,12 / none
    legal 6 / 6,11 / 8,12             education 4 / 4,9,11 / 8,12
    business 7 / 7,10,11 / 6,8,12     children 5 / 2,5,11 / 1,4,10
    Is business really judged from the 7th and not the 10th? Is health really
    judged from the 1st? Is "travel has no denial Ghar" correct?
B2. The 11th Ghar is always the "fulfilment" Ghar, for every question type.
B3. Benefics are ONLY Mushtari (Jupiter) and Zuhrah (Venus). Malefics are ONLY
    Zuhal, Mirrikh, Ras and Dhanab. Shams, Qamar and Utarid count as neither.
    Is that RKP? Is Utarid benefic when unafflicted? Is Qamar benefic when
    waxing? Is Shams a malefic?
B4. Aspects (Nazar): every planet aspects the 7th from itself. Extra: Mirrikh
    4th & 8th, Mushtari 5th & 9th, Zuhal 3rd & 10th, Ras and Dhanab 5th & 9th.
    Do Ras/Ketu really aspect in RKP?
B5. Dignity: exaltation Shams-Hamal, Qamar-Saur, Mirrikh-Jadi, Utarid-Sunbula,
    Mushtari-Sartan, Zuhrah-Hoot, Zuhal-Meezan, Ras-Saur, Dhanab-Aqrab;
    debilitation = the opposite sign. Own signs: Shams Asad; Qamar Sartan;
    Mirrikh Hamal+Aqrab; Utarid Jauza+Sunbula; Mushtari Qaus+Hoot; Zuhrah
    Saur+Meezan; Zuhal Jadi+Dalw. Ras/Dhanab have no own sign.
    "Strong" = exalted or own sign only. "Weak" = debilitated or enemy sign.
B6. Planetary friendship table (Friend/Neutral/Enemy) — I use:
    Shams: friends Qamar,Mirrikh,Mushtari; neutral Utarid; enemies Zuhrah,Zuhal,Ras,Dhanab.
    Qamar: friends Shams,Utarid; enemies Ras,Dhanab; rest neutral.
    Mirrikh: friends Shams,Qamar,Mushtari; enemies Utarid,Ras; neutral Zuhrah,Zuhal,Dhanab.
    Utarid: friends Shams,Zuhrah,Ras,Dhanab; enemy Qamar; rest neutral.
    Mushtari: friends Shams,Qamar,Mirrikh; enemies Utarid,Zuhrah; rest neutral.
    Zuhrah: friends Utarid,Zuhal,Ras,Dhanab; enemies Shams,Qamar; rest neutral.
    Zuhal: friends Utarid,Zuhrah,Ras,Dhanab; enemies Shams,Qamar,Mirrikh; Mushtari neutral.
    Is this one fixed natural table, or does RKP use temporary/compound friendship?
B6a. IMPORTANT: this table uses ONE-WAY relations (A's view of B can differ from
    B's view of A; e.g. Utarid counts Qamar an enemy but Qamar counts Utarid a
    friend). Is that RKP, or should it be symmetric?
B7. Scoring — the engine adds points. Verify the weight of each step:
    1. Ruler of the target Ghar strong: +2; weak: −2.
    2. Ruler of the 1st Ghar (the querent) looks at the target Ghar's ruler as a
       friend: +2; as an enemy: −2; same planet rules both: 0.
    3. EACH benefic that sits in OR aspects the target Ghar: +2.
       EACH malefic that sits in OR aspects the target Ghar: −2.
    4. EACH benefic on/aspecting the 11th Ghar: +2; each malefic: −2.
    5. Target ruler lands in a favourable Ghar (B1): +1; in a denial Ghar: −1.
    6. Target ruler combust: −1.  (Retrograde: no points, see B8.)
    Are these the right weights? Does RKP score numerically at all, or judge by
    kind and order of strength? Is there any rule I am missing entirely?
B8. State ladder, applied in this order:
    score ≤ −5 → BLOCKED (no).  Else target-ruler retrograde → REVERSING.
    Else score ≥ 5 → FULFILLED (yes).  Else Zuhal on/aspecting target Ghar, or
    target ruler weak → DELAYED.  Else score ≥ 2 → MOVING.  Else UNFORMED.
    Only the target ruler's retrograde triggers REVERSING; the querent ruler's
    retrograde only sets a "possible reversal" note. Is that right?
B9. "Obstruction" = first malefic found, in order: occupying the target Ghar
    (Zuhal, Mirrikh, Ras, Dhanab), then aspecting it (same order). If none,
    Qamar in the 8th or 12th Ghar counts as "the mind is not settled."
B10. Timing windows by the target ruler (days): Qamar 3–7, Utarid 7–14,
    Zuhrah 10–21, Shams 14–30, Mirrikh 30–60, Mushtari 60–90, Zuhal 90–150,
    Ras/Dhanab 45–90. Multiply ×1.5 if the ruler is retrograde, ×1.5 if weak,
    ×0.7 if exalted. Are these RKP numbers or my own?

-----------------------------------------------------------------------------
PART B-2 — THE FIVE SUSPICIOUS PATTERNS (answer in depth)
-----------------------------------------------------------------------------
I ran the engine over about 1,950 moments spread across all of 2026 per
question type. Share of results that were a clear yes (Fulfilled or Moving) /
blocked: job 0% / 50%; marriage 2% / 59%; business 2% / 57%; health 6% / 54%;
visa 19% / 23%; money 10% / 25%. Job never gave a yes at all. I think the rules
are lopsided. Test these hypotheses and say which are true RKP:
H1. Four malefics (Zuhal, Mirrikh, Ras, Dhanab; each with 2–3 aspects) against
    two benefics (Mushtari, Zuhrah) means a malefic lands on the target Ghar
    far more often than a benefic. Does RKP weight a benefic and a malefic
    equally (±2)? Should one benefic cancel one malefic, or is a malefic
    heavier?
H2. In classical practice malefics (Zuhal, Mirrikh, Shams, Ras) in the 3rd, 6th,
    10th and 11th Ghars (upachaya) GROW the matter. My engine penalises a
    malefic sitting in the 10th for a career question and in the 6th for a
    legal question. Does RKP have this upachaya exception? Where does it apply?
H3. Zuhal is the natural significator of work and service (career). My engine
    treats a Zuhal on or aspecting the 10th as "Obstruction" and forces DELAYED
    (or BLOCKED). In RKP does Zuhal on the career Ghar help, delay, or block?
    What if Zuhal is own-sign or exalted?
H4. A matter's ruler in its own sign or exalted is "strong" (+2); the engine
    gives nothing for a ruler in a FRIENDLY sign. Is a friendly-sign ruler
    neutral in RKP?
H5. Does RKP treat the Qamar (Moon) as the primary signifier of the question
    (as the old KP-style rules did)? In the watch-minute method, what part
    does Qamar play in the judgment, if any?

-----------------------------------------------------------------------------
PART C — BLIND TEST CASES (judge by RKP only, do not see my engine's answer)
-----------------------------------------------------------------------------
For each chart: (1) state the target Ghar and its ruler; (2) list every planet
sitting in or aspecting the target Ghar and the 11th Ghar; (3) say whether RKP
gives YES / NO / DELAYED / REVERSED / NOT-SETTLED and why; (4) estimate timing
if RKP gives one. Use the RKP rules only. If RKP is ambiguous, say what extra
fact you need instead of picking.

CASE 1 — "Will I get the job?"   Local time 20 Oct 2026, 07:28.  Minute 28 →
1st Ghar Burj Sunbula (Ghars run Sunbula, Meezan, Aqrab, Qaus, Jadi, Dalw,
Hoot, Hamal, Saur, Jauza, Sartan, Asad).
 Shams: Burj Meezan 2.5°, Ghar 2, debilitated
 Qamar: Burj Jadi 18.0°, Ghar 5
 Mirrikh: Burj Sartan 18.2°, Ghar 11, debilitated
 Utarid: Burj Meezan 25.9°, Ghar 2
 Mushtari: Burj Sartan 28.1°, Ghar 11, exalted
 Zuhrah: Burj Meezan 8.9°, Ghar 2, own sign, retrograde, combust
 Zuhal: Burj Hoot 15.6°, Ghar 7, retrograde
 Ras: Burj Dalw 2.5°, Ghar 6     Dhanab: Burj Asad 2.5°, Ghar 12

CASE 2 — "Will I get the job?"   Local time 12 Mar 2026, 16:42.  Minute 42 →
1st Ghar Burj Qaus.
 Shams: Burj Dalw 27.7°, Ghar 3        Qamar: Burj Qaus 9.3°, Ghar 1
 Mirrikh: Burj Dalw 13.6°, Ghar 3, combust
 Utarid: Burj Dalw 18.1°, Ghar 3, retrograde, combust
 Mushtari: Burj Jauza 20.3°, Ghar 7   Zuhrah: Burj Hoot 13.3°, Ghar 4, exalted
 Zuhal: Burj Hoot 8.6°, Ghar 4, combust
 Ras: Burj Dalw 14.2°, Ghar 3          Dhanab: Burj Asad 14.2°, Ghar 9

CASE 3 — "Will my marriage happen this year?"   Local time 5 Jun 2026, 11:13.
Minute 13 → 1st Ghar Burj Jauza.
 Shams: Burj Saur 20.4°, Ghar 12       Qamar: Burj Jadi 13.8°, Ghar 8
 Mirrikh: Burj Hamal 18.7°, Ghar 11, own sign
 Utarid: Burj Jauza 11.9°, Ghar 1, own sign
 Mushtari: Burj Jauza 30.0°, Ghar 1    Zuhrah: Burj Jauza 26.2°, Ghar 1
 Zuhal: Burj Hoot 18.1°, Ghar 10       Ras: Burj Dalw 9.7°, Ghar 9
 Dhanab: Burj Asad 9.7°, Ghar 3

CASE 4 — "Will my business grow?"   Local time 2 Dec 2026, 09:51.  Minute 51 →
1st Ghar Burj Dalw.
 Shams: Burj Aqrab 15.8°, Ghar 10      Qamar: Burj Asad 27.2°, Ghar 7
 Mirrikh: Burj Asad 8.1°, Ghar 7       Utarid: Burj Meezan 29.4°, Ghar 9
 Mushtari: Burj Asad 2.6°, Ghar 7      Zuhrah: Burj Meezan 4.5°, Ghar 9, own sign
 Zuhal: Burj Hoot 13.5°, Ghar 2, retrograde
 Ras: Burj Dalw 0.2°, Ghar 1           Dhanab: Burj Asad 0.2°, Ghar 7

CASE 5 — "Will I recover from illness?"   Local time 17 Aug 2026, 20:07.
Minute 7 → 1st Ghar Burj Saur.
 Shams: Burj Asad 0.5°, Ghar 4, own sign
 Qamar: Burj Meezan 2.0°, Ghar 6
 Mirrikh: Burj Jauza 9.9°, Ghar 2      Utarid: Burj Sartan 20.0°, Ghar 3, combust
 Mushtari: Burj Sartan 15.7°, Ghar 3, exalted
 Zuhrah: Burj Sunbula 16.3°, Ghar 5, debilitated
 Zuhal: Burj Hoot 19.8°, Ghar 11, retrograde
 Ras: Burj Dalw 5.8°, Ghar 10          Dhanab: Burj Asad 5.8°, Ghar 4

-----------------------------------------------------------------------------
OUTPUT FORMAT (follow exactly)
-----------------------------------------------------------------------------
1. A table for Parts A and B: line id | label | one-line reason | source.
2. For every WRONG or NOT-RKP line: the corrected rule, written precisely
   enough that a programmer can implement it (inputs, condition, effect).
3. A direct answer to H1–H5, each ending with TRUE-RKP / NOT-RKP / UNKNOWN.
4. The five case judgments from Part C.
5. A final list titled "Rules RKP has that my engine does not", and one titled
   "Rules my engine has that RKP does not". Both may be empty — say so if so.

=====
