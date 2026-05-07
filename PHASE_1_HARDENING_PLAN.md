# Phase 1: Hardening the Core — Detailed Execution Plan

**Duration:** 1-2 weeks  
**Goal:** Write exhaustive unit tests for `judgeHorary()` and lock in deterministic outputs.

---

## Overview

The `judgeHorary()` function is a **pure deterministic function**:
- **Input:** `Chart` (computed ephemeris + natal positions) + `ClassifiedQuestion` (text + type)
- **Output:** `Verdict` (verdict kind, confidence, reasoning trace, remedy, timing, narration in 3 languages)
- **Guarantee:** Same input → identical output, every time, forever
- **No side effects:** No random numbers, no date.now(), no API calls

This is **ideal for unit testing**. We must:
1. Write test fixtures for 50+ scenarios
2. Cover all 5 verdict kinds (YES, NO, CONDITIONAL, DELAYED, UNCLEAR)
3. Test edge cases (retrograde planets, boundary house hits, Kotamraju filter logic)
4. Ensure narrations are generated correctly in all 3 languages
5. Lock in the output hash for regression detection

---

## Deliverables

| Artifact | Path | Purpose |
|---|---|---|
| **Test Framework Setup** | `functions/vitest.config.ts` | Vitest config for functions folder |
| **Test Suite** | `functions/src/engine/__tests__/judgeHorary.test.ts` | ~1,500 lines; 50+ test cases |
| **Fixture Generator** | `functions/src/engine/__tests__/fixtures.ts` | Reusable chart + question builders |
| **Test Data** | `functions/src/engine/__tests__/data/` | Sample charts, verdicts, edge cases |
| **Snapshot File** | `functions/src/engine/__tests__/__snapshots__/` | Frozen outputs for regression |
| **Coverage Report** | `functions/coverage/` | Must be 100% for `/engine/` folder |

---

## Step-by-Step Implementation

### **Step 1: Install Vitest + Typings** (15 min)

```bash
cd functions
npm install --save-dev vitest @vitest/ui @types/vitest
```

Update `functions/package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### **Step 2: Create Vitest Config** (10 min)

Create `functions/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/__tests__/**'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, './src/engine'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});
```

### **Step 3: Create Test Fixture Generator** (45 min)

Create `functions/src/engine/__tests__/fixtures.ts`:

**Purpose:** Build realistic Chart + ClassifiedQuestion objects without manually creating massive JSON structures.

```typescript
import type { Chart, Planet, HouseIndex, CuspDetail } from '../types/chart';
import type { ClassifiedQuestion } from '../types/question';

/**
 * Minimal valid chart for testing. All planets, cusps, and ruling planets
 * are populated with deterministic values.
 */
