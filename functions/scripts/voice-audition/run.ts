/**
 * run.ts — Shams al-Asrār voice audition.
 * --------------------------------------------------------------------------
 * Speaks the ten audition cases (cases.ts) through each candidate voice,
 * with the fixed per-state performance (performance.ts), and checks every
 * take for verbatim fidelity (fidelity.ts).
 *
 * Run from functions/:
 *
 *   # real audition — needs OPENAI_API_KEY and network access to api.openai.com
 *   OPENAI_API_KEY=… npx vite-node scripts/voice-audition/run.ts -- --mode=live \
 *     --source=../docs/audit/transcript-harness/baseline-2026-10-12 --label=voice-2026-10-12
 *
 *   # wiring check — no network, no audio, NOT audition evidence
 *   npx vite-node scripts/voice-audition/run.ts -- --mode=stub --source=<run dir> \
 *     --allow-stub-source --label=voice-stub-check
 *
 * Options: --voices=cedar,marin   --model=gpt-realtime-2.1-mini   --timeout-ms=60000
 *
 * Output: docs/audit/voice-audition/_unreviewed/<label>/ (git-ignored):
 * summary.md, scorecard.md, manifest.json and, in live mode, audio/*.wav.
 * Never overwrites an existing label. Moves out of _unreviewed/ only after
 * scanOutput.ts is clean and a person has listened and scored.
 *
 * Production code is not modified or called for audio; this is an offline
 * evaluation tool.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MODEL, DEFAULT_VOICES, runAudition, type AuditionMode } from './audition';
import { scanDirectory } from '../transcript-harness/outputScan';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | undefined {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main(): Promise<void> {
  const mode = arg('mode') as AuditionMode | undefined;
  if (mode !== 'live' && mode !== 'stub') {
    throw new Error('--mode=live|stub is required');
  }
  const label = arg('label');
  if (!label || !/^[\w.-]+$/.test(label)) {
    throw new Error('--label=<name> is required (letters, digits, . _ -)');
  }
  const source = arg('source');
  if (!source) {
    throw new Error('--source=<transcript-harness run directory> is required');
  }
  const outRoot = resolve(
    process.cwd(),
    arg('out-root') ?? resolve(__dirname, '../../../docs/audit/voice-audition/_unreviewed'),
  );
  const { outDir, takes } = await runAudition({
    mode,
    sourceDir: resolve(process.cwd(), source),
    allowStubSource: process.argv.includes('--allow-stub-source'),
    label,
    outDir: resolve(outRoot, label),
    model: arg('model') ?? DEFAULT_MODEL,
    voices: (arg('voices') ?? DEFAULT_VOICES.join(',')).split(',').map(v => v.trim()),
    timeoutMs: Number(arg('timeout-ms') ?? 60_000),
    apiKey: process.env.OPENAI_API_KEY ?? null,
  });
  console.warn(`[audition] wrote ${outDir}`);
  const counts: Record<string, number> = {};
  for (const t of takes) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  console.warn(`[audition] takes: ${JSON.stringify(counts)}`);
  const findings = scanDirectory(outDir);
  console.warn(
    findings.length === 0
      ? '[scan] no credentials or contact details found in text output — still listen and review before moving it out of _unreviewed/'
      : `[scan] ${findings.length} finding(s) — run scanOutput.ts on ${outDir}; do not commit`,
  );
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
