/**
 * Architectural guards — the repository enforcing its own invariants.
 *
 * RKP calculates. Oracle composes. UI displays. Audio speaks. The client
 * never invents judgment (CLAUDE.md §2–3). These tests read the source with
 * the TypeScript parser (no runtime, no new dependency) and fail when a change
 * breaks one of those rules:
 *
 *   G1  No KP resurrection (imports, file names, identifiers, string literals)
 *   G2  Voice isolation (voice modules never reach astrology/engine/oracle code)
 *   G3  Client never judges (no judgment imports outside the approved primitives)
 *   G4  User-facing terminology (static copy; composed output is checked in
 *       functions/src/__tests__/architectureGuards.test.ts)
 *   G5  Ruling Planet integrity — it.todo, owner decision OD-5
 *   G6  manzilLord scope (planetChain entries only)
 *   (G7, backend preservation, lives in the functions suite.)
 *
 * Comments are never scanned: the parser only yields code tokens and string
 * literals, so provenance comments ("KP-era type…") stay legal.
 *
 * Every exception lives in guards/allowlist.json with a reason. Debt entries
 * carry a date and fail 30 days after it, so they cannot be forgotten.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, posix, resolve } from 'path';
import ts from 'typescript';

const REPO = resolve(__dirname, '..', '..');
const DEBT_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

// ── Allowlist ──────────────────────────────────────────────────────────────

interface AllowEntry {
  id: string;
  guard: string;
  kind: 'approved' | 'provenance' | 'debt';
  reason: string;
  debtDate?: string;
  /** Exact repo-relative file the entry applies to. */
  file?: string;
  /** Repo-relative directory prefix (ends with "/") the entry applies to. */
  pathPrefix?: string;
  /** Substring of the flagged string literal / identifier. */
  match?: string;
  /** G3: engine module (repo-relative, resolved) a client file may value-import. */
  target?: string;
  /** G3: the only bindings that may be value-imported from `target`. */
  symbols?: string[];
  /** G3: whether Sky Clock files may use this entry. */
  skyClock?: boolean;
  /** Entries checked by the functions suite instead of this one. */
  suite?: 'functions';
}

interface Allowlist {
  scanExclusions: { path: string; reason: string }[];
  openOwnerDecisions: { id: string; topic: string; note: string }[];
  bannedUserFacingTerms: { terms: { term: string; pattern: string; flags: string }[] };
  entries: AllowEntry[];
}

const ALLOWLIST_PATH = 'guards/allowlist.json';
const ALLOWLIST = JSON.parse(readFileSync(join(REPO, ALLOWLIST_PATH), 'utf8')) as Allowlist;
const EXCLUDED = new Set(ALLOWLIST.scanExclusions.map(e => e.path));
const usedEntries = new Set<string>();

function entriesFor(guard: string): AllowEntry[] {
  return ALLOWLIST.entries.filter(e => e.guard === guard && e.suite !== 'functions');
}

function appliesToFile(entry: AllowEntry, rel: string): boolean {
  return (
    (entry.file !== undefined && entry.file === rel) ||
    (entry.pathPrefix !== undefined && rel.startsWith(entry.pathPrefix))
  );
}

/** Finds the allowlist entry covering this hit, and records that it was used. */
function allowedBy(guard: string, rel: string, text?: string): AllowEntry | undefined {
  const entry = entriesFor(guard).find(
    e =>
      appliesToFile(e, rel) &&
      (e.match === undefined || (text !== undefined && text.includes(e.match))),
  );
  if (entry !== undefined) {
    usedEntries.add(entry.id);
  }
  return entry;
}

function report(guard: string, rule: string, hits: string[], fix: string): string {
  return [
    `${guard} — ${rule}`,
    ...hits.map(h => `  ✗ ${h}`),
    `How to fix: ${fix}`,
    `Exceptions belong in ${ALLOWLIST_PATH}, with a reason (and a debtDate for debt).`,
  ].join('\n');
}

// ── File walking ───────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', 'lib', '.git', 'build', 'dist']);
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs)$/;