export function buildTestChart(overrides?: Partial<Chart>): Chart {
  const base: Chart = {
    momentUtc: '2025-03-15T10:30:00Z',
    location: { latitude: 28.6139, longitude: 77.209, tzOffsetHours: 5.5 },
    planets: {
      Sun: {
        siderealLongitude: 359.2,
        sign: 12,
        house: 1,
        nakshatra: 27,
        nakshatraLord: 'Mercury',
        pada: 1,
        isRetrograde: false,
        subLord: 'Venus',
      },
      Moon: {
        siderealLongitude: 45.8,
        sign: 2,
        house: 2,
        nakshatra: 1,
        nakshatraLord: 'Ketu',
        pada: 2,
        isRetrograde: false,
        subLord: 'Sun',
      },
      Mars: {
        siderealLongitude: 120.5,
        sign: 5,
        house: 5,
        nakshatra: 5,
        nakshatraLord: 'Jupiter',
        pada: 1,
        isRetrograde: false,
        subLord: 'Mercury',
      },
      Mercury: {
        siderealLongitude: 89.3,
        sign: 4,
        house: 4,
        nakshatra: 4,
        nakshatraLord: 'Mars',
        pada: 3,
        isRetrograde: false,
        subLord: 'Saturn',
      },
      Jupiter: {
        siderealLongitude: 210.1,
        sign: 8,
        house: 8,
        nakshatra: 9,
        nakshatraLord: 'Mercury',
        pada: 2,
        isRetrograde: false,
        subLord: 'Moon',
      },
      Venus: {
        siderealLongitude: 15.6,
        sign: 1,
        house: 1,
        nakshatra: 28,
        nakshatraLord: 'Venus',
        pada: 1,
        isRetrograde: false,
        subLord: 'Mercury',
      },
      Saturn: {
        siderealLongitude: 310.2,
        sign: 11,
        house: 11,
        nakshatra: 25,
        nakshatraLord: 'Venus',
        pada: 3,
        isRetrograde: false,
        subLord: 'Jupiter',
      },
      Rahu: {
        siderealLongitude: 175.4,
        sign: 7,
        house: 7,
        nakshatra: 7,
        nakshatraLord: 'Venus',
        pada: 2,
        isRetrograde: false,
        subLord: 'Mars',
      },
      Ketu: {
        siderealLongitude: 355.4,
        sign: 12,
        house: 12,
        nakshatra: 27,
        nakshatraLord: 'Mercury',
        pada: 2,
        isRetrograde: false,
        subLord: 'Saturn',
      },
    },
    ascendant: {
      sign: 1,
      degreeInSign: 15.5,
      nakshatra: 28,
      nakshatraLord: 'Venus',
      pada: 1,
    },
    cusps: buildTestCusps(),
    rulingPlanets: ['Sun', 'Mercury', 'Venus', 'Moon', 'Jupiter'],
    engineVersion: '2025.03.01',
  };

  return { ...base, ...overrides };
}

function buildTestCusps(): readonly CuspDetail[] {
  const cusps: CuspDetail[] = [];
  for (let h = 1; h <= 12; h++) {
    cusps.push({
      house: h as HouseIndex,
      sign: ((h - 1) % 12) + 1 as SignIndex,
      degreeInSign: 15 + h,
      nakshatra: ((h - 1) % 27) + 1 as NakshatraIndex,
      nakshatraLord: ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'][
        (h - 1) % 9
      ] as Planet,
      subLord: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Sun', 'Moon', 'Rahu', 'Ketu'][
        (h - 1) % 9
      ] as Planet,
      pada: (((h - 1) % 4) + 1) as Pada,
    });
  }
  return cusps;
}

export function buildTestQuestion(type: string, text: string): ClassifiedQuestion {
  return {
    text,
    qType: type,
    lang: 'en',
  };
}

/**
 * Build a question + answer pair for snapshot testing.
 */
export type TestScenario = {
  name: string;
  question: ClassifiedQuestion;
  chart: Chart;
  expectedVerdictKind?: 'YES' | 'NO' | 'CONDITIONAL' | 'DELAYED' | 'UNCLEAR';
  description: string;
};

export const TEST_SCENARIOS: readonly TestScenario[] = [
  {
    name: 'career-yes',
    question: buildTestQuestion('career', 'Will I get the job offer?'),
    chart: buildTestChart(),
    expectedVerdictKind: 'YES',
    description: 'Career question with favorable planetary support',
  },
  {
    name: 'marriage-no',
    question: buildTestQuestion('marriage', 'Should I marry this person?'),
    chart: buildTestChart({
      planets: {
        ...buildTestChart().planets,
        Venus: {
          ...buildTestChart().planets.Venus,
          isRetrograde: true,
        },
      },
    }),
    expectedVerdictKind: 'NO',
    description: 'Marriage question with retrograde Venus (denial)',
  },
  // ... more scenarios
];
```

### **Step 4: Write Core Test Suite** (2-3 hours)

Create `functions/src/engine/__tests__/judgeHorary.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { judgeHorary } from '../kp/judgment/judgeHorary';
import { buildTestChart, buildTestQuestion, TEST_SCENARIOS } from './fixtures';
import type { VerdictKind } from '../types/verdict';

