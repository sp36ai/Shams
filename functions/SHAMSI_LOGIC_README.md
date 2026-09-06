/**
 * README: Shamsi Logic Implementation & Testing Guide
 */

# Shamsi Logic — Production Implementation Guide

## Overview

Shamsi Logic is the new core RKP (Ruling Planet Karma) judgment engine for Shams al-Asrār, replacing the location-free watch-chart model with real Placidus house calculations requiring user location (latitude/longitude).

## Four-Phase Architecture

### Phase 1: Promise Check (CSL Verification)
- **Input:** Question type (employment, career, lawsuit, marriage, property, relocation)
- **Process:** Cuspal Sub-Lord → Star Lord chain verification
- **Output:** `PROMISED`, `DENIED`, or `UNCLEAR`
- **File:** `shamsiLogic.ts` → `checkPromise()`

### Phase 2: Significator Grading
- **Input:** Primary house from Phase 1
- **Process:** Rank all 9 planets A-D based on:
  - Grade A: Nakshatra lord of house occupant
  - Grade B: Occupant of primary house (or Untenanted Planet Rule substitute)
  - Grade C: Nakshatra lord of sign/cusp lord of primary
  - Grade D: Sign lord of primary
- **Output:** `Record<Planet, SignificatorGrade>`
- **File:** `shamsiLogic.ts` → `rankSignificators()`
- **Gap Resolved:** Untenanted Planet Rule now implemented (returns Grade B substitute if primary is empty)

### Phase 3: Time-Window Narrowing
- **Input:** Mahadasha/Antardasha/Pratyantardasha (DBA) + 5 Ruling Planets
- **Process:** Filter DBA lords that:
  - Exist in Ruling Planets set
  - Are not retrograde/combust
  - Don't signify negating house
- **Output:** `TimeWindowResult` with operative planets + DBA periods
- **File:** `shamsiLogic.ts` → `narrowTimeWindow()`

### Phase 4: Transit Trigger
- **Input:** Event timeline (macro = years/months, micro = days/weeks)
- **Process:**
  - **Macro:** Sun transit of Mahadasha lord
  - **Micro:** Sun (month) → Moon (day) → Lagna (hour/minute)
- **Output:** `TransitTriggerResult` with exact timing windows
- **Files:** `transit.ts` (ephemeris scanning), `shamsiLogic.ts` → `resolveTransitTrigger()`
- **Performance Note:** Phase 4 can spawn 500+ chart builds (day/hour/minute stepping + binary-search refinement). Functionally correct, not optimized for speed.

## New House Mappings

| Question Type | Primary | Supporting | Negating | Use Case |
|---|---|---|---|---|
| `employment` | 6 | 2, 10, 11 | 5 | "Will I get hired?" |
| `career` | 10 | 2, 6, 11 | 6 | "Will I get promoted?" |
| `lawsuit` | 6 | 11 | 5, 12 | "Will I win this case?" |
| `marriage` | 7 | 2, 11 | 1, 6, 10 | "Will we marry?" |
| `property` | 4 | 11, 12 | 3 | "Will I buy this house?" |
| `relocation` | 12 | 3, 9 | 2, 4, 11 | "Will I settle abroad?" |

File: `shamsiHouseMatrix.ts`

## Location Requirement (HARD CONSTRAINT)

Shamsi Logic **requires real user location (latitude/longitude)** because:
- Placidus cusps shift rapidly with geographic coordinates (50-mile difference can flip verdict)
- Sub-Lords depend on exact cusp positions
- No fallback to default or generic location

**UX Impact:**
- Existing watch-oracle asks no location
- Shamsi Logic must collect GPS or manual entry
- Decision needed: **Replace watch-oracle or coexist?**

## Production Checklist Before Deployment

- [ ] **Validation:** Run 5 benchmark test cases (see below) against real horary questions with known astrologer verdicts
- [ ] **Location UX:** Decide replace vs. coexist strategy
  - Replace: Breaking change, simpler product
  - Coexist: User picks oracle mode, added complexity