function walk(relDir: string, filter: RegExp = CODE_FILE): string[] {
  const abs = join(REPO, relDir);
  if (!existsSync(abs)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const rel = posix.join(relDir, entry);
    if (statSync(join(REPO, rel)).isDirectory()) {
      out.push(...walk(rel, filter));
    } else if (filter.test(entry) && !EXCLUDED.has(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function isTestFile(rel: string): boolean {
  return /(^|\/)__tests__\//.test(rel) || /\.(test|spec)\.[jt]sx?$/.test(rel);
}

/** Code the KP guard covers: app, functions, and both scripts folders. */
const CODE_ROOTS = ['src', 'functions/src', 'functions/scripts', 'scripts'];
const allCodeFiles = (): string[] => CODE_ROOTS.flatMap(r => walk(r));

// ── Parsing ────────────────────────────────────────────────────────────────

const sourceCache = new Map<string, ts.SourceFile>();

function parse(rel: string): ts.SourceFile {
  let sf = sourceCache.get(rel);
  if (sf === undefined) {
    const kind = rel.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : /\.[mc]?js$/.test(rel)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
    sf = ts.createSourceFile(
      rel,
      readFileSync(join(REPO, rel), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
    sourceCache.set(rel, sf);
  }
  return sf;
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function visitAll(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node);
  ts.forEachChild(node, child => visitAll(child, fn));
}

interface ImportRef {
  spec: string;
  /** True when the import cannot run code (import type, typeof import(...)). */
  typeOnly: boolean;
  /** Value bindings: names, 'default', or '*' for namespace/require/side-effect. */
  names: string[];
  line: number;
}

function isRequireOrDynamicImport(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
    node.arguments.length > 0 &&
    ts.isStringLiteralLike(node.arguments[0] as ts.Expression)
  );
}

function importsOf(rel: string): ImportRef[] {
  const sf = parse(rel);
  const out: ImportRef[] = [];
  visitAll(sf, node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names: string[] = [];
      if (clause !== undefined && !clause.isTypeOnly) {
        if (clause.name !== undefined) {
          names.push('default');
        }
        const bindings = clause.namedBindings;
        if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
          names.push('*');
        } else if (bindings !== undefined) {
          for (const el of bindings.elements) {
            if (!el.isTypeOnly) {
              names.push((el.propertyName ?? el.name).text);
            }
          }
        }
      }
      // A bare `import 'x'` runs the module, so it counts as a value import.
      const sideEffect = clause === undefined;
      out.push({
        spec: node.moduleSpecifier.text,
        typeOnly: !sideEffect && names.length === 0,
        names: sideEffect ? ['*'] : names,
        line: lineOf(sf, node),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      out.push({
        spec: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly,
        names: ['*'],
        line: lineOf(sf, node),
      });
    } else if (isRequireOrDynamicImport(node)) {
      out.push({
        spec: (node.arguments[0] as ts.StringLiteralLike).text,
        typeOnly: false,
        names: ['*'],
        line: lineOf(sf, node),
      });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      out.push({
        spec: node.argument.literal.text,
        typeOnly: true,
        names: [],
        line: lineOf(sf, node),
      });
    }
  });
  return out;
}

/** Module-specifier string nodes — never treated as text by G1/G4. */
function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    parent !== undefined &&
    ((ts.isImportDeclaration(parent) && parent.moduleSpecifier === node) ||
      (ts.isExportDeclaration(parent) && parent.moduleSpecifier === node) ||
      ts.isExternalModuleReference(parent) ||
      (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) ||
      (isRequireOrDynamicImport(parent) && parent.arguments[0] === node))
  );
}

interface TextHit {
  text: string;
  line: number;
}

/** String literals, template parts and JSX text. Comments are trivia and never appear. */
function textsOf(rel: string): TextHit[] {
  const sf = parse(rel);
  const out: TextHit[] = [];
  visitAll(sf, node => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      !isModuleSpecifier(node)
    ) {
      out.push({ text: node.text, line: lineOf(sf, node) });
    } else if (ts.isJsxText(node) && node.text.trim().length > 0) {
      out.push({ text: node.text.trim(), line: lineOf(sf, node) });
    }
  });
  return out;
}

