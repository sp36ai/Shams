/**
 * rkp-form-intake.mjs — read a returned RKP open-decisions form and report what it settles.
 * --------------------------------------------------------------------------
 * Scaffolding only (not bundled, imported nowhere). Changes no engine file. It does three things:
 *   1. parses every tick-box answer, free-text answer and the sign-off block;
 *   2. flags gaps: nothing ticked, several ticked, UNKNOWN, an "other" with no text;
 *   3. lists which rule groups are COMPLETE and answered (candidates to implement, one at a time),
 *      which are blocked, and drafts a ledger entry that quotes the answers verbatim.
 * It decides nothing: an answered group is only a candidate, and the release controls in
 * docs/rkp-audit/RKP_RULE_LEDGER.md still apply (owner attribution, one rule at a time, tests, replay).
 *
 * Run: node scripts/rkp-form-intake.mjs <path-to-returned-form.md>   (from functions/)
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/rkp-form-intake.mjs <returned-form.md>');
  process.exit(2);
}
const lines = readFileSync(path, 'utf8').split('\n');

// ---- question blocks: "1a. text" until the next question or "## " heading
const questions = [];
let cur = null;
for (const line of lines) {
  const q = /^(\d[a-z])\.\s+(.*)$/.exec(line);
  if (q) {
    cur = { id: q[1], text: q[2], body: [] };
    questions.push(cur);
    continue;
  }
  if (/^##\s/.test(line)) cur = null;
  if (cur) cur.body.push(line);
}

const answers = new Map();
for (const q of questions) {
  const text = [q.text, ...q.body].join('\n');
  const boxes = [];
  const re = /\[( |x|X)\]\s*([^[\n]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    boxes.push({ ticked: m[1] !== ' ', label: m[2].trim() });
  }
  const ticked = boxes.filter(b => b.ticked);
  const blank = s => s.replace(/[_\s]/g, '') === '';
  let status;
  let answer = '';
  if (ticked.length === 0) status = 'NO ANSWER';
  else if (ticked.length > 1) { status = 'CONTRADICTORY (more than one ticked)'; answer = ticked.map(t => t.label).join(' | '); }
  else {
    answer = ticked[0].label;
    const other = /other:\s*(.*)$/i.exec(answer);
    if (/^UNKNOWN\b/i.test(answer)) status = 'UNKNOWN';
    else if (other && blank(other[1])) status = 'INCOMPLETE ("other" has no text)';
    else status = 'ANSWERED';
  }
  answers.set(q.id, { status, answer, question: q.text });
}

// ---- section 8 free text and section 9 sign-off
const text = lines.join('\n');
const s8 = /## 8\.[^\n]*\n([\s\S]*?)\n## 9\./.exec(text)?.[1] ?? '';
const reason = s8.split('\n').filter(l => !/^In one or two sentences/.test(l)).join(' ').replace(/_+/g, '').trim();
const signLine = lines.find(l => /Name:/.test(l)) ?? '';
const sm = /Name:\s*(.*?)\s{2,}Date:\s*(.*?)\s{2,}How returned[^:]*:\s*(.*)$/.exec(signLine);
const clean = s => (s ?? '').replace(/_+/g, '').trim();
const signed = { name: clean(sm?.[1]), date: clean(sm?.[2]), channel: clean(sm?.[3]) };
const attributed = signed.name !== '' && signed.date !== '' && signed.channel !== '';

// ---- rule groups (which questions must all be answered before a group is a candidate)
const GROUPS = {
  'Self-protection (S7)': ['1a', '1b', '1c', '1d'],
  'Malefic in the 3rd/6th/10th/11th (S4 B and C)': ['2a', '2b', '2c', '2d'],
  'Utarid affliction': ['3a', '3b', '3c'],
  'Shams contextual weights': ['4a', '4b'],
  'Qamar bright half': ['5a', '5b', '5c'],
  'Zuhal on the 10th': ['6a', '6b'],
  'Case 3 timing (weak-ruler multiplier)': ['7a'],
};
const out = [];
out.push(`# Intake of ${path}`, '');
out.push(`Sign-off: name "${signed.name}", date "${signed.date}", returned by "${signed.channel}" → ${attributed ? 'COMPLETE' : '**INCOMPLETE — treat everything below as received, not confirmed**'}`, '');
out.push('| Q | Status | Answer |', '|---|---|---|');
for (const [id, a] of answers) out.push(`| ${id} | ${a.status} | ${a.answer} |`);
out.push('', `Case 4 reason (section 8): ${reason === '' ? '**not given**' : `"${reason}"`}`, '');
out.push('## Rule groups', '', '| Group | Result |', '|---|---|');
for (const [name, ids] of Object.entries(GROUPS)) {
  const sts = ids.map(i => answers.get(i)?.status ?? 'MISSING FROM FORM');
  const settled = sts.every(s => s === 'ANSWERED');
  const hasUnknown = sts.includes('UNKNOWN');
  const bad = sts.filter(s => !['ANSWERED', 'UNKNOWN'].includes(s));
  const result = bad.length > 0 ? `BLOCKED: ${[...new Set(bad)].join('; ')}`
    : hasUnknown ? 'PARTLY UNKNOWN — keep current behaviour for the unknown parts'
    : settled ? (attributed ? 'COMPLETE — candidate to implement (one rule at a time, with tests)' : 'COMPLETE but sign-off missing — not attributable')
    : 'BLOCKED';
  out.push(`| ${name} | ${result} |`);
}
out.push('', '## Draft ledger entry (verbatim answers; review before committing)', '', '```');
out.push(`Decision ID:    OD-00X`, `Date received:  ${signed.date || '<date>'}`, `Channel:        ${signed.channel || '<how returned>'}`, `Given by:       ${signed.name || '<name>'}`, 'Sheet items:    open-decisions form 1a–7a, 8');
for (const [id, a] of answers) out.push(`Verbatim ${id}:   ${a.status === 'NO ANSWER' ? '(blank)' : a.answer}`);
out.push(`Verbatim 8:     ${reason || '(blank)'}`, 'Ledger rows:    L8, L16, L17, L20, L23 and the S7 entries', 'New status:     VERIFIED-OWNER only for ANSWERED items with a complete sign-off; otherwise UNKNOWN', 'Code change:    none until a group above is COMPLETE', '```');
console.log(out.join('\n'));