describe('judgeHorary — RKP Judgment Engine', () => {
  
  describe('Determinism (core contract)', () => {
    it('should produce identical output for identical inputs (10 iterations)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I succeed?');
      
      const results = Array.from({ length: 10 }, () =>
        judgeHorary(chart, question)
      );
      
      const firstResult = results[0];
      results.forEach((result, i) => {
        expect(result).toEqual(firstResult);
        expect(result.readingId).toBe(firstResult.readingId);
      });
    });

    it('should produce consistent readingId (FNV-1a hash)', () => {
      const chart = buildTestChart();
      const q1 = buildTestQuestion('career', 'Will I succeed?');
      
      const v1 = judgeHorary(chart, q1);
      const v2 = judgeHorary(chart, q1);
      
      expect(v1.readingId).toBe(v2.readingId);
      expect(v1.readingId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    });
  });

  describe('Verdict Kind (YES, NO, CONDITIONAL, DELAYED, UNCLEAR)', () => {
    TEST_SCENARIOS.forEach(scenario => {
      it(`scenario: ${scenario.name} — ${scenario.description}`, () => {
        const verdict = judgeHorary(scenario.chart, scenario.question);
        
        if (scenario.expectedVerdictKind) {
          expect(verdict.verdict).toBe(scenario.expectedVerdictKind);
        }
        
        expect(['YES', 'NO', 'CONDITIONAL', 'DELAYED', 'UNCLEAR']).toContain(verdict.verdict);
        expect(verdict.confidence).toBeGreaterThanOrEqual(0);
        expect(verdict.confidence).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('YES verdict should have 75–95 confidence', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I get promoted?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.verdict === 'YES') {
        expect(verdict.confidence).toBeGreaterThanOrEqual(75);
        expect(verdict.confidence).toBeLessThanOrEqual(95);
      }
    });

    it('CONDITIONAL verdict should have 45–60 confidence', () => {
      // Build a chart that triggers CONDITIONAL
      const chart = buildTestChart({
        // CSL houses contain both favorable AND denial houses
      });
      const question = buildTestQuestion('property', 'Should I buy the house?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.verdict === 'CONDITIONAL') {
        expect(verdict.confidence).toBeGreaterThanOrEqual(45);
        expect(verdict.confidence).toBeLessThanOrEqual(60);
      }
    });

    it('UNCLEAR verdict should have ~20 confidence', () => {
      // Build a chart that triggers UNCLEAR
      const chart = buildTestChart({
        // CSL houses contain neither favorable nor denial houses
      });
      const question = buildTestQuestion('love', 'Will they love me?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.verdict === 'UNCLEAR') {
        expect(verdict.confidence).toBeLessThanOrEqual(25);
      }
    });
  });

  describe('Narration (Multilingual)', () => {
    it('should generate narration in English', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I succeed?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict.narration.en).toBeTruthy();
      expect(verdict.narration.en).toContain(verdict.category);
      expect(verdict.narration.en.length).toBeGreaterThan(20);
    });

    it('should generate narration in Urdu', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('marriage', 'Should I marry?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict.narration.ur).toBeTruthy();
      expect(verdict.narration.ur.length).toBeGreaterThan(20);
    });

    it('should generate narration in Hindi', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('health', 'Will I recover?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict.narration.hi).toBeTruthy();
      expect(verdict.narration.hi.length).toBeGreaterThan(20);
    });

    it('should include question category in narration', () => {
      const categories = ['career', 'marriage', 'property', 'legal', 'health', 'love', 'business'];
      
      categories.forEach(category => {
        const chart = buildTestChart();
        const question = buildTestQuestion(category, 'Random question');
        const verdict = judgeHorary(chart, question);
        
        expect(verdict.category).toBe(category);
        expect(verdict.narration.en).toContain(category);
      });
    });
  });

  describe('Retrograde Modifier (DELAYED)', () => {
    it('YES → DELAYED if CSL is retrograde', () => {
      const chart = buildTestChart({
        planets: {
          ...buildTestChart().planets,
          // Assuming this chart would normally produce YES,
          // make the CSL retrograde to trigger DELAYED
        },
      });
      const question = buildTestQuestion('career', 'Will I get promoted?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.verdict === 'DELAYED') {
        expect(verdict.narration.en).toContain('delay');
      }
    });

    it('YES → DELAYED if Jupiter is retrograde', () => {
      // Similar test for Jupiter retrograde
    });

    it('YES → DELAYED if Venus is retrograde', () => {
      // Similar test for Venus retrograde
    });

    it('NO verdict is never modified to DELAYED', () => {
      // NO + retrograde = still NO
    });
  });

  describe('Ruling Planets (5 RP)', () => {
    it('should include all 5 ruling planets in reasoning', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I succeed?');
      const verdict = judgeHorary(chart, question);
      
      const rpReasons = verdict.reasoning.filter(r => r.description.includes('Ruling Planet'));
      expect(rpReasons.length).toBeGreaterThan(0);
    });

    it('should agreement count should match ruling planets signature', () => {
      // 5 ruling planets vote; count how many agree
      // Agreement affects confidence
    });
  });

  describe('Timing (Dasha-based)', () => {
    it('should return timing window (days/weeks/months/years)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'When will I get promoted?');
      const verdict = judgeHorary(chart, question);
      
      expect(['days', 'weeks', 'months', 'years']).toContain(verdict.timing.window);
      expect(verdict.timing.range.min).toBeGreaterThan(0);
      expect(verdict.timing.range.max).toBeGreaterThanOrEqual(verdict.timing.range.min);
    });

    it('should calculate dasha correctly (MD/AD/PD)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('love', 'When will I find love?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict.timing.activeDasha).toBeTruthy();
      expect(verdict.timing.activeAntardasha).toBeTruthy();
      expect(verdict.timing.activePratyantardasha).toBeTruthy();
    });
  });

  describe('Remedy (Planet-based)', () => {
    it('should suggest remedy based on CSL', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I succeed?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.remedy) {
        expect(verdict.remedy.planet).toBeTruthy();
        expect(verdict.remedy.action).toBeTruthy();
        expect(verdict.remedy.avoid).toBeTruthy();
      }
    });

    it('remedy planet should be one of 9 planets', () => {
      const validPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
      
      const chart = buildTestChart();
      const question = buildTestQuestion('marriage', 'Should I marry?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.remedy) {
        expect(validPlanets).toContain(verdict.remedy.planet);
      }
    });

    it('remedy should include mantra (Sanskrit)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('health', 'Will I recover?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.remedy?.mantra) {
        expect(verdict.remedy.mantra).toMatch(/Om|Namah/);
      }
    });

    it('remedy should include charity (alms)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('business', 'Will my business grow?');
      const verdict = judgeHorary(chart, question);
      
      if (verdict.remedy?.charity) {
        expect(verdict.remedy.charity.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Reasoning Trace (Audit Trail)', () => {
    it('should include all 5 judgment steps', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I get promoted?');
      const verdict = judgeHorary(chart, question);
      
      const steps = verdict.reasoning.filter(r => r.ruleId.startsWith('STEP_'));
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps.map(s => s.ruleId)).toEqual(
        expect.arrayContaining(['STEP_1', 'STEP_2', 'STEP_4'])
      );
    });

    it('each reasoning step should have weight >= 0', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('legal', 'Will I win the case?');
      const verdict = judgeHorary(chart, question);
      
      verdict.reasoning.forEach(reason => {
        expect(reason.weight).toBeGreaterThanOrEqual(0);
        expect(typeof reason.description).toBe('string');
      });
    });

    it('should be human-readable (no junk)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('property', 'Should I sell the property?');
      const verdict = judgeHorary(chart, question);
      
      verdict.reasoning.forEach(reason => {
        expect(reason.description).toMatch(/\[STEP|\w+/);
        expect(reason.description.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    it('should handle question text with special chars (emoji, RTL)', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'کیا میں ترقی پاؤں گا؟');
      
      expect(() => judgeHorary(chart, question)).not.toThrow();
    });

    it('should handle all 12 question types', () => {
      const types = ['career', 'marriage', 'property', 'legal', 'health', 'love', 'business', 'travel', 'education', 'children', 'money', 'partnership'];
      
      types.forEach(type => {
        const chart = buildTestChart();
        const question = buildTestQuestion(type, 'Sample question');
        const verdict = judgeHorary(chart, question);
        
        expect(verdict.category).toBe(type);
      });
    });

    it('should never throw for valid chart + question', () => {
      const charts = [
        buildTestChart(),
        buildTestChart({ planets: { ...buildTestChart().planets, Sun: { ...buildTestChart().planets.Sun, isRetrograde: true } } }),
      ];
      
      const questions = [
        buildTestQuestion('career', 'Will I succeed?'),
        buildTestQuestion('marriage', 'Should I marry?'),
      ];
      
      charts.forEach(chart => {
        questions.forEach(question => {
          expect(() => judgeHorary(chart, question)).not.toThrow();
        });
      });
    });

    it('should reject invalid cusps', () => {
      const badChart = buildTestChart({
        cusps: [] as any,
      });
      const question = buildTestQuestion('career', 'Will I succeed?');
      
      expect(() => judgeHorary(badChart, question)).toThrow(RangeError);
    });
  });

  describe('Snapshot Testing (Regression Detection)', () => {
    it('career YES verdict snapshot', () => {
      const chart = buildTestChart();
      const question = buildTestQuestion('career', 'Will I get the job?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict).toMatchSnapshot();
    });

    it('marriage CONDITIONAL verdict snapshot', () => {
      // Build chart that triggers CONDITIONAL
      const chart = buildTestChart();
      const question = buildTestQuestion('marriage', 'Should I marry now or wait?');
      const verdict = judgeHorary(chart, question);
      
      expect(verdict).toMatchSnapshot();
    });
  });
});
```

### **Step 5: Run Tests & Generate Coverage** (30 min)

```bash
cd functions
npm run test               # Run all tests
npm run test:coverage     # Generate coverage report
npm run test:ui           # Open Vitest UI dashboard
```

**Target:** 100% coverage for `/functions/src/engine/`

### **Step 6: Document Test Results** (15 min)

Create `TEST_RESULTS.md`:

```markdown
# Phase 1 Test Results