- [ ] **Privacy Policy:** Update for location collection + retention
- [ ] **Permissions:** Android LOCATION (ACCESS_FINE_LOCATION) in manifest
- [ ] **Navigation:** Wire `AskShamsiScreen` and `ShamsiResultsScreen` into `RootNavigator`
- [ ] **Zustand Store:** Verify reading sync to Firestore (see `shamsiStore.ts`)
- [ ] **Cloud Function:** Validate `askShamsiOracle` quotas and error handling
- [ ] **Beta Test:** 20-50 users, monitor Crashlytics for Phase 4 performance issues
- [ ] **Monitoring:** Set up alerts for Cloud Functions runtime > 30s (Phase 4 can be slow)

## Testing

### Unit Tests (5 Benchmark Cases)

File: `functions/src/engine/rkp/__tests__/shamsiLogic.test.ts`

```bash
cd functions
npm test -- shamsiLogic.test.ts
```

Tests verify:
1. **Employment**: House 6 primary, PROMISED if StL signifies 6/2/10/11
2. **Lawsuit**: House 6 primary + 11 supporting, win logic
3. **Marriage**: House 7 primary, negating house is 1
4. **Property**: House 4 primary, investment support (11/12)
5. **Relocation**: House 12 primary, journey support (3/9)
6. **Phase 3 & 4 Integration**: Operative planets narrowed correctly, timeline respected

### Real-World Validation (Required Before Production)

Pick 5 real horary questions (from Astro Sarfaraz or historical records):
1. One employment query → run `judgeShamsiLogic()` → verify verdict matches astrologer's conclusion
2. One marriage query → same
3. One property query → same
4. One case where primary house is untenanted (exercises Grade B rule)
5. One macro event (exercises Phase 4 Sun transit)

Expected outcome: All 5 verdicts match within acceptable margin of interpretation.

## API Reference

### Main Entry Point

```typescript
const verdict = judgeShamsiLogic(chart, questionType);
// Returns: ShamsiVerdict {
//   promise: PromiseCheckResult
//   significators: Record<Planet, SignificatorGrade>
//   timeWindow: TimeWindowResult
// }
```

### Phase 4 (Optional, Expensive)

```typescript
if (verdict.promise.verdict === 'PROMISED') {
  const timing = resolveTransitTrigger(
    chart,
    verdict.timeWindow,
    EventTimeline.MACRO, // or MICRO
    createEphemerisAdapter(latitude, longitude),
    resolveKPCoordinates,
  );
  // Returns: TransitTriggerResult { sunWindow, moonWindow, lagnaWindow }
}
```

### Narration & Remedy

```typescript
const narration = composeShamsiNarration(verdict, timing, questionType, 'en');
// Returns: ShamsiNarration {
//   verdict: string (promise verdict in prose)
//   reasoning: string (CSL → StL chain)
//   remedy: RemedyRecommendation | null
//   timing: string | null (transit windows in prose)
// }
```

## Known Limitations & Future Work

1. **Performance**: Phase 4 builds ~500 charts per query. Optimize by implementing lightweight single-body ephemeris (doesn't exist yet).
2. **Untenanted Planet Rule**: Now implemented, but needs real-world validation.
3. **P/S House Mapping**: Current SHAMSI_HOUSE_MATRIX assumes spec mapping. Verify against all 6 question types with Astro Sarfaraz.
4. **Phase 4 Targeting Rule**: Sun → Mahadasha, Moon → Antardasha assumed from one example. Confirm this is universal or conditional.
5. **Hindi Translations**: Frozen (not backfilled). English + Urdu are current.
6. **Client/Server Parity**: `src/astrology/rkp/` and `functions/src/engine/rkp/` should be identical. Currently diverged — worth reconciling.

## Deployment Timeline

- **Stage 4 (Now):** Navigation, Store, Tests ✅
- **Real-World Validation:** Pick 5 questions, hand-test with astrologer (1-2 days)
- **Beta Testing:** 20-50 users, monitor Crashlytics + timing (3-5 days)
- **Production Rollout:** If stable, merge to main and deploy (1 day)

## Questions?

Refer to:
- `shamsiLogic.ts` — Core engine implementation
- `shamsiHouseMatrix.ts` — Question type routing
- `shamsiNarration.ts` — Prose composition
- `askShamsiOracle.ts` — Cloud Function entry point
- `shamsiStore.ts` — State management
