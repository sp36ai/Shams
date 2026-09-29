# Shared Context System
**Purpose:** Sync Claude Code and Claude Chrome automatically via Git  
**Format:** Markdown files in `.claude-context/`  

## Files

| File | Purpose | Updated By |
|------|---------|------------|
| `current-task.md` | Active work, blockers, next steps | Both tools |
| `oracle-decisions.md` | RKP judgments, audit trail | Claude Code (Oracle logs) |
| `code-changes.md` | Code modifications, test status | Claude Code (Auto-sync post-commit) |
| `session-log.md` | Who did what, when, outcome | Both tools |
| `README.md` | This file | Manual |

## How It Works

### Claude Code (this session)
1. Make code changes
2. Commit to branch
3. **Auto-update** `.claude-context/code-changes.md`
4. Push to `claude/eager-newton-lhajbq`
5. Chrome fetches and reads `.claude-context/`

### Claude Chrome
1. Pull branch
2. Read `.claude-context/*.md`
3. Test changes / validate Oracle
4. Add feedback to `session-log.md`
5. Commit and push
6. Claude Code reads feedback on next run

## Quick Start

**For Claude Code:**
```bash
# After making changes:
git add .claude-context/
git commit -m "Update context: [what changed]"
git push -u origin claude/eager-newton-lhajbq
```

**For Claude Chrome:**
```
1. Open repo in Claude Chrome
2. Read: .claude-context/current-task.md
3. Read: .claude-context/code-changes.md
4. Validate/test changes
5. Update: .claude-context/session-log.md
6. Commit & push
```

## Rules
- ✅ Commit context file updates with code changes
- ✅ Pull latest before starting work
- ✅ Keep timestamps UTC
- ❌ Don't delete `.claude-context/` files
- ❌ Don't manually merge conflicts (use pull/rebase)

## Oracle-Specific
- **askWatchOracle** logs go to `oracle-decisions.md` with Firestore audit ID
- **RKP judgments** stamped with stage diagnostics
- **Voice questions** traced through same pipeline (no separate KP logic)
- **Audio playback** never generates independent judgment

---
**Created:** 2026-09-25  
**System:** Automated cross-tool context sync
