/**
 * report.ts — human-readable output for a harness run.
 *
 *   summary.md       per-criterion measurements + every heuristic flag
 *   transcripts.md   each conversation exactly as the seeker would see/hear it
 *   review-sheet.md  blank 1–10 grid for the criteria only a person can judge
 *
 * Nothing here computes a score. Scores come from a person reading
 * transcripts.md against the review sheet.
 */

import type { ScenarioRecord } from './pipeline';
import type { RunMetrics, ScenarioMetrics } from './metrics';

export interface RunHeader {
  readonly label: string;
  readonly mode: string;
  readonly startedAt: string;
  readonly gitCommit: string;
  readonly synthesisPromptSha: string;
  readonly discussionPromptSha: string;
  readonly modelCalls: number;
}

const STUB_BANNER =
  '> **STUB RUN — NOT ORACLE OUTPUT.** Every model response below is a fixed placeholder. ' +
  'This run exercises the harness wiring only. None of it is evidence about the Oracle’s ' +
  'chat style and none of it may be used as a baseline.\n';

function headerBlock(h: RunHeader): string {
  return [
    `- Label: \`${h.label}\``,
    `- Mode: **${h.mode}**`,
    `- Started: ${h.startedAt}`,
    `- Commit: \`${h.gitCommit}\``,
    `- Synthesis prompt sha256: \`${h.synthesisPromptSha.slice(0, 16)}\``,
    `- Discussion prompt sha256: \`${h.discussionPromptSha.slice(0, 16)}\``,
    `- Model calls: ${h.modelCalls}`,
  ].join('\n');
}

