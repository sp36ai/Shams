/**
 * oracleVoice — the Claude prose-synthesis layer shared by every oracle
 * callable.
 *
 * Extracted from the original askOracle.ts. It takes a verdict already
 * judged by whichever engine produced it (verdict direction, confidence,
 * timing, the Moon's lunar-mansion line) and returns the poetic Hidden
 * Scroll narration + remedy prescription in Shams al-Asrār's voice. It has
 * no opinion about how the verdict was reached — engine-agnostic by design,
 * so the Digital Watch Oracle gets the exact same voice the old engine did.
 */

import { logger } from '../utils/logger';
import {
  ORACLE_SYNTHESIS_SYSTEM_PROMPT,
  TONE_GUARDRAILS,
  seekerProfileModifier,
} from '../prompts/oracleSynthesisPrompt';
import type { OracleResponse } from '../types';

export type OracleVoiceResult = OracleResponse['oracle'];

export const ORACLE_FALLBACK: NonNullable<OracleVoiceResult> = {
  opening: "The scrolls of this moment have not opened their seal to the oracle's eye.",
  interpretation:
    'In the sacred tradition of Shams al-Asrar, silence is not an absence of answer — it is an answer of a different kind. Return at the next appointed hour.',
  spiritual_layer:
    'And there is not a thing except that its treasures are with Us. (Al-Hijr 15:21)',
  hidden_influence: 'The veil remains because the time for unveiling has not yet arrived.',
  timing: 'Return when al-Qamar completes her current quarter.',
  remedy: {
    quran_verse: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173',
    asma: 'Ya Hafiz — يا حفيظ — The Preserver. 99 times before sleep.',
    dua: 'Allahumma ihdini fiman hadayt — O Allah, guide me among those You have guided.',
    zikr: 'SubhanAllah 33 times after each prayer for three days.',
    sadaqah: 'Give water to someone who is thirsty, or to a living creature.',
  },
  signature: '✨ These words are unveiled under the banner of Shams al-Asrār, by Astro Sarfaraz.',
};

function buildOracleUserMessage(params: {
  verdict: string;
  stage?: 'promise_failed' | 'fructification';
  confidence: number;
  timingWindow?: string;
  timingRange?: { min: number; max: number };
  seekerName?: string;
  motherName?: string;
}): string {
  const { verdict, stage, confidence, timingWindow, timingRange, seekerName, motherName } = params;

  // Map verdict to CONFIRMED / DENIED
  const verdictBinary = verdict === 'YES' || verdict === 'CONDITIONAL' ? 'CONFIRMED' : 'DENIED';

  // Map confidence to HIGH / MEDIUM / LOW
  const confidenceLevel = confidence >= 75 ? 'HIGH' : confidence >= 50 ? 'MEDIUM' : 'LOW';

  // Build timing string
  let timingStr = 'UNCLEAR';
  if (stage === 'promise_failed') {
    timingStr = 'UNCLEAR';
  } else if (timingWindow !== undefined && timingRange !== undefined) {
    timingStr = `${timingRange.min}–${timingRange.max} ${timingWindow}`;
  }

  let msg = `VERDICT: ${verdictBinary}\nCONFIDENCE: ${confidenceLevel}\nTIMING: ${timingStr}`;
  if (seekerName) {
    msg += `\nSEEKER_NAME: ${seekerName}`;
  }
  if (motherName) {
    msg += `\nMOTHER_NAME: ${motherName}`;
  }
  return msg;
}

export async function synthesiseOracleVoice(params: {
  verdict: string;
  stage?: 'promise_failed' | 'fructification';
  confidence: number;
  timingWindow?: string;
  timingRange?: { min: number; max: number };
  manzilaLine: string;
  seekerProfile?: 'clarity' | 'comfort' | 'action' | 'surrender';
  apiKey: string;
  seekerName?: string;
  motherName?: string;
}): Promise<NonNullable<OracleVoiceResult>> {
  const userMessage = buildOracleUserMessage(params);

  const profileBlock = params.seekerProfile ? seekerProfileModifier(params.seekerProfile) : '';

  const systemPrompt =
    ORACLE_SYNTHESIS_SYSTEM_PROMPT +
    `\n\nMOON STATION TONIGHT:\n${params.manzilaLine}\n\nWeave al-Qamar's station naturally into the opening or spiritual_layer. Never state the mansion name as a label. Let it arrive as imagery.` +
    profileBlock +
    TONE_GUARDRAILS;

  const timeoutMs = 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('oracle synthesis HTTP error', { status: res.status, body: body.slice(0, 300) });
      return ORACLE_FALLBACK;
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find(b => b.type === 'text')?.text ?? '';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      logger.warn('oracle synthesis JSON parse failed', { rawText: rawText.slice(0, 200) });
      return ORACLE_FALLBACK;
    }

    const r = (parsed.remedy ?? {}) as Record<string, unknown>;

    return {
      opening: String(parsed.opening ?? ''),
      interpretation: String(parsed.interpretation ?? ''),
      spiritual_layer: String(parsed.spiritual_layer ?? ''),
      hidden_influence: String(parsed.hidden_influence ?? ''),
      timing: typeof parsed.timing === 'string' ? parsed.timing : undefined,
      warning: typeof parsed.warning === 'string' ? parsed.warning : undefined,
      remedy: {
        quran_verse: typeof r.quran_verse === 'string' ? r.quran_verse : undefined,
        asma: typeof r.asma === 'string' ? r.asma : undefined,
        dua: typeof r.dua === 'string' ? r.dua : undefined,
        zikr: typeof r.zikr === 'string' ? r.zikr : undefined,
        sadaqah: typeof r.sadaqah === 'string' ? r.sadaqah : undefined,
      },
      signature: String(
        parsed.signature ??
          '✨ These words are unveiled under the banner of Shams al-Asrār, by Astro Sarfaraz.',
      ),
    };
  } catch (err) {
    clearTimeout(timer);
    logger.warn('oracle synthesis failed', { err: String(err) });
    return ORACLE_FALLBACK;
  }
}
