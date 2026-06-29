import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase mocks — must be hoisted before any import that pulls firebase ───

const mockAdd = vi.fn().mockResolvedValue({});
const mockCollection = vi.fn(() => ({ add: mockAdd }));
const mockDoc = vi.fn(() => ({ collection: mockCollection }));
const mockDb = { collection: vi.fn(() => ({ doc: mockDoc })) };

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Subject under test ───────────────────────────────────────────────────────

import { runSafetyValidator } from '../safetyValidator';
import type { OracleResponse } from '../../types';

type OracleVoice = NonNullable<OracleResponse['oracle']>;

function makeOracle(overrides: Partial<OracleVoice> = {}): OracleVoice {
  return {
    opening: 'The gate opens before you.',
    interpretation: 'Al-Qamar aligns with the ascending house.',
    spiritual_layer: 'This season invites surrender to what has been written.',
    hidden_influence: 'The pattern indicates a thread of unresolved attachment.',
    timing: 'Before the new moon, the first sign will arrive.',
    signature: '✨ These words are unveiled under the banner of Shams al-Asrār, by Astro Sarfaraz.',
    remedy: {
      quran_verse: '2:286',
      asma: 'Yā Laṭīf',
      dua: 'Allāhumma yassir',
      zikr: 'Subḥānallāh',
      sadaqah: 'Give water.',
    },
    ...overrides,
  };
}

const API_KEY = 'test-key';
const READING_ID = 'reading_123';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchTimeout() {
  global.fetch = vi.fn().mockRejectedValue(new Error('AbortError: request timed out'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdd.mockResolvedValue({});
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runSafetyValidator', () => {
  it('Test 1 — clean content: approved fields pass through unmodified, no issues logged', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockImplementation(() => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'approved',
              issues: [],
              final_text: 'original',
            }),
          },
        ],
      })),
    });

    const oracle = makeOracle();
    const result = await runSafetyValidator(oracle, READING_ID, API_KEY);

    // Locked fields untouched
    expect(result.opening).toBe(oracle.opening);
    expect(result.interpretation).toBe(oracle.interpretation);
    expect(result.signature).toBe(oracle.signature);

    // Validated fields: Haiku returned 'approved' — no Firestore log written with issues
    expect(mockAdd).not.toHaveBeenCalled();
    // warning is undefined in makeOracle → skipped; 3 fields validated (hidden_influence, spiritual_layer, timing)
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('Test 2 — validator failure: original text returned, validator_failed logged, no throw', async () => {
    mockFetchTimeout();

    const oracle = makeOracle();
    const result = await runSafetyValidator(oracle, READING_ID, API_KEY);

    // Fail-open: all original texts preserved
    expect(result.spiritual_layer).toBe(oracle.spiritual_layer);
    expect(result.hidden_influence).toBe(oracle.hidden_influence);
    expect(result.timing).toBe(oracle.timing);
    expect(result.opening).toBe(oracle.opening);
    expect(result.signature).toBe(oracle.signature);

    // No throw — promise resolves
    await expect(runSafetyValidator(oracle, READING_ID, API_KEY)).resolves.toBeDefined();

    // validator_failed was logged (mockAdd called from per-field catch blocks)
    expect(mockAdd).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const loggedArg = mockAdd.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(loggedArg.status).toBe('validator_failed');
    expect(Array.isArray(loggedArg.issues)).toBe(true);
    expect((loggedArg.issues as string[]).length).toBeGreaterThan(0);
  });
});
