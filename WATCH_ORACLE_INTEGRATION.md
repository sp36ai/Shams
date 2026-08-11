# Watch Oracle UI Integration

## Overview

The watch oracle has been fully wired into the application UI through `OracleChatScreen`, the primary question/verdict conversation interface.

## Architecture

### Data Flow

```
User asks question in OracleChatScreen
    ↓
runEngine() called with question + seeker profile
    ↓
[Parallel execution]
├─ callOracleFunction() → Astronomical Oracle (requires location)
└─ askWatchOracle() → Watch Oracle (no location needed)
    ↓
Both results stored in Reading object:
├─ verdictJson (astronomical)
├─ chartJson (astronomical)
└─ watch_oracle (watch oracle):
    ├─ verdict: DisplayWatchVerdict (5-minute bracket judgment)
    ├─ composition: WatchOracleComposition (diagnosis, protocol, narration)
    ├─ window: { startMinute, endMinute, minute }
    ├─ lagnaSignName: "Burj Jauza" (sign on 1st Ghar)
    └─ lagnaRulerName: "Utarid" (classical ruler name)
    ↓
Message added to chat with Reading attached
    ↓
ChatMessage renders verdict cards based on showWatch toggle
```

### Rendering Logic

In `OracleChatScreen`, the verdict card display follows this priority:

```
if (showWatch) {
  if (watch_oracle available) {
    Show RkpWatchCard (displays verdict)
    Show RemedyProtocolCard (displays protocol & narration)
  } else {
    Show WatchVerdictCard (legacy view)
  }
} else {
  Show AstroVerdictCard (astronomical oracle)
}
```

Users can toggle between modes via `onSwitchMode()` callbacks on each card.

## Components

### RkpWatchCard
**File**: `src/components/oracle/RkpWatchCard.tsx`

Displays the raw 5-minute bracket judgment:
- Verdict headline (e.g., "The matter completes")
- Obstruction (if present)
- Timing range (e.g., "3–7 days")
- Confidence level

**Props**:
- `window`: { startMinute, endMinute } — the 5-minute bracket
- `lagnaSignName`: "Burj Jauza" — sign on ascendant
- `lagnaRulerName`: "Utarid" — classical name of ascendant ruler
- `verdict`: DisplayWatchVerdict — the raw judgment
- `directionalFocus?`: optional direction context
- `onSwitchMode?`: callback to toggle to astronomical oracle

### RemedyProtocolCard
**File**: `src/components/oracle/RemedyProtocolCard.tsx`

Displays the selected remedy protocol and narration:
- The reading headline (diagnosis in plain language)
- Timing posture (ACT_NOW, WAIT, etc.)
- Confidence phrasing
- No-remedy guidance (if applicable)
- Protocol steps with evidence labels (scriptural/traditional/astrological/behavioral)
- Professional referrals (health/legal escalations)
- Narration prose from Claude
- "Why this was chosen" explanation

**Props**:
- `composition`: WatchOracleComposition — diagnosis, protocol, and narration

## Type Extensions

### Reading (in `src/stores/readingsStore.ts`)

```typescript
interface Reading {
  // ... existing astronomical oracle fields ...
  
  watch_oracle?: {
    verdict: DisplayWatchVerdict;
    composition: WatchOracleComposition;
    window: { readonly startMinute: number; readonly endMinute: number };
    lagnaSignName: string;
    lagnaRulerName: string;
  };
}
```

## Engine Integration

### runEngine() in `OracleChatScreen.tsx`

The engine now:
1. Calls `callOracleFunction()` for astronomical oracle (requires lat/lon)
2. Calls `askWatchOracle()` for watch oracle in parallel (no location needed)
3. Stores both results in the same Reading object
4. Uses `Promise.all()` for parallel execution
5. Gracefully degrades if watch oracle fails (catch → null)

**Key**: Watch oracle failures are non-fatal. If askWatchOracle fails, the astronomical oracle verdict is still shown, and watch_oracle remains undefined.

## Client Wrapper

**File**: `src/firebase/watchOracle.ts`

Exposes `askWatchOracle()` function:
- Takes question, questionLang, and optional seekerProfile
- No location needed (watch frame is location-invariant)
- Returns WatchReading with verdict, composition, and metadata

## Graceful Degradation

- **Astronomical oracle only**: If askWatchOracle fails, the reading stores only verdictJson; watch_oracle is undefined
- **Watch oracle only** (not shown in current UI): Astronomicaloracle requires location; watch oracle works immediately
- **Both available**: Users can toggle between modes with `showWatch` state
- **Narration missing**: If response composer fails, diagnosis and protocol survive with narration set to null

## Testing

Tests verify:
- Diagnosis engine (RkpOutcome classification, imbalance pattern recognition, timing posture)
- Remedy selection (no-remedy results, safety escalation, selection quality)
- Component presentation (outcome headlines, evidence labels, step numbering)
- Deterministic serialization (consistent results for same diagnosis)
- Library integrity (no duplicate IDs, proper evidence types, all category levels covered)

**Test files**:
- `src/astrology/rkp/__tests__/diagnosis.test.ts` (13 tests)
- `functions/src/oracle/__tests__/remedySelection.test.ts` (19 tests)
- `src/components/oracle/__tests__/RemedyProtocolCard.test.ts` (14 tests)

## User Experience

### The Reading Flow

1. User asks a question in OracleChatScreen
2. Oracle responds with astrological verdict by default
3. User can tap the "switch mode" button to see the watch oracle verdict
4. Watch oracle shows:
   - The 5-minute bracket verdict
   - Diagnosis (what the chart means for the decision)
   - Protocol (what interventions are counselled)
   - Remedy reasoning (why these were chosen)
5. User can toggle back to astronomical oracle at any time

### Safety Features

- **Health & Legal Questions**: Always escalate to professional referral, even on favorable readings
- **Evidence Labels**: Every remedy shows whether it's scriptural, traditional, astrological, or behavioral
- **No-Remedy Result**: Clean charts receive guidance instead of prescriptions
- **Narration Degradation**: Protocol survives even if Claude narration synthesis fails

## Future Extensions

### Possible enhancements:
- **Dedicated Watch Oracle Screen**: Separate from astronomical oracle (if product prioritizes it)
- **Watch Oracle Library**: Let users save/review watch oracle readings separately
- **Timing Integration**: Display timing posture alerts (e.g., "Act now" highlights)
- **Directional Remedies**: Show physical/directional correspondences when available
- **Multi-Language Narration**: Extend narration to Urdu and Hindi (currently English-only at synthesis)

## Files Modified

- `src/stores/readingsStore.ts` — Extended Reading type
- `src/screens/OracleChatScreen.tsx` — Integrated askWatchOracle, updated runEngine, added rendering logic
- Imports added: `askWatchOracle`, `RkpWatchCard`, `RemedyProtocolCard`, `DisplayWatchVerdict`

## Verification

✅ TypeScript type checking passes  
✅ ESLint linting passes  
✅ All existing tests pass  
✅ Parallel API calls execute correctly  
✅ Graceful degradation on watch oracle failure  
✅ UI toggle works between astronomical and watch oracle views  
