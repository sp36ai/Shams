/**
 * Architectural guards — server side.
 *
 *   G4  User-facing terminology in composed Oracle output for fixture questions
 *   G7  askWatchOracle still enforces App Check, Auth, Zod validation, rate
 *       limiting and quota — in that order, before anything is cast — and
 *       still carries its stage-tagged diagnostics.
 *
 * G1–G3, G5 and G6 live in src/__tests__/architectureGuards.test.ts. Both
 * suites read the single allowlist and banned-term list in
 * guards/allowlist.json (JSON, because this package's rootDir is ./src).
 *
 * Composed output is checked on the deterministic path only (reading contract
 * + deterministic fallback narration + brand seal). The live model path needs
 * the Anthropic key and is not run here.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type Mock } from 'vitest';

// ── Allowlist + banned terms ───────────────────────────────────────────────

interface AllowEntry {
  id: string;
  guard: string;
  kind: string;
  reason: string;
  match?: string;
  suite?: 'functions';
}

interface Allowlist {
  bannedUserFacingTerms: { terms: { term: string; pattern: string; flags: string }[] };
  entries: AllowEntry[];
}

const REPO = join(__dirname, '..', '..', '..');
const ALLOWLIST = JSON.parse(
  readFileSync(join(REPO, 'guards', 'allowlist.json'), 'utf8'),
) as Allowlist;

const BANNED_TERMS = ALLOWLIST.bannedUserFacingTerms.terms.map(t => ({
  term: t.term,
  pattern: new RegExp(t.pattern, t.flags),
}));

const OUTPUT_ENTRIES = ALLOWLIST.entries.filter(e => e.guard === 'G4' && e.suite === 'functions');

// ── G7 mocks (hoisted by vitest) ───────────────────────────────────────────

const order: string[] = [];

/** Captures the options askWatchOracle hands to onCall, and exposes the handler. */
vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  );
  return {
    ...actual,
    onCall: (opts: Record<string, unknown>, handler: (req: unknown) => Promise<unknown>) => ({
      __capturedOpts: opts,
      run: handler,
    }),
  };
});

vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth')>('../middleware/auth');
  return {
    ...actual,
    verifyAuth: (req: Parameters<typeof actual.verifyAuth>[0]) => {
      order.push('auth');
      return actual.verifyAuth(req);
    },
  };
});

vi.mock('../middleware/validate', async () => {
  const actual =
    await vi.importActual<typeof import('../middleware/validate')>('../middleware/validate');
  return {
    ...actual,
    parse: (...args: Parameters<typeof actual.parse>) => {
      order.push('validate');
      return actual.parse(...args);
    },
  };
});

const enforceRateLimitMock: Mock = vi.fn();
vi.mock('../middleware/rateLimit', () => ({
  enforceRateLimit: (userId: string) => {
    order.push('rateLimit');
    return enforceRateLimitMock(userId) as Promise<void>;
  },
}));

const claimRequestMock: Mock = vi.fn();
vi.mock('../utils/idempotency', () => ({
  claimRequest: (userId: string, requestId: string) => {
    order.push('idempotency');
    return claimRequestMock(userId, requestId) as Promise<unknown>;
  },
  completeRequest: vi.fn().mockResolvedValue(undefined),
  releaseRequest: vi.fn().mockResolvedValue(undefined),
}));

const claimQuotaSlotMock: Mock = vi.fn();
vi.mock('../utils/quotaSlots', () => ({
  claimQuotaSlot: (userId: string) => {
    order.push('quota');
    return claimQuotaSlotMock(userId) as Promise<unknown>;
  },
  refundQuotaSlot: vi.fn().mockResolvedValue(undefined),
}));

const collectionMock: Mock = vi.fn();
vi.mock('../utils/admin', () => ({
  db: { collection: (name: string) => collectionMock(name) as unknown },
  FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  hashText: (s: string) => `h${s.length}`,
}));

vi.mock('../middleware/telemetry', () => ({
  measure: <T>(_name: string, _userId: string, fn: () => Promise<T>) => fn(),
}));

