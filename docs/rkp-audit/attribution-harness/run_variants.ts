import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const VARIANTS = ['old', 'new', 'r_nodes', 'r_travel', 'r_sign', 'r_scaling', 'r_upa', 'r_mod', 'r_ladder', 'only_nodes', 'only_travel', 'only_sign', 'only_scaling', 'only_upa', 'only_mod', 'only_ladder', 'all_reverted'];
const cases = readdirSync('/tmp/golden_before/cases').sort().map(f => JSON.parse(readFileSync(`/tmp/golden_before/cases/${f}`, 'utf8')));

function pad(n: number, w = 2) { return String(Math.abs(n)).padStart(w, '0'); }
function localIso(instant: Date, off: number) {
  const s = new Date(instant.getTime() + off * 60000);
  const sign = off < 0 ? '-' : '+';
  return `${pad(s.getUTCFullYear(), 4)}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}T${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

async function main() {
  const out: Record<string, Record<string, unknown>> = {};
  for (const v of VARIANTS) {
    const chartMod = await import(`/tmp/var/${v}/engine/rkp/watchChart.ts`);
    const judgeMod = await import(`/tmp/var/${v}/engine/rkp/watchJudgment.ts`);
    const kwMod = await import(`/tmp/var/${v}/engine/kp/rules/questionKeywords.ts`);
    for (const c of cases) {
      const iso = localIso(new Date(c.input.utcInstant), c.input.utcOffsetMinutes);
      const verdict = judgeMod.judgeWatchChart(chartMod.buildWatchChart(iso), kwMod.classifyQuestion(c.input.question));
      (out[c.id] ??= { question: c.input.question, qType: verdict.qType })[v] = { state: verdict.state, score: verdict.score, timing: verdict.timing, obstruction: verdict.obstruction };
    }
  }
  writeFileSync('/tmp/var/result_all.json', JSON.stringify(out, null, 1));
  console.log('done', Object.keys(out).length);
}
main();
