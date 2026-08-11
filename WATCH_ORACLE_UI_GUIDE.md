# Watch Oracle UI Integration Guide

## ✅ Integration Complete

The watch oracle has been successfully wired into the application UI with a full end-to-end integration from question to rendered remedy protocol.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      OracleChatScreen                           │
│           (Question/Verdict Conversation Interface)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   User asks question + seeker      │
        │   profile (location optional)      │
        └────────────────┬───────────────────┘
                         │
        ┌────────────────▼────────────────────┐
        │       runEngine() executes          │
        │     parallel API calls              │
        └────┬──────────────────────┬─────────┘
             │                      │
    ┌────────▼──────┐      ┌───────▼─────────┐
    │   askOracle   │      │ askWatchOracle  │
    │ (needs lat/lon)      │ (no location)   │
    └────────┬──────┘      └────────┬────────┘
             │                      │
    ┌────────▼──────┐      ┌───────▼─────────┐
    │  Astronomical │      │   Watch Oracle  │
    │    Reading    │      │   Composition   │
    └────────┬──────┘      └────────┬────────┘
             │                      │
             └──────────┬───────────┘
                        │
        ┌───────────────▼─────────────┐
        │  Reading object (combined)  │
        │  ├─ verdictJson            │
        │  ├─ chartJson              │
        │  └─ watch_oracle:          │
        │      ├─ verdict            │
        │      ├─ composition         │
        │      ├─ window              │
        │      ├─ lagnaSignName       │
        │      └─ lagnaRulerName      │
        └───────────────┬─────────────┘
                        │
        ┌───────────────▼──────────────────────┐
        │  Message added to chat with Reading  │
        └───────────────┬──────────────────────┘
                        │
                ┌───────▼────────┐
                │ showWatch toggle
                └───────┬────────┘
              │         │
        ┌─────▼─┐  ┌────▼──────┐
        │ false │  │ true      │
        └─────┬─┘  └────┬──────┘
              │         │
         ┌────▼──────────▼────────┐
         │  watch_oracle exists?  │
         └────┬──────────────┬────┘
         yes  │              │  no
         ┌────▼────┐    ┌────▼──────┐
         │ RkpWatch│    │ WatchVerdic
         │Card +   │    │ tCard (legacy)
         │Remedy   │    └────┬──────┘
         │Protocol │         │
         │Card     │    ┌────▼──────┐
         └─────────┘    │ AstroVerdic
                        │ tCard      │
                        └────────────┘
```

## Component Hierarchy

```
OracleChatScreen
├─ [Chat Message List]
│  └─ ChatMessage (for each message)
│     └─ [Conditional Verdict Card Rendering]
│        ├─ if (showWatch && watch_oracle exists)
│        │  ├─ RkpWatchCard
│        │  │  ├─ STATE_HEADLINE
│        │  │  ├─ Obstruction display
│        │  │  ├─ Timing range
│        │  │  └─ onSwitchMode()
│        │  └─ RemedyProtocolCard
│        │     ├─ OUTCOME_HEADLINE
│        │     ├─ OUTCOME_TONE (color)
│        │     ├─ POSTURE_LABEL (timing)
│        │     ├─ EVIDENCE_LABEL badges
│        │     ├─ CATEGORY_LABEL badges
│        │     ├─ No-remedy guidance (if applicable)
│        │     ├─ ProtocolStep components
│        │     │  ├─ Remedy name
│        │     │  ├─ Category badge
│        │     │  ├─ Evidence type badge
│        │     │  ├─ Duration badge
│        │     │  ├─ Explanation
│        │     │  └─ Instructions (bulleted)
│        │     ├─ Professional referral (if applicable)
│        │     ├─ Narration prose
│        │     └─ "Why this was chosen" explanation
│        ├─ else if (showWatch && no watch_oracle)
│        │  └─ WatchVerdictCard (backward compatibility)
│        └─ else
│           └─ AstroVerdictCard
└─ [Composer, Settings, etc.]
```

## Data Types

### Reading (extended in `readingsStore.ts`)

```typescript
interface Reading {
  id: string;
  question: string;
  questionLang: 'en' | 'ur' | 'hi';
  category: QuestionCategory;
  verdict: VerdictKind;
  createdAt: string;
  chartJson: unknown; // Astronomical chart
  verdictJson: unknown; // Astronomical verdict

  // NEW: Watch oracle data
  watch_oracle?: {
    // Raw 5-minute bracket judgment
    verdict: DisplayWatchVerdict;

    // Diagnosis, protocol, and narration
    composition: WatchOracleComposition;

    // Bracket metadata
    window: { startMinute: number; endMinute: number };
    lagnaSignName: string; // "Burj Jauza"
    lagnaRulerName: string; // "Utarid"
  };
}
```

### WatchOracleComposition

```typescript
interface WatchOracleComposition {
  narration: OracleNarration | null;

  diagnosis: {
    outcome: RkpOutcome; // FAVOURABLE | UNFAVOURABLE | DELAYED | etc.
    primaryPattern: ImbalancePattern; // OBSTRUCTION | CONFLICT | etc.
    secondaryPatterns: ImbalancePattern[];
    timingPosture: TimingPosture; // ACT_NOW | WAIT | etc.
    confidence: number; // 0–1
    obstructingAgent: string | null; // Planet name
    rationale: string[]; // Audit trail
  };