import { HttpsError } from 'firebase-functions/v2/https';
import { buildWatchChart } from '../engine/rkp/watchChart';
import { judgeWatchChart, type DisplayWatchVerdict } from '../engine/rkp/watchJudgment';
import { diagnose } from '../engine/rkp/diagnosis';
import { classifyQuestion } from '../engine/kp/rules/questionKeywords';
import { selectRemedyProtocol } from '../oracle/remedySelection';
import { toBoundaryPlanetName } from '../utils/planetBoundaryName';
import { buildReadingContract, type ReadingContract } from '../oracle/readingContract';
import { buildDeterministicFallbackNarration } from '../oracle/narrationFallback';
import * as responseComposer from '../oracle/responseComposer';
import * as watchChartModule from '../engine/rkp/watchChart';
import * as watchJudgmentModule from '../engine/rkp/watchJudgment';
import * as questionKeywordsModule from '../engine/kp/rules/questionKeywords';

const { buildSpeakableText, ORACLE_BRAND_SEAL } = responseComposer;

// ── G4: composed Oracle output ─────────────────────────────────────────────

const FIXTURE_QUESTIONS = [
  'Will my marriage proposal be accepted?',
  'Will I get the promotion at work this year?',
  'Will my business partnership succeed?',
  'Will the money I lent be returned to me?',
  'Should I travel abroad for my studies?',
  'Will I find the ring I lost?',
  'Will my mother recover from her illness?',
];

const FIXTURE_MOMENTS = [
  '2026-09-09T09:00:00+02:00',
  '2026-10-01T03:17:00+05:30',
  '2026-11-15T14:42:00-05:00',
  '2026-12-31T22:05:00+00:00',
];

function contractFor(moment: string, question: string, readingId: string): ReadingContract {
  const chart = buildWatchChart(moment);
  const rawVerdict = judgeWatchChart(chart, classifyQuestion(question));
  const verdict: DisplayWatchVerdict = {
    ...rawVerdict,
    obstruction: toBoundaryPlanetName(rawVerdict.obstruction),
    targetRuler: toBoundaryPlanetName(rawVerdict.targetRuler),
    lagnaRuler: toBoundaryPlanetName(rawVerdict.lagnaRuler),
  };
  const diagnosis = diagnose(verdict);
  return buildReadingContract({
    readingId,
    computedAt: new Date('2026-10-25T00:00:00.000Z'),
    question,
    verdict,
    diagnosis,
    protocol: selectRemedyProtocol(diagnosis),
  });
}

interface Shown {
  where: string;
  text: string;
}

/** Everything from one reading that the seeker reads or hears. */
function userFacingText(contract: ReadingContract, label: string): Shown[] {
  const narration = buildDeterministicFallbackNarration(contract);
  const shown: Shown[] = Object.entries(narration).map(([field, text]) => ({
    where: `${label} narration.${field}`,
    text: String(text),
  }));
  shown.push({ where: `${label} speakable text`, text: buildSpeakableText(narration) });
  contract.remedy.steps.forEach((step, i) => {
    shown.push({ where: `${label} remedy[${i}].name`, text: step.name });
    shown.push({ where: `${label} remedy[${i}].explanation`, text: step.explanation });
    step.instructions.forEach((line, j) =>
      shown.push({ where: `${label} remedy[${i}].instructions[${j}]`, text: line }),
    );
  });
  return shown;
}

