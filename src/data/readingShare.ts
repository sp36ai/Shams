/**
 * readingShare — a Reading as something worth sending to someone.
 * --------------------------------------------------------------------------
 * A shared Reading is an artifact, not a screenshot of a chat: it carries the
 * question, the moment it was cast for, and the oracle's own words, under the
 * app's name. Pure string assembly — every line is copied from the reading as
 * returned, nothing is recomputed, reworded or summarised here.
 *
 * Nothing is published: this produces text for the platform share sheet, which
 * the seeker then sends wherever they choose. There is no public URL, no
 * server call, and no copy of the Reading leaves the device unless they send
 * it themselves.
 */

import type { ReadingThread } from '@stores/readingThreadsStore';
import type { WatchReading } from '../firebase/watchOracle';

const RULE = '─────────────────────';

function formatMoment(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return '';
  }
  const date = at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/**
 * The reading turn of a thread — the one carrying the cast chart. Returns
 * undefined for a thread whose cast failed, which is not shareable.
 */
function readingOf(thread: ReadingThread): WatchReading | undefined {
  return thread.messages.find(m => m.role === 'oracle' && m.reading !== undefined)?.reading;
}

/** True when there is a completed reading to share. */
export function canShare(thread: ReadingThread): boolean {
  return readingOf(thread) !== undefined;
}

export function buildShareText(thread: ReadingThread, appName = 'SHAMS AL-ASRĀR'): string {
  const reading = readingOf(thread);
  const narration = reading?.oracle?.narration ?? null;

  const lines: string[] = [appName, '', thread.title.toUpperCase()];

  const moment = formatMoment(thread.context?.localMoment ?? thread.createdAt);
  if (moment.length > 0) {
    lines.push(moment);
  }

  lines.push('', RULE, '', 'THE QUESTION', '', thread.question);

  if (narration !== null) {
    lines.push('', RULE, '', 'THE READING', '', narration.rkp_finding);
    lines.push('', RULE, '', 'THE INDICATION', '', narration.interpretation);
    lines.push('', RULE, '', 'GUIDANCE', '', narration.recommended_approach);
    if (narration.signature.length > 0) {
      lines.push('', narration.signature);
    }
  }

  return lines.join('\n');
}