  protocol: {
    interventionRequired: boolean;
    guidance: string | null;
    steps: OracleProtocolStep[];
    rationale: string[];
  };
}
```

## Key Features

### 1. Parallel Execution

- Astronomical oracle and watch oracle are called in parallel via `Promise.all()`
- No waiting for one to complete before starting the other
- Reduces perceived latency

### 2. Graceful Degradation

- If watch oracle fails → astronomical oracle still works
- If astronomical oracle fails → watch oracle still works (no location needed)
- If narration synthesis fails → diagnosis and protocol remain intact

### 3. Evidence Transparency

Every remedy step shows:

- **Category**: Contemplative / Devotional / Astrological / Behavioral / Professional
- **Evidence Type**: Scriptural / Traditional / Astrological / Behavioral
- Users know exactly what kind of authority each remedy carries

### 4. Safety Escalation

- Health questions always refer to doctor
- Legal questions always refer to lawyer
- Financial questions conditionally refer to advisor (only if reading is adverse)
- Referrals are shown first, ahead of practices

### 5. No-Remedy Result

- Clean charts don't get unnecessary prescriptions
- Instead shown guidance: "No remedy needed"
- Seeker understands the chart is favorable and no action is required

## User Flow

### Scenario 1: User Asks a Question

```
1. User types question in OracleChatScreen composer
2. Taps "Ask" button
3. runEngine() called with question + profile + (optional) location
4. Both askOracle() and askWatchOracle() execute in parallel
5. Results combined into single Reading object
6. Message added to chat with both verdicts attached
7. By default shows AstroVerdictCard (astronomical oracle)
8. User can tap "Switch" button to see RkpWatchCard + RemedyProtocolCard
```

### Scenario 2: Toggle Between Modes

```
Initial state: showWatch = false
├─ Screen shows AstroVerdictCard
└─ "Switch mode" button visible

User taps "Switch mode"
├─ showWatch = true
├─ if (watch_oracle exists):
│  └─ Screen shows RkpWatchCard + RemedyProtocolCard
└─ else:
   └─ Screen shows WatchVerdictCard (legacy)

User taps "Switch mode" again
├─ showWatch = false
└─ Screen shows AstroVerdictCard
```

### Scenario 3: Health Question

```
User: "Will my surgery go well?"
    ↓
Engine recognizes qType = 'health'
    ↓
Watch oracle diagnosis + remedy protocol generated
    ↓
selectRemedyProtocol() identifies mandatory health escalation
    ↓
escalation field set to professional_medical remedy
    ↓
Protocol returned with:
  - interventionRequired = true
  - escalation = professional referral
  - steps = [practical_medical, ...other_remedies]
    ↓
RemedyProtocolCard shows:
  - Escalation box first (marked with !)
  - "Consult a qualified doctor"
  - Any additional spiritual practices below
```

## Testing Verification

All tests pass:

- ✅ 13 diagnosis tests (outcome classification, imbalance patterns, timing posture)
- ✅ 19 remedy selection tests (no-remedy, safety escalation, quality checks)
- ✅ 14 component tests (headlines, labels, numbering, confidence phrasing)
- ✅ Type checking passes
- ✅ Linting passes

## File Modifications Summary

| File                                           | Change                                        | Purpose                                          |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| `src/stores/readingsStore.ts`                  | Extended Reading type                         | Store watch_oracle data alongside astronomical   |
| `src/screens/OracleChatScreen.tsx`             | Updated imports, runEngine(), rendering logic | Wire askWatchOracle call and component rendering |
| `src/firebase/watchOracle.ts`                  | Already existed                               | Client wrapper for askWatchOracle                |
| `src/components/oracle/RkpWatchCard.tsx`       | Already existed                               | Render watch verdict                             |
| `src/components/oracle/RemedyProtocolCard.tsx` | Already existed                               | Render protocol & narration                      |

## API Integration Points

### `askWatchOracle()`

**Location**: `src/firebase/watchOracle.ts`  
**Purpose**: Call watch oracle Cloud Function  
**Params**: question, questionLang, seekerProfile  
**Returns**: WatchReading with verdict, oracle composition, and metadata  
**Error handling**: Non-fatal (caught in Promise.all, reading falls back to astro only)

### `callOracleFunction()` (existing)

**Location**: `src/firebase/oracle.ts`  
**Purpose**: Call astronomical oracle Cloud Function  
**Params**: question, lat, lon, questionLang, seekerProfile, seekerName, motherName  
**Returns**: Reading with verdictJson and chartJson  
**Requirements**: Location data required

## Future Enhancement Opportunities

1. **Separate Watch Oracle Screen** — Dedicated view for watch oracle (full-screen immersive experience)
2. **Watch Oracle Library** — Save and browse previous watch oracle readings
3. **Timing Alerts** — Visual emphasis on urgent ("Act now") vs. patient ("Wait long") readings
4. **Directional Remedies** — Show compass directions and physical correspondences
5. **Multi-Language Narration** — Extend Claude prose to Urdu and Hindi
6. **Remedy Deep Dive** — Tap on a remedy step for full explanation and instructions
7. **Share Readings** — Export or share watch oracle readings with clarity
8. **Calendar Integration** — Show timing posture alongside calendar app

## Verification Checklist

- [x] askWatchOracle calls execute in parallel with astronomical oracle
- [x] Reading type supports optional watch_oracle field
- [x] RkpWatchCard correctly displays verdict data
- [x] RemedyProtocolCard correctly renders protocol and narration
- [x] Toggle between modes works (showWatch state)
- [x] Graceful degradation when watch oracle fails
- [x] All type checks pass
- [x] All linting passes
- [x] Tests continue to pass
- [x] No breaking changes to existing functionality
- [x] Documentation complete

---

**Status**: ✅ Ready for user testing and refinement
