/**
 * scanOutput.ts — CLI for outputScan.ts. Exit 1 on any finding.
 *
 *   npx vite-node scripts/transcript-harness/scanOutput.ts -- <output-dir>
 */

import { scanDirectory } from './outputScan';

function main(): void {
  const dir = process.argv.slice(2).find(a => !a.startsWith('-') && a !== '--');
  if (!dir) {
    throw new Error('usage: scanOutput.ts -- <output-dir>');
  }
  const findings = scanDirectory(dir);
  for (const f of findings) {
    console.warn(`${f.file}:${f.line}  ${f.kind}  ${f.masked}`);
  }
  console.warn(
    findings.length === 0 ? '[scan] clean' : `[scan] ${findings.length} finding(s) — do not commit`,
  );
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

main();
