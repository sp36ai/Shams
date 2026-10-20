import { writeFileSync } from 'node:fs';
const VARIANTS = ['new', 'sim_s7_strict', 'sim_s7_broad', 'sim_s7_broad_11', 'sim_s4_B1', 'sim_s4_B2'];
const CASES: [string, string][] = [
  ['Will I get the job?', '2026-10-20T07:28:00+05:30'], ['Will I get the job?', '2026-03-12T16:42:00+05:30'],
  ['Will my marriage happen this year?', '2026-06-05T11:13:00+05:30'], ['Will my business grow?', '2026-12-02T09:51:00+05:30'],
  ['Will I recover from illness?', '2026-08-17T20:07:00+05:30'],
];
const base = Date.UTC(2026, 0, 1);
const isos: string[] = [];
for (let d = 0; d < 365; d += 3) for (const h of [3, 8, 13, 19]) for (const m of [4, 22, 41, 57]) {
  const t = new Date(base + d * 864e5);
  isos.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
}
async function main() {
  const out: any = {};
  for (const v of VARIANTS) {
    const chartMod = await import(`/tmp/var/${v}/engine/rkp/watchChart.ts`);
    const judgeMod = await import(`/tmp/var/${v}/engine/rkp/watchJudgment.ts`);
    const kw = await import(`/tmp/var/${v}/engine/kp/rules/questionKeywords.ts`);
    const hm = await import(`/tmp/var/${v}/engine/kp/rules/houseMatrix.ts`);
    const cases = CASES.map(([q, iso]) => { const r = judgeMod.judgeWatchChart(chartMod.buildWatchChart(iso), kw.classifyQuestion(q)); return { state: r.state, score: r.score }; });
    const dist: Record<string, Record<string, number>> = {};
    for (const iso of isos) {
      const chart = chartMod.buildWatchChart(iso);
      for (const qt of hm.ALL_QUESTION_TYPES) { const s = judgeMod.judgeWatchChart(chart, qt).state; ((dist[qt] ??= {})[s] = (dist[qt][s] ?? 0) + 1); }
    }
    out[v] = { cases, dist, n: isos.length };
    console.log('variant done', v);
  }
  writeFileSync('/tmp/var/result_sim.json', JSON.stringify(out));
  console.log('done');
}
main();