function identifiersOf(rel: string): TextHit[] {
  const sf = parse(rel);
  const out: TextHit[] = [];
  visitAll(sf, node => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      out.push({ text: node.text, line: lineOf(sf, node) });
    }
  });
  return out;
}

/** "KpChartGrid" → kp, chart, grid; "RKPWatch" → rkp, watch; "kp_rules" → kp, rules. */
function nameTokens(name: string): string[] {
  return (name.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? []).map(t => t.toLowerCase());
}

// ── Module resolution (relative + tsconfig path aliases) ───────────────────

const ALIASES: [string, string][] = (() => {
  const { config } = ts.readConfigFile(join(REPO, 'tsconfig.json'), ts.sys.readFile) as {
    config: { compilerOptions: { paths: Record<string, string[]> } };
  };
  return Object.entries(config.compilerOptions.paths)
    .map(([from, to]): [string, string] => [
      from.replace(/\*$/, ''),
      posix.normalize((to[0] ?? '').replace(/\*$/, '')),
    ])
    .sort((a, b) => b[0].length - a[0].length);
})();

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'];

/** Repo-relative path a specifier points at, or null for an external package. */
function resolveSpec(fromRel: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('.')) {
    base = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  } else {
    const alias = ALIASES.find(([prefix]) => spec.startsWith(prefix));
    if (alias !== undefined) {
      base = posix.join(alias[1], spec.slice(alias[0].length));
    }
  }
  if (base === null) {
    return null;
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = base + suffix;
    const abs = join(REPO, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) {
      return candidate;
    }
  }
  return base;
}

function stripExt(rel: string): string {
  return rel.replace(/\.(ts|tsx|js|mjs|cjs)$/, '');
}

function hasKpSegment(path: string): boolean {
  return path.split('/').some(seg => seg.toLowerCase() === 'kp');
}

// ── Allowlist hygiene ──────────────────────────────────────────────────────

describe('guards/allowlist.json', () => {
  it('every entry has an id, a guard, a kind and a reason; debt entries have a valid date', () => {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const e of ALLOWLIST.entries) {
      if (!e.id || ids.has(e.id)) {
        problems.push(`entry ${JSON.stringify(e.id)} is missing an id or reuses one`);
      }
      ids.add(e.id);
      if (!e.guard || !e.kind || !e.reason || e.reason.trim().length < 10) {
        problems.push(`entry "${e.id}" needs a guard, a kind and a real reason`);
      }
      if (e.kind === 'debt' && (e.debtDate === undefined || isNaN(Date.parse(e.debtDate)))) {
        problems.push(`debt entry "${e.id}" needs a debtDate (YYYY-MM-DD)`);
      }
      if (e.file !== undefined && !existsSync(join(REPO, e.file))) {
        problems.push(`entry "${e.id}" names ${e.file}, which does not exist — remove the entry`);
      }
    }
    for (const x of ALLOWLIST.scanExclusions) {
      if (!existsSync(join(REPO, x.path))) {
        problems.push(`scan exclusion ${x.path} does not exist — exclusions are exact paths`);
      }
    }
    expect(problems).toEqual([]);
  });

  it(`no debt entry is more than ${DEBT_WINDOW_DAYS} days past its date`, () => {
    const now = Date.now();
    const expired = ALLOWLIST.entries
      .filter(e => e.kind === 'debt' && e.debtDate !== undefined)
      .filter(e => now > Date.parse(`${e.debtDate}T00:00:00Z`) + DEBT_WINDOW_DAYS * DAY_MS)
      .map(
        e =>
          `debt entry "${e.id}" (${e.guard}, dated ${e.debtDate}) is past its ${DEBT_WINDOW_DAYS}-day window: ${e.reason}`,
      );
    if (expired.length > 0) {
      throw new Error(
        report(
          'Allowlist',
          'dated debt has expired',
          expired,
          'fix the underlying issue and delete the entry, or record an owner decision in its reason and give it a new debtDate.',
        ),
      );
    }
  });
});