function kv(obj: Readonly<Record<string, number>>): string {
  const entries = Object.entries(obj);
  return entries.length === 0 ? 'none' : entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

export function summaryMarkdown(
  h: RunHeader,
  run: RunMetrics,
  per: readonly ScenarioMetrics[],
): string {
  const lines: string[] = [];
  lines.push(`# Oracle transcript harness — ${h.label}`, '');
  if (h.mode === 'stub') {
    lines.push(STUB_BANNER);
  }
  lines.push(headerBlock(h), '');
  lines.push(
    'Measurements are **exact** (structure, counts, validator outcome, model-set flags) or ',
    '**heuristic** (pattern scans that raise flags for a person to check). Heuristic hits are not ',
    'confirmed violations. Naturalness and Oracle identity are not measured here — see review-sheet.md.',
    '',
  );

  lines.push('## Coverage', '');
  lines.push(`- Scenarios: ${run.scenarios}`);
  lines.push(`- By owner verdict: ${kv(run.coverage.byOwnerVerdict)}`);
  lines.push(
    `- By language: ${kv(run.coverage.byLang)}; voice-shaped questions: ${run.coverage.voice}`,
  );
  lines.push(
    `- Engine state differs from scenario's expected state: ${
      run.coverage.stateMismatches.length === 0 ? 'none' : run.coverage.stateMismatches.join('; ')
    }`,
  );
  lines.push(
    `- Readings with no remedy prescribed: ${run.coverage.noRemedyReadings}; scenarios expecting no remedy that got one: ${
      run.coverage.remedyMismatches.length === 0 ? 'none' : run.coverage.remedyMismatches.join('; ')
    }`,
    '',
  );

  lines.push('## 1. Judgment integrity (exact)', '');
  lines.push(
    `- First readings: ${run.readings.model} model narration accepted, ${run.readings.fallback} replaced by ` +
      `deterministic fallback after validator rejection, ${run.readings.noNarration} with no narration (synthesis failed).`,
  );
  lines.push(
    `- Follow-ups sent: ${run.turns.sent} — ${run.turns.answered} answered first time, ` +
      `${run.turns.answeredAfterRewrite} answered after a validator-forced rewrite, ` +
      `${run.turns.noReply} no reply (seeker sees "The oracle did not answer"). ` +
      `${run.turns.notSent} not sent because the Oracle had closed the conversation.`,
  );
  lines.push(
    '- What reaches the seeker has passed the production validator or is the deterministic fallback. ' +
      'Rejected drafts are listed in transcripts.md so a person can see what the validator stopped.',
    '',
  );

  lines.push('## 2. Answer-first delivery', '');
  lines.push(
    `- exact: median words spoken before the \`interpretation\` field (where the prompt puts the verdict): ` +
      `${run.answerFirst.medianWordsBeforeVerdictField ?? 'n/a'}`,
  );
  lines.push(
    `- heuristic: readings whose first spoken sentence carries a verdict cue: ` +
      `${run.answerFirst.readingsWithCueInFirstSentence} / ${run.answerFirst.readingsMeasured}`,
    '',
  );
  lines.push(
    '| Scenario | Verdict | Words before verdict field | First cue sentence (0 = first) | Words before cue |',
  );
  lines.push('|---|---|---|---|---|');
  for (const s of per) {
    const a = s.reading.answerFirst;
    lines.push(
      `| ${s.id} | ${s.state} | ${a?.wordsBeforeVerdictField ?? '–'} | ${a?.firstCueSentence ?? 'none found'} | ${
        a?.firstCueWords ?? '–'
      } |`,
    );
  }
  lines.push('');

  lines.push('## 3. Conversational follow-ups', '');
  lines.push(`- exact: median reply length ${run.conversation.medianReplyWords ?? 'n/a'} words`);
  lines.push(
    `- exact: replies outside the prompt's 2–5 sentence guide: ${run.conversation.repliesOutsideTwoToFive} / ${run.language.turnsMeasured}`,
  );
  lines.push(
    `- exact: highest share of a reply's 5-word phrases copied from the first reading: ${run.conversation.maxRestatement.toFixed(2)}`,
  );
  lines.push(
    `- exact: replies opening with the same three words as an earlier reply in the same conversation: ${run.conversation.repeatedOpenings}`,
  );
  lines.push(
    `- exact: probe expectations missed (new-question flag / close flag): ${
      run.conversation.probeExpectationsMissed.length === 0
        ? 'none'
        : run.conversation.probeExpectationsMissed.map(m => `${m.scenario}:${m.probe}`).join(', ')
    }`,
    '',
  );

  lines.push('## 4. Language consistency (exact — dominant script)', '');
  lines.push(
    `- First readings not in the seeker's language: ${
      run.language.readingsInWrongScript.length === 0
        ? 'none'
        : run.language.readingsInWrongScript.join('; ')
    }`,
  );
  lines.push(
    `- Follow-up replies not in the seeker's language: ${run.language.turnsInWrongScript} / ${run.language.turnsMeasured}`,
    '',
  );

  lines.push(
    "- The app speaks a first reading with the TTS locale of the seeker's app language " +
      '(en-US / ur-PK / hi-IN — useTextToSpeech.ts), whatever script the text is in. A reading listed ' +
      'above is therefore also spoken in a mismatched voice. How a device voice renders that is not ' +
      'measurable here — it needs on-device playback.',
    '',
  );
  lines.push('## 5. Distinctive Oracle voice', '');
  lines.push(
    `- exact: closing lines used more than once in this run: ${
      run.voice.duplicateSignatures.length === 0
        ? 'none'
        : run.voice.duplicateSignatures.map(d => `"${d.signature}" ×${d.count}`).join('; ')
    }`,
  );
  lines.push(
    `- exact: reading openings (first six words) used more than once: ${
      run.voice.duplicateReadingOpenings.length === 0
        ? 'none'
        : run.voice.duplicateReadingOpenings.map(d => `"${d.opening}" ×${d.count}`).join('; ')
    }`,
  );
  lines.push(`- heuristic: generic-assistant phrasing hits: ${run.voice.genericAssistantFlags}`);
  lines.push(`- exact: follow-up replies naming the Oracle itself: ${run.voice.selfNamedReplies}`);
  lines.push('- Identity itself: human review only.', '');

  lines.push('## 6. Safety and fidelity (heuristic flags)', '');
  lines.push(`- Flags: ${kv(run.safety.flagsByCheck)}`);
  lines.push(
    `- Same terms appearing under a negation ("I cannot guarantee…"), shown not counted: ${kv(run.safety.negatedHitsByCheck)}`,
  );
  lines.push('');
  lines.push('| Scenario | Where | Check | Match |');
  lines.push('|---|---|---|---|');
  for (const s of per) {
    for (const f of s.reading.flags.filter(x => !x.negated)) {
      lines.push(`| ${s.id} | reading | ${f.check} | ${f.match} |`);
    }
    s.turns.forEach((t, i) => {
      for (const f of t.flags.filter(x => !x.negated)) {
        lines.push(`| ${s.id} | follow-up ${i + 1} (${t.probe}) | ${f.check} | ${f.match} |`);
      }
    });
  }
  lines.push('');
  return lines.join('\n');
}

export function transcriptsMarkdown(h: RunHeader, records: readonly ScenarioRecord[]): string {
  const out: string[] = [`# Transcripts — ${h.label}`, ''];
  if (h.mode === 'stub') {
    out.push(STUB_BANNER);
  }
  for (const rec of records) {
    const { scenario: s, reading: r } = rec;
    out.push(`## ${s.id}`, '');
    out.push(
      `Owner verdict **${s.ownerVerdict}** · engine state **${r.state}** (${r.confidence}) · verdict ${r.verdictLabel}` +
        ` · timing ${r.timing ? `${r.timing.minDays}–${r.timing.maxDays} days` : 'none'} · qType ${r.qType}` +
        ` · remedy ${r.interventionRequired ? 'prescribed' : 'none'} · lang ${s.lang}${s.voice ? ' · voice-shaped' : ''}${r.stateMatchesExpected ? '' : ' · ⚠ state differs from scenario'}`,
      '',
    );
    out.push(`**Seeker:** ${s.question}`, '');
    out.push(`**Reading outcome:** ${r.outcome}`, '');
    if (r.narration) {
      const n = r.narration;
      out.push(`> **Finding:** ${n.rkp_finding}`, '>');
      out.push(`> **Interpretation:** ${n.interpretation}`, '>');
      out.push(`> **Approach:** ${n.recommended_approach}`, '>');
      if (n.why_this_remedy) {
        out.push(`> **Why these:** ${n.why_this_remedy}`, '>');
      }
      out.push(`> **Signature:** ${n.signature}`, '');
      out.push(`**Spoken (TTS):** ${r.speakableText ?? '—'}`, '');
    }
    if (r.outcome === 'fallback' && r.draft) {
      out.push('<details><summary>Model draft the validator rejected</summary>', '');
      out.push('```json', JSON.stringify(r.draft, null, 2), '```', '</details>', '');
    }
    rec.turns.forEach((t, i) => {
      out.push(`**Seeker (${i + 1}, ${t.followUp.probe}):** ${t.followUp.text}`, '');
      if (t.outcome === 'not-sent') {
        out.push('_Not sent — the Oracle had already closed this conversation._', '');
        return;
      }
      if (t.answer !== null) {
        const flagsNote = [
          t.isNewQuestion ? 'is_new_question' : '',
          t.conversationComplete ? 'conversation_complete' : '',
        ]
          .filter(Boolean)
          .join(', ');
        out.push(`**Oracle:** ${t.answer}${flagsNote ? ` _(${flagsNote})_` : ''}`, '');
      } else {
        out.push(
          '**Oracle:** _no reply — the seeker sees “The oracle did not answer. Try again.”_',
          '',
        );
      }
      if (t.rejectedDrafts.length > 0) {
        out.push(
          `<details><summary>${t.rejectedDrafts.length} draft(s) rejected by the validator</summary>`,
          '',
        );
        for (const d of t.rejectedDrafts) {
          out.push(`> ${d}`, '');
        }
        out.push('</details>', '');
      }
    });
  }
  return out.join('\n');
}

export function reviewSheetMarkdown(h: RunHeader, per: readonly ScenarioMetrics[]): string {
  const cols = [
    'Judgment integrity',
    'Answer-first',
    'Conversational follow-ups',
    'Language consistency',
    'Distinctive voice',
    'Safety & fidelity',
  ];
  const out = [
    `# Review sheet — ${h.label}`,
    '',
    h.mode === 'stub' ? STUB_BANNER : '',
    'Score each scenario 1–10 per criterion after reading transcripts.md. Leave a cell blank rather than',
    'guess. A criterion’s run score is the median of its filled cells; the overall score is reported only',
    'when every criterion has at least eight filled cells.',
    '',
    `| Scenario | ${cols.join(' | ')} | Notes |`,
    `|---|${cols.map(() => '---').join('|')}|---|`,
    ...per.map(
      s =>
        `| ${s.id} (${s.ownerVerdict}, ${s.lang}${s.voice ? ', voice' : ''}) |${cols.map(() => ' ').join('|')}| |`,
    ),
    '',
  ];
  return out.join('\n');
}
