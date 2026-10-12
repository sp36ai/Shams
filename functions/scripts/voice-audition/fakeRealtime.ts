/**
 * A scripted stand-in for the Realtime WebSocket, for tests only. It records
 * what the client sends and replies with the events a test chooses. Not a
 * test file itself.
 */
import type { SocketFactory, SocketLike } from './realtimeSpeech';

export interface FakeCall {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly sent: Array<Record<string, unknown>>;
}

/** `reply(sent)` returns the server events to emit once response.create arrives. `null` = never answer. */
export function fakeRealtime(
  reply: (call: FakeCall) => Array<Record<string, unknown>> | null,
  opts: { failConnect?: boolean; closeEarly?: boolean } = {},
): { factory: SocketFactory; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const factory: SocketFactory = (url, headers) => {
    if (opts.failConnect) {
      throw new Error('ECONNREFUSED');
    }
    const call: FakeCall = { url, headers, sent: [] };
    calls.push(call);
    const sock: SocketLike = {
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send(data: string) {
        const ev = JSON.parse(data) as Record<string, unknown>;
        call.sent.push(ev);
        if (ev.type === 'response.create') {
          if (opts.closeEarly) {
            setTimeout(() => sock.onclose?.({}), 0);
            return;
          }
          const events = reply(call);
          if (events === null) {
            return;
          }
          setTimeout(() => {
            for (const e of events) {
              sock.onmessage?.({ data: JSON.stringify(e) });
            }
          }, 1);
        }
      },
      close() {
        // no-op
      },
    };
    setTimeout(() => sock.onopen?.({}), 0);
    return sock;
  };
  return { factory, calls };
}

/**
 * The events of a completed take that spoke `transcript` with the given PCM
 * bytes. `omitAudioDone` drops the audio-finished event, as a truncated
 * stream would.
 */
export function completedTake(
  transcript: string,
  pcmChunks: Buffer[] = [Buffer.alloc(4800)],
  opts: { omitAudioDone?: boolean } = {},
): Array<Record<string, unknown>> {
  return [
    { type: 'session.updated' },
    { type: 'response.created' },
    ...pcmChunks.map(b => ({ type: 'response.output_audio.delta', delta: b.toString('base64') })),
    ...(opts.omitAudioDone ? [] : [{ type: 'response.output_audio.done' }]),
    { type: 'response.output_audio_transcript.delta', delta: transcript.slice(0, 5) },
    { type: 'response.output_audio_transcript.delta', delta: transcript.slice(5) },
    { type: 'response.output_audio_transcript.done', transcript },
    { type: 'response.done', response: { status: 'completed' } },
  ];
}