// ── G1: No KP resurrection ─────────────────────────────────────────────────

describe('G1 — no KP resurrection', () => {
  const KP_FIX =
    'KP and the old astronomical judgment system were removed on purpose (CLAUDE.md §3). Use the RKP watch engine (src/astrology/rkp/) instead.';

  it('nothing imports through a "kp" directory except the allowlisted lookup tables', () => {
    const hits: string[] = [];
    for (const rel of allCodeFiles()) {
      for (const imp of importsOf(rel)) {
        const target = resolveSpec(rel, imp.spec);
        if (!hasKpSegment(imp.spec) && (target === null || !hasKpSegment(target))) {
          continue;
        }
        if (target !== null && allowedBy('G1', target) !== undefined) {
          continue;
        }
        hits.push(`${rel}:${imp.line} imports "${imp.spec}"`);
      }
    }
    if (hits.length > 0) {
      throw new Error(report('G1', 'import through a kp/ path', hits, KP_FIX));
    }
  });

  it('no file or directory is named for KP', () => {
    const files = [
      ...allCodeFiles(),
      ...walk('docs', /.*/),
      ...readdirSync(REPO).filter(f => statSync(join(REPO, f)).isFile()),
    ];
    const hits = files.filter(rel => {
      const named = rel
        .split('/')
        .some(seg =>
          nameTokens(seg.replace(/\.[^.]+$/, '')).some(t => t === 'kp' || t === 'krishnamurti'),
        );
      return named && allowedBy('G1', rel) === undefined;
    });
    if (hits.length > 0) {
      throw new Error(report('G1', 'file or directory named for KP', hits, KP_FIX));
    }
  });

  it('no identifier or string literal references KP or Krishnamurti', () => {
    const hits: string[] = [];
    for (const rel of allCodeFiles()) {
      for (const id of identifiersOf(rel)) {
        const tokens = nameTokens(id.text);
        if (
          (tokens.includes('kp') || tokens.includes('krishnamurti')) &&
          allowedBy('G1', rel, id.text) === undefined
        ) {
          hits.push(`${rel}:${id.line} identifier ${id.text}`);
        }
      }
      for (const s of textsOf(rel)) {
        if (/\b(kp|krishnamurti)\b/i.test(s.text) && allowedBy('G1', rel, s.text) === undefined) {
          hits.push(`${rel}:${s.line} string ${JSON.stringify(s.text.slice(0, 80))}`);
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(report('G1', 'KP reference in code', hits, KP_FIX));
    }
  });
});

// ── G2: Voice isolation ────────────────────────────────────────────────────

/** Voice modules: speech-to-text and text-to-speech. They carry no astrology. */
const VOICE_MODULES = ['src/hooks/useSpeechToText.ts', 'src/hooks/useTextToSpeech.ts'];

function isForbiddenForVoice(rel: string): boolean {
  return (
    rel.startsWith('src/astrology/') ||
    rel.startsWith('functions/') ||
    rel === 'src/firebase/watchOracle.ts' ||
    rel === 'src/firebase/oracleDiscussion.ts'
  );
}

describe('G2 — voice isolation', () => {
  it('voice modules never reach astrology, engine, judgment or Oracle-call code', () => {
    const hits: string[] = [];
    for (const start of VOICE_MODULES) {
      expect(existsSync(join(REPO, start))).toBe(true);
      const seen = new Set<string>();
      const queue: { rel: string; via: string[] }[] = [{ rel: start, via: [start] }];
      while (queue.length > 0) {
        const { rel, via } = queue.shift() as { rel: string; via: string[] };
        if (seen.has(rel)) {
          continue;
        }
        seen.add(rel);
        for (const imp of importsOf(rel)) {
          const target = resolveSpec(rel, imp.spec);
          if (target === null) {
            continue;
          }
          if (isForbiddenForVoice(target)) {
            hits.push(`${[...via, target].join(' → ')} (line ${imp.line} of ${rel})`);
          } else if (CODE_FILE.test(target) && existsSync(join(REPO, target))) {
            queue.push({ rel: target, via: [...via, target] });
          }
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        report(
          'G2',
          'a voice module imports astrology/engine/Oracle code',
          hits,
          'voice only turns speech into question text (and composed text into audio). Hand the text to ReadingScreen.sendMessage, which calls askWatchOracle exactly as typed text does.',
        ),
      );
    }
  });

  it('askWatchOracle is called from exactly one client module', () => {
    const callers: string[] = [];
    for (const rel of walk('src').filter(f => !isTestFile(f))) {
      const sf = parse(rel);
      visitAll(sf, node => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'httpsCallable' &&
          node.arguments[0] !== undefined &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          node.arguments[0].text === 'askWatchOracle'
        ) {
          callers.push(`${rel}:${lineOf(sf, node)}`);
        }
      });
    }
    if (callers.length !== 1 || !(callers[0] ?? '').startsWith('src/firebase/watchOracle.ts:')) {
      throw new Error(
        report(
          'G2',
          "httpsCallable('askWatchOracle') must exist only in src/firebase/watchOracle.ts",
          callers.length > 0 ? callers : ['no caller found'],
          'voice and text both go through askWatchOracle() exported by src/firebase/watchOracle.ts; do not add a second call site.',
        ),
      );
    }
  });

  it('the voice/text parity regression test still exists', () => {
    // Behavioural half of G2: the transcript reaches askWatchOracle with the
    // same request shape as typed text (commit 77abb54). Not duplicated here.
    const parity = readFileSync(join(REPO, 'src/screens/__tests__/ReadingScreen.test.tsx'), 'utf8');
    if (
      !parity.includes(
        "it('a voice transcript reaches askWatchOracle with the same shape as typed text'",
      )
    ) {
      throw new Error(
        report(
          'G2',
          'voice/text parity test missing',
          ['src/screens/__tests__/ReadingScreen.test.tsx'],
          'restore the "a voice transcript reaches askWatchOracle with the same shape as typed text" test.',
        ),
      );
    }
  });
});

// ── G3: Client never judges ────────────────────────────────────────────────

/** Sky Clock: a live display, never a judgment engine (CLAUDE.md §3). */
const SKY_CLOCK_FILES = [
  'src/screens/SkyClockScreen.tsx',
  'src/components/home/CosmicClock.tsx',
  'src/hooks/useTimingStrip.ts',
  'src/hooks/useHoraCountdown.ts',
  'src/utils/siderealPositions.ts',
];

/** Engine modules that judge. Their exports feed the best-effort name check. */
const JUDGMENT_MODULES = [
  'src/astrology/rkp/watchJudgment.ts',
  'src/astrology/rkp/watchChart.ts',
  'src/astrology/rkp/diagnosis.ts',
  'src/astrology/kp/rules/questionKeywords.ts',
];

const clientRuntimeFiles = (): string[] =>
  walk('src').filter(f => !isTestFile(f) && !f.startsWith('src/astrology/'));

function exportedFunctionNames(rel: string): string[] {
  const names: string[] = [];
  for (const stmt of parse(rel).statements) {
    const exported = ts
      .getModifiers(stmt as ts.HasModifiers)
      ?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) {
      continue;
    }
    if (ts.isFunctionDeclaration(stmt) && stmt.name !== undefined) {
      names.push(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.initializer !== undefined &&
          (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
        ) {
          names.push(d.name.text);
        }
      }
    }
  }
  return names;
}

