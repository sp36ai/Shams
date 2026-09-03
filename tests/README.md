# Shams Method Backtester

Deterministic testing framework for validating the Shams Method RKP Watch Engine against known planetary matrices and expected outcomes.

## Overview

The backtester validates the core algorithmic logic gates of the Shams Method:

1. **Litigation Loss** (LIT_001) - Sub-Lord Veto Reversal

   - Validates that Sub-Lord can reverse a promissory Star-Lord verdict
   - Expected: DENIED_WITH_PENALTY

2. **Litigation Victory** (LIT_002) - Sub-Lord Confirmation

   - Validates that Sub-Lord can confirm a promissory Star-Lord verdict
   - Expected: PROMISED_VICTORY

3. **Windfall Timing** (WIN_001) - DBA ∩ RP ∩ Transit

   - Validates multi-phase timing algorithm (Phase 1-4)
   - Expected: PROMISED_AND_TIMED with exact execution timestamp

4. **Node Multi-House Trigger** (NODE_001) - Rahu Proxy Array

   - Validates 4-tier Node proxy resolution hierarchy
   - Expected: VERY_STRONG trigger with 7-house signification

5. **Retrograde Delay** (RET_001) - Star-Lord Retrograde Suspension
   - Validates retrograde circuit breaker logic
   - Expected: DELAYED until Star-Lord turns direct

## Test Case Structure

Each test case is a JSON file with the following schema:

```json
{
  "test_id": "LIT_001",
  "category": "LITIGATION",
  "description": "...",
  "scenario": "...",
  "input_state": {
    "query_metadata": { ... },
    "chart_data": { ... },
    "event_vectors": { ... }
  },
  "expected_output": {
    "status": "DENIED_WITH_PENALTY",
    "confidence_minimum": 0.85,
    "factors": [ ... ]
  },
  "pass_criteria": {
    "status_match": true,
    "confidence_above_threshold": 0.85,
    "veto_correctly_applied": true,
    "execution_time_ms_max": 500
  }
}
```

## Running the Backtester

### Run All Tests

```bash
npm run test:backtest
```

### Run Specific Test

```bash
npm run test:backtest -- tests/cases/LIT_001_litigation_loss_veto_reversal.json
```

### Run Test Category

```bash
npm run test:backtest -- tests/cases/LIT_*.json
npm run test:backtest -- tests/cases/WIN_*.json
npm run test:backtest -- tests/cases/NODE_*.json
npm run test:backtest -- tests/cases/RET_*.json
```

### Run with Verbose Output

```bash
npm run test:backtest -- --verbose tests/cases/LIT_001*.json
```

## Output

The backtester produces a summary report:

```
================================================================================
SHAMS METHOD BACKTESTER
================================================================================

Found 5 test case(s)

▶ Running: LIT_001 (LITIGATION)
  Description: Litigation Loss: Star-Lord promises victory (11), Sub-Lord vetoes...

  ✅ PASS
  ⏱  Duration: 234.56ms
  Confidence: 85.0%

[... more test results ...]

================================================================================
TEST SUMMARY
================================================================================

Tests Run: 5
✅ Passed: 5
❌ Failed: 0
📊 Pass Rate: 100.0%
⏱  Total Duration: 1234.56ms
```

## Test Case Details

### LIT_001: Litigation Loss (Sub-Lord Veto Reversal)

**Chart State:**

- 6th CSL: Venus (in Saturn's Star, Rahu's Sub)
- Star Lord: Saturn signifies [8, 11] (victory + penalty)
- Sub Lord: Rahu signifies [12] (loss)

**Logic Gate:**

- Star Lord promises victory via 11th house
- Star Lord also drags in 8th house (penalty)
- Sub Lord (Rahu) signifies 12th house
- **Verdict:** Sub-Lord veto reverses Star-Lord → DENIED_WITH_PENALTY

**Expected:**

- Status: DENIED_WITH_PENALTY
- Confidence: ≥ 0.82
- Execution Time: ≤ 500ms

---

### LIT_002: Litigation Victory (Sub-Lord Confirmation)

**Chart State:**

- 6th CSL: Jupiter (in Moon's Star, Mercury's Sub)
- Star Lord: Moon signifies [11, 4] (victory + home)
- Sub Lord: Mercury signifies [11, 3] (fulfillment + communication)

**Logic Gate:**

- Star Lord promises victory via 11th house
- Sub Lord also signifies 11th house
- **Verdict:** Sub-Lord confirms Star-Lord → PROMISED_VICTORY

**Expected:**

