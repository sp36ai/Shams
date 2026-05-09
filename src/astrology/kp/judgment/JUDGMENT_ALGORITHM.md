# Phase 3 Implementation Contract - `judgeHorary()`

> This is the spec for the runtime judgment engine.
> Source rules: `docs/RKP_RULES_FROM_SARFARAZ.md`

---

## Function signature

```ts
import type { Chart } from '@astrology/types/chart';
import type { ClassifiedQuestion } from '@astrology/types/question';
import type { Verdict } from '@astrology/types/verdict';

export function judgeHorary(chart: Chart, question: ClassifiedQuestion): Verdict;
```

---

## The 5-step flow

### STEP 1 - Read Moon's sub-lord

```ts
const moon = chart.planets['Moon'];
const moonSubLord = moon.subLord;
```

Reasoning must record:

```text
[STEP 1] Moon at 261.00deg sidereal (nakshatra lord: Ketu, sub-lord: Jupiter)
```

### STEP 2 - Load question matrix

```ts
const matrix = HOUSE_MATRIX[question.qType];
const { favorable, denial, primary } = matrix;
```

Reasoning must record:

```text
[STEP 2] Question: 'career' | favorable houses=[6,10,11] denial=[5,8,12]
```

### STEP 3 - Score the Moon's sub-lord house

```ts
const moonSubLordHouse = houseOfPlanet(moonSubLord, chart);

if (favorable.includes(moonSubLordHouse)) score += 2;
else if (denial.includes(moonSubLordHouse)) score -= 2;
```

Reasoning must record:

```text
[STEP 3] Moon's Sub-Lord Jupiter occupies house 10 -> favorable (house 10 in [6,10,11]) -> +2
```

### STEP 4 - Score ruling planets

Ruling planets are always:

1. Day Lord
2. Hora Lord
3. Minute Lord

```ts
for (const rp of chart.rulingPlanets) {
  const rpHouse = houseOfPlanet(rp, chart);
  if (favorable.includes(rpHouse)) score += 1;
  else if (denial.includes(rpHouse)) score -= 1;
}
```

Reasoning must record one line per RP.

### STEP 5 - Convert score to verdict

```ts
let verdict: VerdictKind;

if (score >= 3) verdict = 'YES';
else if (score <= -2) verdict = 'NO';
else verdict = 'CONDITIONAL';
```

Retrograde delay modifier:

```ts
if (
  verdict === 'YES' &&
  (chart.planets[moonSubLord].isRetrograde ||
    chart.planets['Jupiter'].isRetrograde ||
    chart.planets['Venus'].isRetrograde)
) {
  verdict = 'DELAYED';
}
```

Reasoning must record:

```text
[STEP 5] Total score = 3 -> verdict = YES
```

And if applicable:

```text
[STEP 5] YES -> DELAYED: retrograde planet(s): Jupiter
```

---

## Timing

```ts
const timingPlanet = chart.planets[moonSubLord].nakshatraLord;
const timingMonths = DASHA_YEARS[timingPlanet] * 12 * (positiveScore / maxScore);
```

Then convert the duration into:

- `days`
- `weeks`
- `months`
- `years`

Also include active MD / AD / PD in the output trace.

---

## Output structure

The verdict payload is centered on the actual runtime logic:

- `questionCusp`
- `moonSubLord`
- `rulingPlanets`
- `verdict`
- `confidence`
- `reasoning`
- `timing`

The runtime no longer emits a CSL-based verdict contract.

---

## Determinism guarantee

Same `(question, momentUtc, lat, lon)` must produce the same `Verdict`, byte-for-byte, except for intentional engine-version changes.

Forbidden inside the engine:

- `Date.now()`
- `Math.random()`
- unstable iteration order
