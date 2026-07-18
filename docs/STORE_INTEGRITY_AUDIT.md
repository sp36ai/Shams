# State-Management / Store Integrity — Audit

Scope: the four Zustand stores (`auth`, `quota`, `readings`, `settings`), their
MMKV persistence, the three teardown paths, and re-entrancy guards.

## Finding — cross-account readings leak on external sign-out (FIXED)

There are two ways a session ends:
1. **Explicit `signOut()`** — clears readings + quota, keeps settings (lazily
   cleared for a *different* uid via the `AUTH_LAST_UID` sentinel). ✔
2. **External session end** — password changed on another device, token
   revoked, account disabled/deleted server-side. This fires
   `onAuthStateChanged(null)` **without** the signOut teardown: only the display
   cache and plan were reset; **readings stayed in MMKV**.

If a *different* account then signed in on the device, the different-uid branch
reset settings but not readings — user B could open History and read user A's
questions and verdicts. **Fixed:** the different-uid branch now also runs
`readingsStore.clearAll()` + `quotaStore.reset()` + `invalidateQuotaCache()`
(idempotent when the explicit sign-out already ran; ordered before the new
user's claims-driven `setPlan`, so the fresh plan lands after the reset).

Same-user re-sign-in after an external sign-out keeps local history — safe by
construction, since the uid matches.

## Verified sound

- **Teardown matrix** (after the fix):

  | Path | readings | quota | settings | AUTH_LAST_UID |
  |---|---|---|---|---|
  | signOut() | cleared | reset | kept (by design) | kept (sentinel) |
  | deleteAccount() | cleared | reset | wiped | deleted |
  | different uid signs in | cleared | reset | wiped | overwritten |

- **Rehydration** is defensive: readings cache validates entry shape and
  self-heals on corrupt JSON (deletes the key); quota day-key rollover zeroes
  the counter; unknown plan strings fall back to `free`; trial state derives
  from the stored start date. All now locked by the store test suites.
- **Trial clock** reconciles to the server's authoritative start date
  (`reconcileTrialFromServer`) — a reinstall cannot re-gift a fresh 7 days; an
  unparseable server date is a no-op (tested).
- **Re-entrancy guards**: the ask path uses a synchronous `sendingRef`
  (immune to setState batching races), reset in `finally`; Auth buttons disable
  on `isLoading` + a 5-failure local lockout; `consumeOne` is a synchronous
  read-modify-write on the JS thread (no interleaving possible).
- **Single writer for auth state**: sign-in/up/Google only call Firebase;
  `onAuthStateChanged` is the sole place that sets `user`/plan/cache, avoiding
  racing token fetches (documented in-code).

## Notes (acceptable, no change)

- `usePurchase.purchase()` relies on the button's `disabled={purchasing}`
  rather than an internal re-entrancy check; a same-frame double-tap is
  theoretically possible, but the native Play sheet serializes purchases and
  the server binds each token to one account — no exploitable window.
- Plan claims read at bootstrap (`getIdTokenResult`) can be up to an hour
  stale; server-side quota enforcement is authoritative, so this only affects
  the locally displayed tier.