describe('G3 — the client never judges', () => {
  it('client code never imports from functions/', () => {
    const hits: string[] = [];
    for (const rel of clientRuntimeFiles()) {
      for (const imp of importsOf(rel)) {
        const target = resolveSpec(rel, imp.spec);
        if (target !== null && target.startsWith('functions/')) {
          hits.push(`${rel}:${imp.line} imports "${imp.spec}"`);
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        report(
          'G3',
          'client imports server/engine code',
          hits,
          'the client gets judgment only from askWatchOracle; never bundle functions/ code into the app.',
        ),
      );
    }
  });

  it('client value-imports from the engine are only the approved display/calculation primitives', () => {
    const approved = entriesFor('G3').filter(e => e.target !== undefined);
    const hits: string[] = [];
    for (const rel of clientRuntimeFiles()) {
      const skyClock = SKY_CLOCK_FILES.includes(rel);
      for (const imp of importsOf(rel)) {
        const target = resolveSpec(rel, imp.spec);
        if (imp.typeOnly || target === null || !target.startsWith('src/astrology/')) {
          continue;
        }
        const entry = approved.find(
          e => e.target === stripExt(target) && (!skyClock || e.skyClock === true),
        );
        const extra =
          entry === undefined
            ? imp.names
            : imp.names.filter(n => !(entry.symbols ?? []).includes(n));
        if (entry !== undefined) {
          usedEntries.add(entry.id);
        }
        if (extra.length > 0) {
          hits.push(
            `${rel}:${imp.line} imports {${extra.join(', ')}} from "${imp.spec}"${skyClock ? ' (Sky Clock)' : ''}`,
          );
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        report(
          'G3',
          'client imports engine code that is not an approved primitive',
          hits,
          'judgment runs only on the server (askWatchOracle). Use `import type` for types; render the verdict the server returned. A new display/calculation primitive needs an owner-approved G3 entry.',
        ),
      );
    }
  });

  it('client code does not define functions named like engine judgment exports (best-effort)', () => {
    // BEST-EFFORT ONLY: this catches a copied judgment function that keeps its
    // name. A reimplementation under a different name will not be caught.
    const banned = new Set(JUDGMENT_MODULES.flatMap(exportedFunctionNames));
    expect(banned.size).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const rel of clientRuntimeFiles()) {
      const sf = parse(rel);
      visitAll(sf, node => {
        const name =
          (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
          node.name !== undefined &&
          ts.isIdentifier(node.name)
            ? node.name.text
            : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
              ? node.name.text
              : undefined;
        if (name !== undefined && banned.has(name)) {
          hits.push(`${rel}:${lineOf(sf, node)} defines ${name}`);
        }
      });
    }
    if (hits.length > 0) {
      throw new Error(
        report(
          'G3',
          'client defines a function named like an engine judgment export',
          hits,
          'do not reimplement judgment in the app; the server computes it.',
        ),
      );
    }
  });
});

// ── G4: User-facing terminology (static copy) ──────────────────────────────

/** Banned in user-facing text (OD-2): shared list in guards/allowlist.json. */
const BANNED_TERMS = ALLOWLIST.bannedUserFacingTerms.terms.map(t => ({
  term: t.term,
  pattern: new RegExp(t.pattern, t.flags),
}));

function bannedTermsIn(text: string): string[] {
  return BANNED_TERMS.filter(t => t.pattern.test(text)).map(t => t.term);
}

/** User-facing surfaces (OD-2). Composed Oracle output is checked in functions/. */
const COPY_CODE_FILES = (): string[] =>
  [
    ...walk('src/i18n/strings'),
    ...walk('src/screens'),
    ...walk('src/components'),
    ...walk('src/data'),
    'functions/src/oracle/remedyLibrary.ts',
  ].filter(f => !isTestFile(f));

const COPY_TEXT_FILES = (): string[] => [
  ...walk('android/fastlane/metadata', /\.txt$/),
  ...walk('hosting', /\.html$/),
];

describe('G4 — user-facing terminology (static copy)', () => {
  it('no banned term appears in UI strings, remedy copy, store listing or hosted pages', () => {
    const hits: string[] = [];
    for (const rel of COPY_CODE_FILES()) {
      for (const s of textsOf(rel)) {
        const terms = bannedTermsIn(s.text);
        if (terms.length > 0 && allowedBy('G4', rel, s.text) === undefined) {
          hits.push(
            `${rel}:${s.line} "${terms.join('", "')}" in ${JSON.stringify(s.text.slice(0, 80))}`,
          );
        }
      }
    }
    for (const rel of COPY_TEXT_FILES()) {
      const text = readFileSync(join(REPO, rel), 'utf8')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
      text.split('\n').forEach((line, i) => {
        const terms = bannedTermsIn(line);
        if (terms.length > 0 && allowedBy('G4', rel, line) === undefined) {
          hits.push(
            `${rel}:${i + 1} "${terms.join('", "')}" in ${JSON.stringify(line.trim().slice(0, 80))}`,
          );
        }
      });
    }
    if (hits.length > 0) {
      throw new Error(
        report(
          'G4',
          'engine/Sanskrit terminology in user-facing text',
          hits,
          'use Arabic celestial names and "Shams al-Asrār" wording (CLAUDE.md §3). Engine terms may stay in code identifiers and comments.',
        ),
      );
    }
  });
});

// ── G5: Ruling Planet integrity ────────────────────────────────────────────

describe('G5 — Ruling Planet integrity', () => {
  // Blocked on owner decision OD-5 (guards/allowlist.json): the in-repo rules
  // doc lists Hora Lord as a 6th confirmatory lord and getRulingPlanets returns
  // a 6-tuple, while CLAUDE.md says exactly 5 with horaLord as a witness only.
  // No assertion until the owner decides — asserting either way would invent
  // RKP methodology.
  it.todo(
    'OD-5: exactly 5 Ruling Planets, horaLord only as an extended witness (blocked on owner decision OD-5)',
  );
});

// ── G6: manzilLord scope ───────────────────────────────────────────────────

describe('G6 — manzilLord applies only to planetChain entries', () => {
  it('manzilLord appears only inside a planetChain entry, never on a Ruling Planet role', () => {
    // NOTE: manzilLord is currently UNPOPULATED — it exists only as a field of
    // the planetChain type in functions/src/types.ts and nothing writes it.
    // This guard therefore protects against future regressions only: if a
    // Ruling Planet role (dayLord, horaLord, ascSignLord, …) ever gains a
    // manzilLord, it will fail.
    const hits: string[] = [];
    let found = 0;
    for (const rel of CODE_ROOTS.flatMap(r => walk(r)).filter(f => !isTestFile(f))) {
      const sf = parse(rel);
      visitAll(sf, node => {
        const isManzilLord =
          (ts.isIdentifier(node) || ts.isStringLiteral(node)) && node.text === 'manzilLord';
        if (!isManzilLord) {
          return;
        }
        found += 1;
        let p: ts.Node | undefined = node.parent;
        let insidePlanetChain = false;
        while (p !== undefined) {
          const name =
            (ts.isPropertySignature(p) ||
              ts.isPropertyAssignment(p) ||
              ts.isPropertyDeclaration(p)) &&
            (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
              ? p.name.text
              : ts.isPropertyAccessExpression(p)
                ? p.name.text
                : undefined;
          if (name === 'planetChain') {
            insidePlanetChain = true;
            break;
          }
          p = p.parent;
        }
        if (!insidePlanetChain) {
          hits.push(`${rel}:${lineOf(sf, node)} uses manzilLord outside a planetChain entry`);
        }
      });
    }
    expect(found).toBeGreaterThan(0);
    if (hits.length > 0) {
      throw new Error(
        report(
          'G6',
          'manzilLord outside planetChain',
          hits,
          'manzilLord describes a planet in planetChain only. Ruling Planet roles are identifiers, not chains — do not attach a manzilLord to them.',
        ),
      );
    }
  });
});

// ── Stale allowlist entries (runs last) ────────────────────────────────────

describe('guards/allowlist.json — every client-suite entry is still needed', () => {
  it('no entry is unused', () => {
    const unused = ALLOWLIST.entries
      .filter(e => e.suite !== 'functions' && !usedEntries.has(e.id))
      .map(e => `entry "${e.id}" (${e.guard}) matched nothing`);
    if (unused.length > 0) {
      throw new Error(
        report(
          'Allowlist',
          'stale entry',
          unused,
          'the issue it excused is gone — delete the entry so the guard covers that spot again.',
        ),
      );
    }
  });
});