- Status: PROMISED_VICTORY
- Confidence: ≥ 0.90
- Execution Time: ≤ 500ms

---

### WIN_001: Windfall Timing (DBA ∩ RP ∩ Transit)

**Chart State:**

- 5th CSL: Jupiter (in Moon's Star, Mercury's Sub)
- Star Lord: Moon signifies [8, 11]
- Sub Lord: Mercury signifies [2, 11]
- DBA: [Moon, Mercury, Jupiter]
- RP: [Mercury, Mars, Moon, Jupiter]

**Logic Gate:**

- Phase 2: Sub-Lord confirms → PROMISED
- Phase 3: DBA ∩ RP = [Moon, Mercury, Jupiter] (IMMINENT, 0–60 days)
- Phase 4: Transit lock → Sun to Hasta (Moon's Star) Sep 28 → Jupiter's Sub confirmed

**Expected:**

- Status: PROMISED_AND_TIMED
- Confidence: ≥ 0.92
- Execution Date: 2026-09-28
- Execution Time: ±15 minutes of 4:15 PM IST
- Execution Time: ≤ 800ms

---

### NODE_001: Rahu Multi-House Trigger

**Chart State:**

- Rahu in Virgo (6), conjoined with Venus
- Saturn aspects Rahu
- Mercury is sign lord (Virgo)
- Moon is star lord (Ashlesha)

**Proxy Resolution:**

- Base: [6]
- Conjunction (Venus): [2, 7]
- Aspect (Saturn): [8, 9]
- Sign Lord (Mercury): [3, 6]
- Star Lord (Moon): [4]
- **Full Array:** [2, 3, 4, 6, 7, 8, 9]

**Expected:**

- Significations: 7 houses
- Trigger Strength: VERY_STRONG
- Event Character: WILDCARD
- Proxy Count: 4 planets
- Confidence: ≥ 0.85
- Execution Time: ≤ 600ms

---

### RET_001: Retrograde Delay (Star-Lord Retrograde Suspension)

**Chart State:**

- 5th CSL: Jupiter (in Moon's Star, Mercury's Sub)
- Star Lord: Moon (retrograde, direct Oct 5, 2026)
- Star Lord signifies [8, 11] (windfall)
- Sub Lord: Mercury (direct) signifies [2, 11]

**Logic Gate:**

- Phase 2: Sub-Lord confirms → PROMISED
- Retrograde Check: Star-Lord retrograde → SUSPENDED
- **Verdict:** Event delayed until Star-Lord turns direct

**Expected:**

- Status: DELAYED
- Confidence: ≥ 0.85
- Direct Motion Date: 2026-10-05
- New Execution Window: ~2026-10-19 (post-direct buffer)
- Timeline Shift: ≥ 30 days
- Execution Time: ≤ 700ms

## Backtester Architecture

```
backtester.ts
├─ run(filePattern)           # Main entry point
├─ runTestCase(file)          # Execute single test
├─ simulateEngineExecution()  # Call actual engine (placeholder)
├─ validateOutput()           # Validate against criteria
└─ printSummary()             # Generate report
```

### Simulation vs. Real Execution

The backtester currently **simulates** engine execution by returning expected outputs from the JSON. In production, the actual flow is:

```
Test JSON → backtester.ts → executeUnifiedShamsMethod() → Actual Output
                                                          ↓
                                                    Validate vs Expected
```

To use real engine execution:

```typescript
// Replace simulateEngineExecution() with:
const actualOutput = await executeUnifiedShamsMethod(
  testCase.input_state.chart_data,
  testCase.input_state.query_metadata.event_type,
  testCase.input_state.query_metadata.query_text,
  testCase.input_state.query_metadata.timestamp,
);
```

## Next Steps

1. **Run initial tests** to validate framework structure
2. **Connect to actual engine** (replace simulateEngineExecution)
3. **Add real charts** from historical cases
4. **Profile performance** (identify bottlenecks)
5. **Calibrate confidence** scoring against known outcomes
6. **Bind to Zustand** once engine is validated

## Files

- `backtester.ts` - CLI runner and validation framework
- `cases/LIT_001_*.json` - Litigation test cases
- `cases/WIN_001_*.json` - Windfall test cases
- `cases/NODE_001_*.json` - Node resolution test cases
- `cases/RET_001_*.json` - Retrograde test cases

## See Also

- [EVENT_FORMULATION_MATRIX.md](../docs/EVENT_FORMULATION_MATRIX.md) - Full specification
- [unifiedShamsEngine.ts](../src/astrology/rkp/unifiedShamsEngine.ts) - Engine implementation
