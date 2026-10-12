/**
 * run.ts — Oracle transcript harness.
 * --------------------------------------------------------------------------
 * Drives each scenario in scenarios.ts through the production composers
 * (pipeline.ts), measures the result (metrics.ts) and writes a report
 * (report.ts) plus a cassette of every model exchange.
 *
 * Run from functions/:
 *
 *   # baseline against the real model (needs the API key the functions use)
 *   ANTHROPIC_API_KEY=… npx vite-node scripts/transcript-harness/run.ts -- \
 *     --mode=live --label=baseline-2026-10-12
 *
 *   # re-score a recorded run without calling the model
 *   npx vite-node scripts/transcript-harness/run.ts -- \
 *     --mode=replay --cassette=../docs/audit/transcript-harness/baseline-2026-10-12/cassette.json \
 *     --label=baseline-2026-10-12-rescored
 *
 *   # wiring check only — placeholder responses, NOT Oracle output
 *   npx vite-node scripts/transcript-harness/run.ts -- --mode=stub --label=stub-check
 *
 * Options: --only=<scenario-id>[,<id>…]   --out-root=<dir>
 *
 * Output: docs/audit/transcript-harness/<label>/ — summary.md, transcripts.md,
 * review-sheet.md, metrics.json, records.json, cassette.json. An existing
 * label directory is never overwritten.
 *
 * Production prompts, composers and validators are imported, not copied, and
 * are not modified by this script.
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WATCH_ORACLE_SYNTHESIS_PROMPT } from '../../src/prompts/watchOracleSynthesisPrompt';
import { ORACLE_DISCUSSION_PROMPT } from '../../src/prompts/oracleDiscussionPrompt';

import { SCENARIOS } from './scenarios';
import { installTransport, type TransportMode } from './modelTransport';
import { runScenario, type ScenarioRecord } from './pipeline';
import { measureRun, measureScenario } from './metrics';
import {
  reviewSheetMarkdown,
  summaryMarkdown,
  transcriptsMarkdown,
  type RunHeader,
} from './report';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | undefined {
  return process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function sha(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function main(): Promise<void> {
  const mode = (arg('mode') ?? '') as TransportMode;
  if (mode !== 'live' && mode !== 'replay' && mode !== 'stub') {
    throw new Error('--mode=live|replay|stub is required');
  }
  const label = arg('label');
  if (!label || !/^[\w.-]+$/.test(label)) {
    throw new Error('--label=<name> is required (letters, digits, . _ -)');
  }
  const outRoot = resolve(
    process.cwd(),
    arg('out-root') ?? resolve(__dirname, '../../../docs/audit/transcript-harness'),
  );
  const outDir = resolve(outRoot, label);
  if (existsSync(outDir)) {
    throw new Error(
      `${outDir} already exists — choose a new --label; recorded runs are never overwritten`,
    );
  }

  const only = arg('only')?.split(',');
  const scenarios = only ? SCENARIOS.filter(s => only.includes(s.id)) : SCENARIOS;
  if (scenarios.length === 0) {
    throw new Error('no scenarios selected');
  }

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // not a git checkout — leave as unknown
  }

  const startedAt = new Date().toISOString();
  const transport = installTransport(mode, arg('cassette'));
  const records: ScenarioRecord[] = [];
  try {
    for (const s of scenarios) {
      console.warn(`[harness] ${s.id} …`);
      records.push(await runScenario(s, transport));
    }
  } finally {
    transport.restore();
  }

  const per = records.map(measureScenario);
  const run = measureRun(per);
  const header: RunHeader = {
    label,
    mode,
    startedAt,
    gitCommit,
    synthesisPromptSha: sha(WATCH_ORACLE_SYNTHESIS_PROMPT),
    discussionPromptSha: sha(ORACLE_DISCUSSION_PROMPT),
    modelCalls: transport.exchanges.length,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'summary.md'), summaryMarkdown(header, run, per));
  writeFileSync(resolve(outDir, 'transcripts.md'), transcriptsMarkdown(header, records));
  writeFileSync(resolve(outDir, 'review-sheet.md'), reviewSheetMarkdown(header, per));
  writeFileSync(
    resolve(outDir, 'metrics.json'),
    JSON.stringify({ header, run, scenarios: per }, null, 2),
  );
  writeFileSync(resolve(outDir, 'records.json'), JSON.stringify(records, null, 2));
  writeFileSync(
    resolve(outDir, 'cassette.json'),
    JSON.stringify({ recordedAt: startedAt, mode, exchanges: transport.exchanges }, null, 2),
  );

  console.warn(`[harness] wrote ${outDir}`);
  console.warn(JSON.stringify(run, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
