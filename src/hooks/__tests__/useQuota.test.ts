/**
 * useQuota — syncing plan/planExpiry from the server, not just `remaining`.
 * --------------------------------------------------------------------------
 * getQuota's server response carries { plan, used, limit, remaining,
 * dayKey, planExpiry } (functions/src/types.ts QuotaResponse), and the
 * server is authoritative: it self-heals an expired paid plan to 'free' on
 * every call (functions/src/functions/quota.ts). Before this fix, the
 * refresh() callback below read only `remaining` and threw the rest away —
 * isPremium/canAsk were derived entirely from the LOCAL quotaStore's `plan`,
 * which is set once at sign-in from the Firebase Auth ID token's custom
 * claims (authStore.ts) and never otherwise corrected, because nothing
 * anywhere revokes that claim when a subscription actually expires (no
 * `auth.setCustomUserClaims` call in this codebase ever downgrades one). A
 * lapsed subscriber would see "unlimited" in the UI indefinitely.
 *
 * These tests prove refresh() now reconciles quotaStore's plan/planExpiry
 * against every getQuota response, using the real mocked httpsCallable
 * (__mocks__/functionsRegion.js) rather than re-deriving the pipeline.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { httpsCallable } from '../../firebase/functionsRegion';
import { useQuotaStore } from '@stores/quotaStore';
import { useQuota, invalidateQuotaCache } from '../useQuota';

beforeEach(() => {
  useQuotaStore.getState().reset();
  invalidateQuotaCache();
});

describe('useQuota — reconciling plan/planExpiry from getQuota', () => {
  it('downgrades a stale local "khass" to the server-confirmed "free" after a subscription lapses', async () => {
    // Simulates exactly the bug scenario: the client still believes it's on
    // a paid plan (set once at sign-in from a since-lapsed Auth claim), but
    // the server's own self-heal has already corrected the true state.
    useQuotaStore.getState().setPlan('khass', '2020-01-01T00:00:00.000Z');
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'getQuota') {
        return jest.fn(() =>
          Promise.resolve({ data: { plan: 'free', planExpiry: null, remaining: 2 } }),
        );
      }
      return jest.fn(() => Promise.resolve({ data: {} }));
    });

    await renderHook(() => useQuota());

    await waitFor(() => expect(useQuotaStore.getState().plan).toBe('free'));
    expect(useQuotaStore.getState().planExpiry).toBeNull();
  });

  it('reflects a genuinely active paid plan the same way', async () => {
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'getQuota') {
        return jest.fn(() =>
          Promise.resolve({
            data: { plan: 'mureed', planExpiry: '2027-01-01T00:00:00.000Z', remaining: null },
          }),
        );
      }
      return jest.fn(() => Promise.resolve({ data: {} }));
    });

    await renderHook(() => useQuota());

    await waitFor(() => expect(useQuotaStore.getState().plan).toBe('mureed'));
    expect(useQuotaStore.getState().planExpiry).toBe('2027-01-01T00:00:00.000Z');
  });

  it('the returned isPremium/canAsk reflect the reconciled plan, not the stale one the hook started with', async () => {
    useQuotaStore.getState().setPlan('khass', '2020-01-01T00:00:00.000Z');
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'getQuota') {
        return jest.fn(() =>
          Promise.resolve({ data: { plan: 'free', planExpiry: null, remaining: 0 } }),
        );
      }
      return jest.fn(() => Promise.resolve({ data: {} }));
    });

    const { result } = await renderHook(() => useQuota());

    await waitFor(() => expect(result.current.isPremium).toBe(false));
    // remaining: 0 and no longer premium — the Ask/Send gate must reflect it.
    expect(result.current.canAsk).toBe(false);
  });

  it('a getQuota failure leaves the local plan untouched rather than clearing it', async () => {
    useQuotaStore.getState().setPlan('khass', '2027-01-01T00:00:00.000Z');
    (httpsCallable as jest.Mock).mockImplementation((name: string) => {
      if (name === 'getQuota') {
        return jest.fn(() => Promise.reject(new Error('network down')));
      }
      return jest.fn(() => Promise.resolve({ data: {} }));
    });

    const { result } = await renderHook(() => useQuota());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Fail-open on plan (a real subscriber keeps their premium UI during a
    // transient network blip); serverRemaining alone reflects the failure.
    expect(useQuotaStore.getState().plan).toBe('khass');
    expect(result.current.serverRemaining).toBeNull();
  });
});
