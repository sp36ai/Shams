# Manual E2E flows

These flows exercise paths that cannot run in CI because they depend on
secrets or backend state that the CI environment does not have:

| Flow | Requirement |
| --- | --- |
| `03_oracle_ask_question.yaml` | A signed-in account and a backend that accepts the build's App Check token (register the debug token in Firebase console, or run a release build on a real device). |
| `04_quota_enforcement.yaml` | A free-plan account whose daily quota (3 questions) is already exhausted. |
| `06_invalid_question_gate.yaml` | `ANTHROPIC_API_KEY` baked into the build — without it the question gate classifies everything as a valid horary question by design. |

Run them locally against an emulator or device:

```bash
maestro test .maestro/manual/<flow>.yaml
```

The CI suite lives in `.maestro/ci/` and is fully self-contained.
