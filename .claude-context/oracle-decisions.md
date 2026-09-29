# RKP Oracle Decision Log
**Canonical Source:** Watch Engine (server-side)  
**Audit Trail:** Firestore + local MMKV history  

## Decision Format
```
### [TIMESTAMP UTC]
- **Question:** [User query]
- **Stage:** [RKP Watch Engine diagnostics]
- **RKP Judgment:** [Engine output]
- **Composed Response:** [responseComposer text]
- **Audio:** [TTS status if applicable]
- **Firestore ID:** [audit log reference]
- **Verified:** [Yes/No - production evidence]
```

## Recent Decisions
(Auto-logged by askWatchOracle)

---
**Rules:**
- Oracle only: No KP fallbacks
- Voice = speech-to-text → same askWatchOracle pipeline
- Audio = TTS of Oracle response (never separate judgment)
- Sky Clock = display only (not judgment engine)