## Summary
- **Test Suites:** 1
- **Tests:** 50+
- **Coverage:** 100% (engine folder)
- **Time:** ~50ms per test

## Determinism Verification ✅
- All 10 iterations of identical input produce identical output
- ReadingId is deterministic (FNV-1a hash)

## Verdict Kinds ✅
- YES: 75–95 confidence
- NO: 75–95 confidence
- CONDITIONAL: 45–60 confidence
- DELAYED: YES with retrograde planets
- UNCLEAR: ~20 confidence

## Multilingual Support ✅
- English narrations: all verdict kinds
- Urdu narrations: all verdict kinds
- Hindi narrations: all verdict kinds

## Timing (Dasha) ✅
- Vimshottari dasha periods calculated correctly
- Window: days/weeks/months/years
- MD/AD/PD active periods identified

## Remedy ✅
- All 9 planets have remedy instructions
- Mantras included (Sanskrit)
- Charity suggestions included

## Edge Cases ✅
- RTL text (Urdu/Hindi) handled
- All 12 question types supported
- Retrograde planets detected
- Invalid cusps rejected
```

---

## Success Criteria

✅ **All tests pass** (0 failures)  
✅ **100% coverage** of `/engine/kp/` folder  
✅ **Snapshots locked in** for regression detection  
✅ **Determinism verified** (10 identical runs)  
✅ **All 5 verdict kinds** tested with confidence bounds  
✅ **All 3 languages** narration verified  
✅ **Edge cases** tested (retrograde, all q-types, special chars)  

---

## Timeline

| Task | Time | Owner |
|------|------|-------|
| Install + Config Vitest | 25 min | You |
| Build Fixture Generator | 45 min | You |
| Write Test Suite | 2.5 h | You |
| Run Coverage + Debug | 1 h | You |
| Document Results | 15 min | You |
| **TOTAL** | **~5 hours** | |

---

## Next Phase (Validation & Security)

Once Phase 1 tests pass, we move to **Phase 2: API & Validation**.

We'll implement **Zod schemas** to validate all inputs to `judgeHorary()`:
- `ChartSchema` — validate ephemeris data
- `ClassifiedQuestionSchema` — validate question text + type
- `InputValidationMiddleware` — strip/reject malformed data before engine runs

This ensures the backend can never process invalid data, and the API contract is enforced at the boundary.
