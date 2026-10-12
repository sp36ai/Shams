/**
 * outputScan.ts — check a harness output directory before it is committed.
 * --------------------------------------------------------------------------
 * Live runs are written to docs/audit/transcript-harness/_unreviewed/ (git-
 * ignored). Nothing moves out of there until this scan is clean and a person
 * has read the transcripts:
 *
 *   npx vite-node scripts/transcript-harness/scanOutput.ts -- <dir>
 *
 * Exit 1 on any finding. Findings are printed with file and line and the
 * matched text masked — this script must not itself leak what it finds.
 *
 * Scenario names (Bilal, Ayesha, Rukhsana) are fictional fixtures and are
 * not flagged. The scan cannot recognise every kind of personal data; it is
 * a gate before human review, not a replacement for it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ScanFinding {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly masked: string;
}

const PATTERNS: ReadonlyArray<{ kind: string; re: RegExp }> = [
  // OpenAI keys (sk-proj-…, sk-svcacct-…, sk-…) and the previous provider's
  // (sk-ant-…) — legacy recordings may still be scanned.
  { kind: 'openai-key', re: /sk-(?!ant-)[A-Za-z0-9_-]{20,}/g },
  { kind: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { kind: 'api-key-header', re: /x-api-key|"authorization"\s*:/gi },
  { kind: 'bearer-token', re: /Bearer\s+[A-Za-z0-9._~+/-]{20,}/g },
  { kind: 'google-api-key', re: /AIza[0-9A-Za-z_-]{30,}/g },
  { kind: 'razorpay-key', re: /rzp_(?:live|test)_[A-Za-z0-9]{8,}/g },
  { kind: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'phone-number', re: /(?<![\w.-])\+?\d{2,4}[ -]?\d{3,5}[ -]?\d{4,7}(?![\w.-])/g },
];

function mask(s: string): string {
  return s.length <= 8 ? '****' : `${s.slice(0, 4)}…(${s.length} chars)`;
}

export function scanText(
  file: string,
  text: string,
  extraSecrets: readonly string[] = [],
): ScanFinding[] {
  const out: ScanFinding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const { kind, re } of PATTERNS) {
      for (const m of line.matchAll(re)) {
        out.push({ file, line: i + 1, kind, masked: mask(m[0]) });
      }
    }
    for (const secret of extraSecrets) {
      if (secret.length >= 8 && line.includes(secret)) {
        out.push({ file, line: i + 1, kind: 'environment-secret-value', masked: mask(secret) });
      }
    }
  });
  return out;
}

const TEXT_EXTENSIONS = /\.(md|json|txt|csv|html)$/i;

export function scanDirectory(dir: string): ScanFinding[] {
  // The literal key in this process's environment, if any, is the strongest
  // check of all: it catches the key however it was formatted.
  const extra = [process.env.OPENAI_API_KEY ?? '', process.env.ANTHROPIC_API_KEY ?? ''].filter(
    s => s.length >= 8 && s !== 'harness-offline-placeholder',
  );
  const findings: ScanFinding[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      findings.push(...scanDirectory(path));
    } else if (!TEXT_EXTENSIONS.test(name)) {
      // Binary output (e.g. voice-audition WAV takes) is not scanned as text;
      // what was spoken is the validated source text, scanned in manifest.json.
      continue;
    } else {
      findings.push(...scanText(path, readFileSync(path, 'utf8'), extra));
    }
  }
  return findings;
}
