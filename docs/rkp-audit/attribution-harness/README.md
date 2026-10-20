# Attribution harness (scaffolding)

Reproduces the leave-one-out / add-one-in replay behind `../OD-002_PHASE1_REVIEW.md`. Not part of the
deployed bundle. Paths are the ones used in this session and may need adjusting.

Prerequisites
- A worktree of the parent commit: `git worktree add /tmp/wt_parent 72a5021` (with `node_modules` symlinked
  into it and into its `functions/`), then `generate-golden-corpus.ts` run there and copied to
  `/tmp/golden_before` (111 case files; the replay reads inputs from them).
- Engine variants: `python3 build_variants.py` copies `functions/src/engine` to `/tmp/var/<variant>/engine`
  seven times with one rule reverted (`r_*`), seven times with only that rule kept (`only_*`), and once with
  every rule reverted (`all_reverted`). The `old` variant is the parent worktree's engine, copied to
  `/tmp/var/old/engine`.
- Replay: from `functions/`, `npx vite-node /tmp/var/run_variants.ts` (the process may not exit by itself
  once it prints `done 111`; stop it then). Output: `/tmp/var/result_all.json`.

Checks that must pass before trusting a result: `old` equals the captured baseline in all 111 cases, and
`all_reverted` equals `old` (state, score and timing) in all 111 cases.
