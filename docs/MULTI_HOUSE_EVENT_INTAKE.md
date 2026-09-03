# RKP Watch Engine: Multi-House Event Rules — Intake Template

**For:** Astro Sarfaraz (project owner)
**Purpose:** The current RKP Watch Engine judges every question via a single
primary house (see `docs/RKP_RULES_FROM_SARFARAZ.md` §1–§2). Some questions —
litigation outcomes, health crises, financial windfalls — genuinely span more
than one house. Rather than an engineer guessing at "authentic RKP" compound
rules, this document exists so you can specify them directly. Nothing in this
codebase implements multi-house judgment yet; it is built only after this
document is completed and reviewed.

**Please answer using the same vocabulary the engine already computes**, so
your answers transcribe directly into code without a second round of
interpretation:

- **Relation** between two rulers: `Friend`, `Enemy`, or `Neutral`
  (`relationBetween` in `src/astrology/rkp/rules.ts`)
- **Dignity**: `Exalted`, `Own`, `Friendly`, `Enemy`, `Debilitated` (or
  simply "strong" / "weak" — `isStrong`/`isWeak` in the same file)
- **Nature**: `benefic` or `malefic` (`isBenefic`/`isMalefic`)
- **Condition**: `retrograde`, `combust`
- **Ghar relationship**: "occupies," "aspects," or "is aspected by" a given
  house — the engine already computes occupancy and aspect per house.

If a rule genuinely needs something the engine doesn't compute today (e.g. a
new kind of planetary combination), say so in plain language — that becomes
a scoped engineering task, not a guess.

**Explicitly out of scope:** Placidus cusps, Cusp Sub-Lords, Star/Sub-Lord
chains, Vimshottari Dasha-based triggering. Rely only on house rulership,
planetary dignity, and ruler-to-ruler relationships, consistent with how the
engine already judges single-house questions.

---

## 1. Litigation & Conflict Resolution

- **Primary house (the native's own standing):**
- **Opposing house (the opponent):**
- **Winning condition** — e.g. "ruler of house 6 is stronger (dignity) than
  the ruler of house 7, and the two rulers are not in an Enemy relation":
  *[Your rule here]*
- **Losing / penalty condition** — e.g. "ruler of house 6 occupies house 12,
  or is Debilitated": *[Your rule here]*
- **Settlement / compromise condition:** *[Your rule here]*
- **Any additional house that should be checked (e.g. 12th for loss),
  and how it modifies the above:** *[Your rule here]*

## 2. Health Crises & Surgery

- **Primary house for disease onset:**
- **Primary house for surgery/trauma:**
- **Onset condition** — e.g. "Lagna ruler is in Enemy relation with the 6th
  ruler, or a malefic occupies/aspects house 6": *[Your rule here]*
- **Surgery trigger** — e.g. "8th house ruler and 6th house ruler share an
  Enemy or otherwise afflicted relation, and Mars occupies or aspects
  either house": *[Your rule here]*
- **Recovery / cure condition** — e.g. "ruler of house 5 or 11 is in a
  Friend relation with the Lagna ruler, and is not weak": *[Your rule here]*
- **Does this scenario need anything the engine doesn't already track
  (e.g. specific planet involvement beyond benefic/malefic)?**
  *[Your note here]*

## 3. Financial Windfalls vs. Earned Wealth

- **Primary house for earned income:**
- **Primary house for windfalls (lottery/inheritance/speculation):**
- **Windfall trigger condition** — e.g. "rulers of houses 2, 8, and 11 are
  mutually in Friend relation, or two of the three occupy each other's
  house": *[Your rule here]*
- **Windfall negation (loss) condition** — e.g. "8th house ruler is in an
  Enemy relation with the 12th house ruler, or occupies house 12":
  *[Your rule here]*
- **How should this differ from ordinary "finance" question judgment**
  (§2 of the House Matrix, primary house 2)? *[Your note here]*

---

## Once completed

This document becomes the source-of-truth input for a new
`kp/rules/multiHouseEvents.ts` data table, transcribed verbatim the same
way `houseMatrix.ts` was — with an edit policy requiring your sign-off
for any change. The deterministic evaluator built on top of it will be
implemented in `src/astrology/rkp/watchJudgment.ts` (or a sibling module
it calls), using only the primitives already in `rules.ts`. No new
astrological methodology will be introduced beyond what is specified
here.