describe('G4 — user-facing terminology in composed Oracle output', () => {
  it('fixture readings carry no banned term (deterministic composition path)', () => {
    const shown: Shown[] = [{ where: 'ORACLE_BRAND_SEAL', text: ORACLE_BRAND_SEAL }];
    FIXTURE_MOMENTS.forEach((moment, m) =>
      FIXTURE_QUESTIONS.forEach((question, q) => {
        const label = `[${moment} | ${question}]`;
        shown.push(...userFacingText(contractFor(moment, question, `r-guard-${m}-${q}`), label));
      }),
    );
    const hits: string[] = [];
    for (const s of shown) {
      const terms = BANNED_TERMS.filter(t => t.pattern.test(s.text)).map(t => t.term);
      const allowed = OUTPUT_ENTRIES.some(
        e => e.match !== undefined && e.match.length > 0 && s.text.includes(e.match),
      );
      if (terms.length > 0 && !allowed) {
        hits.push(`${s.where}: "${terms.join('", "')}" in ${JSON.stringify(s.text.slice(0, 100))}`);
      }
    }
    if (hits.length > 0) {
      throw new Error(
        [
          'G4 — engine/Sanskrit terminology in composed Oracle output',
          ...[...new Set(hits)].map(h => `  ✗ ${h}`),
          'How to fix: the composer/remedy library must speak in Arabic celestial names and "Shams al-Asrār" wording (CLAUDE.md §3). Fix the source text; exceptions belong in guards/allowlist.json.',
        ].join('\n'),
      );
    }
  });

  it('every functions-suite G4 allowlist entry is still needed', () => {
    const shown = FIXTURE_MOMENTS.flatMap((moment, m) =>
      FIXTURE_QUESTIONS.flatMap((question, q) =>
        userFacingText(contractFor(moment, question, `r-guard-${m}-${q}`), ''),
      ),
    ).map(s => s.text);
    const unused = OUTPUT_ENTRIES.filter(
      e => e.match === undefined || !shown.some(t => t.includes(e.match as string)),
    ).map(e => e.id);
    expect(unused, `stale functions-suite allowlist entries: ${unused.join(', ')}`).toEqual([]);
  });
});

// ── G7: backend preservation ───────────────────────────────────────────────

interface CallableHarness {
  __capturedOpts: { enforceAppCheck?: unknown };
  run: (req: {
    data: unknown;
    auth?: { uid: string; token: Record<string, unknown> };
  }) => Promise<unknown>;
}

/**
 * Test harness, not production code. askWatchOracle.ts loads four modules
 * with a native `require()` of their .ts paths (lines 66–73), which vitest
 * cannot transform. Those four are loaded through vitest above and placed in
 * Node's require cache under their real paths, then the callable is imported.
 * A require() the harness does not know about throws loudly instead of
 * silently loading something else.
 */
const nodeRequire = createRequire(__filename);
const NATIVE_REQUIRES: [string, unknown][] = [
  [join(__dirname, '..', 'engine', 'rkp', 'watchChart.ts'), watchChartModule],
  [join(__dirname, '..', 'engine', 'rkp', 'watchJudgment.ts'), watchJudgmentModule],
  [join(__dirname, '..', 'engine', 'kp', 'rules', 'questionKeywords.ts'), questionKeywordsModule],
  [join(__dirname, '..', 'oracle', 'responseComposer.ts'), responseComposer],
];
let handler: CallableHarness;
let addedTsExtension = false;

beforeAll(async () => {
  if (nodeRequire.extensions['.ts'] === undefined) {
    nodeRequire.extensions['.ts'] = (_m: unknown, filename: string) => {
      throw new Error(
        `G7 harness: askWatchOracle natively required ${filename}, which the harness does not provide — add it to NATIVE_REQUIRES.`,
      );
    };
    addedTsExtension = true;
  }
  for (const [filename, exports] of NATIVE_REQUIRES) {
    nodeRequire.cache[filename] = {
      id: filename,
      filename,
      loaded: true,
      exports,
    } as unknown as NodeJS.Module;
  }
  const mod = await import('../functions/askWatchOracle');
  handler = mod.askWatchOracle as unknown as CallableHarness;
});

afterAll(() => {
  for (const [filename] of NATIVE_REQUIRES) {
    delete nodeRequire.cache[filename];
  }
  if (addedTsExtension) {
    delete nodeRequire.extensions['.ts'];
  }
});

const VALID_DATA = {
  question: 'Will my marriage proposal be accepted?',
  questionLang: 'en',
  utcOffsetMinutes: 330,
  requestId: 'guard-request-0001',
};
const AUTH = { uid: 'guard-user', token: {} };

