/**
 * realtimeSpeech.ts — speak one validated text through the OpenAI Realtime API.
 * --------------------------------------------------------------------------
 * Why Realtime and not /v1/audio/speech: the speech endpoint accepts only
 * tts-1, tts-1-hd, gpt-4o-mini-tts and gpt-4o-mini-tts-2025-12-15 (API
 * reference, checked 2026-10-12), all scheduled for shutdown on 2027-01-06.
 * Their named replacement, gpt-realtime-2.1-mini, is reached over the
 * Realtime API (WebSocket), where audio arrives as base64 PCM deltas — not
 * as a file response. Owner decision: audition the replacement.
 *
 * Protocol used (Realtime GA, as documented 2026-10-12):
 *   connect   wss://api.openai.com/v1/realtime?model=<model>
 *             (Authorization header; server-side only — the key never
 *             reaches the app)
 *   send      session.update        output audio only, voice, PCM 24 kHz,
 *                                   instructions (performance.ts)
 *             conversation.item.create  the validated text, as input_text
 *             response.create
 *   receive   response.output_audio.delta             base64 PCM16 chunks
 *             response.output_audio_transcript.*      what the model said
 *             response.done / error
 *
 * Every server event type seen is recorded, so the first live run shows
 * exactly how the service responded. A request shape the service rejects
 * arrives as an `error` event and fails the take with that message — it is
 * never papered over. The take is only usable if fidelity.ts finds the
 * transcript verbatim.
 */

export const REALTIME_URL = 'wss://api.openai.com/v1/realtime';
export const PCM_SAMPLE_RATE = 24_000;

/** The subset of the WHATWG WebSocket the adapter uses — Node 22's global WebSocket satisfies it. */
export interface SocketLike {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = (url: string, headers: Readonly<Record<string, string>>) => SocketLike;

export const nodeSocketFactory: SocketFactory = (url, headers) =>
  // Node's WebSocket (undici) accepts a non-standard `headers` init; checked
  // in this environment to send Authorization on the upgrade request.
  new (WebSocket as unknown as new (
    u: string,
    init: { headers: Record<string, string> },
  ) => SocketLike)(url, {
    headers: { ...headers },
  });

export interface SpeechRequest {
  readonly model: string;
  readonly voice: string;
  readonly instructions: string;
  readonly text: string;
  readonly timeoutMs: number;
}

export interface SpeechResult {
  readonly ok: boolean;
  /** Raw PCM16 little-endian mono at 24 kHz. Empty on failure. */
  readonly pcm: Buffer;
  /** The provider's transcript of its own spoken output. */
  readonly transcript: string;
  /** ms from sending response.create to the first audio delta; null if none arrived. */
  readonly firstAudioMs: number | null;
  readonly totalMs: number;
  /** Server event type → count, for evidence. */
  readonly eventTypes: Readonly<Record<string, number>>;
  /** response.done status when one arrived ('completed', 'incomplete', ...). */
  readonly responseStatus: string | null;
  /** Safe for reports — key-shaped text removed. */
  readonly error: string | null;
}

export function redact(text: string): string {
  return text.replace(/\bsk-[A-Za-z0-9_*-]{6,}/g, 'sk-[redacted]').slice(0, 300);
}

/** The three client events, exported so tests can assert exactly what is sent. */
export function clientEvents(req: SpeechRequest): Array<Record<string, unknown>> {
  return [
    {
      type: 'session.update',
      session: {
        type: 'realtime',
        model: req.model,
        output_modalities: ['audio'],
        instructions: req.instructions,
        audio: {
          output: { voice: req.voice, format: { type: 'audio/pcm', rate: PCM_SAMPLE_RATE } },
        },
      },
    },
    {
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: req.text }] },
    },
    { type: 'response.create' },
  ];
}

export function synthesize(
  apiKey: string,
  req: SpeechRequest,
  factory: SocketFactory = nodeSocketFactory,
): Promise<SpeechResult> {
  return new Promise(resolve => {
    const started = Date.now();
    let sentAt: number | null = null;
    let firstAudioMs: number | null = null;
    const chunks: Buffer[] = [];
    let transcriptDeltas = '';
    let transcriptDone: string | null = null;
    let responseStatus: string | null = null;
    const eventTypes: Record<string, number> = {};
    let settled = false;
    let socket: SocketLike | null = null;

    const finish = (ok: boolean, error: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // already closed
      }
      resolve({
        ok,
        pcm: ok ? Buffer.concat(chunks) : Buffer.alloc(0),
        transcript: (transcriptDone ?? transcriptDeltas).trim(),
        firstAudioMs,
        totalMs: Date.now() - started,
        eventTypes,
        responseStatus,
        error: error === null ? null : redact(error),
      });
    };

    const timer = setTimeout(
      () => finish(false, `timeout after ${req.timeoutMs}ms`),
      req.timeoutMs,
    );

    try {
      socket = factory(`${REALTIME_URL}?model=${encodeURIComponent(req.model)}`, {
        authorization: `Bearer ${apiKey}`,
      });
    } catch (err) {
      finish(false, `connect failed: ${String(err)}`);
      return;
    }

    socket.onopen = () => {
      for (const ev of clientEvents(req)) {
        socket!.send(JSON.stringify(ev));
      }
      sentAt = Date.now();
    };
    socket.onerror = ev =>
      finish(false, `socket error: ${String((ev as { message?: unknown })?.message ?? 'unknown')}`);
    socket.onclose = () => finish(false, 'socket closed before the response completed');
    socket.onmessage = ev => {
      let msg: { type?: unknown; [k: string]: unknown };
      try {
        msg = JSON.parse(String(ev.data)) as typeof msg;
      } catch {
        eventTypes['(unparseable)'] = (eventTypes['(unparseable)'] ?? 0) + 1;
        return;
      }
      const type = typeof msg.type === 'string' ? msg.type : '(no type)';
      eventTypes[type] = (eventTypes[type] ?? 0) + 1;

      switch (type) {
        case 'error': {
          const e = msg.error as { message?: unknown; code?: unknown } | undefined;
          finish(
            false,
            `service error: ${String(e?.code ?? '')} ${String(e?.message ?? '')}`.trim(),
          );
          break;
        }
        case 'response.output_audio.delta':
          if (typeof msg.delta === 'string') {
            if (firstAudioMs === null && sentAt !== null) {
              firstAudioMs = Date.now() - sentAt;
            }
            chunks.push(Buffer.from(msg.delta, 'base64'));
          }
          break;
        case 'response.output_audio_transcript.delta':
          if (typeof msg.delta === 'string') {
            transcriptDeltas += msg.delta;
          }
          break;
        case 'response.output_audio_transcript.done':
          if (typeof msg.transcript === 'string') {
            transcriptDone = msg.transcript;
          }
          break;
        case 'response.done': {
          const status = (msg.response as { status?: unknown } | undefined)?.status;
          responseStatus = typeof status === 'string' ? status : null;
          if (responseStatus !== null && responseStatus !== 'completed') {
            finish(false, `response ${responseStatus}`);
          } else if (chunks.length === 0) {
            finish(false, 'response completed with no audio');
          } else {
            finish(true, null);
          }
          break;
        }
        default:
          break;
      }
    };
  });
}

/** Wrap PCM16 mono in a WAV header so a reviewer can play the take. */
export function pcmToWav(pcm: Buffer, sampleRate = PCM_SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