/** The HttpsError code a call rejected with (or a description of what it did instead). */
async function rejectionCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof HttpsError ? err.code : `non-HttpsError: ${String(err)}`;
  }
  return 'resolved (no rejection)';
}

beforeEach(() => {
  order.length = 0;
  enforceRateLimitMock.mockReset().mockResolvedValue(undefined);
  claimRequestMock.mockReset().mockResolvedValue({ replay: null });
  claimQuotaSlotMock.mockReset();
  collectionMock.mockReset();
});

describe('G7 — askWatchOracle backend preservation', () => {
  it('enforces App Check outside the emulator', () => {
    expect(process.env.FUNCTIONS_EMULATOR).not.toBe('true');
    expect(
      handler.__capturedOpts.enforceAppCheck,
      'G7 — askWatchOracle must pass enforceAppCheck: true to onCall (functions/src/functions/askWatchOracle.ts). Do not remove App Check.',
    ).toBe(true);
  });

  it('rejects an unauthenticated call before validation, rate limiting or quota', async () => {
    const code = await rejectionCode(handler.run({ data: VALID_DATA }));
    expect(order, 'G7 — Auth (verifyAuth) must run first').toEqual(['auth']);
    expect(code).toBe('unauthenticated');
  });

  it('rejects invalid input via the Zod schema before rate limiting or quota', async () => {
    const code = await rejectionCode(handler.run({ data: { question: 'hi' }, auth: AUTH }));
    expect(order, 'G7 — Zod validation (parse) must run before the rate limit').toEqual([
      'auth',
      'validate',
    ]);
    expect(code).toBe('invalid-argument');
  });

  it('stops at the rate limit: no quota spent, nothing cast or stored', async () => {
    enforceRateLimitMock.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'slow down'));
    const code = await rejectionCode(handler.run({ data: VALID_DATA, auth: AUTH }));
    expect(order, 'G7 — rate limit must run before idempotency and quota').toEqual([
      'auth',
      'validate',
      'rateLimit',
    ]);
    expect(claimQuotaSlotMock).not.toHaveBeenCalled();
    expect(collectionMock).not.toHaveBeenCalled();
    expect(code).toBe('resource-exhausted');
  });

  it('stops at the quota: nothing cast or stored when no slot is granted', async () => {
    claimQuotaSlotMock.mockRejectedValueOnce(new HttpsError('resource-exhausted', 'no quota'));
    const code = await rejectionCode(handler.run({ data: VALID_DATA, auth: AUTH }));
    expect(order, 'G7 — order must be auth → validate → rateLimit → idempotency → quota').toEqual([
      'auth',
      'validate',
      'rateLimit',
      'idempotency',
      'quota',
    ]);
    expect(
      collectionMock,
      'G7 — no reading may be cast or written before a quota slot is granted',
    ).not.toHaveBeenCalled();
    expect(code).toBe('resource-exhausted');
  });

  it('keeps the stage-tagged engine diagnostics (light structural check)', () => {
    // Structural on purpose: the stages are diagnostic strings, and driving a
    // real failure through each stage would need mocking the engine itself.
    const src = readFileSync(join(__dirname, '..', 'functions', 'askWatchOracle.ts'), 'utf8');
    const stages = [
      'local-time',
      'chart-build',
      'classify-question',
      'judge-chart',
      'oracle-composition',
      'reading-doc-assembly',
      'firestore-write',
    ];
    const missing = stages.filter(s => !new RegExp(`\\bstage = '${s}'`).test(src));
    expect(
      missing,
      `G7 — askWatchOracle.ts lost stage tags: ${missing.join(', ')}. Keep every stage assignment (CLAUDE.md §5).`,
    ).toEqual([]);
    expect(
      /logger\.error\('askWatchOracle: engine failure', \{\s*stage,/.test(src),
      "G7 — askWatchOracle.ts must log `stage` in logger.error('askWatchOracle: engine failure', …).",
    ).toBe(true);
  });
});
