import { describe, expect, it } from 'vitest';

import {
  PCM_SAMPLE_RATE,
  REALTIME_URL,
  clientEvents,
  pcmToWav,
  redact,
  synthesize,
  type SpeechRequest,
} from './realtimeSpeech';
import { completedTake, fakeRealtime } from './fakeRealtime';

const KEY = ['sk', 'proj', 'V'.repeat(30)].join('-');
const REQ: SpeechRequest = {
  model: 'gpt-realtime-2.1-mini',
  voice: 'cedar',
  instructions: 'INSTRUCTIONS',
  text: 'Not yet — this is delay, not denial.',
  timeoutMs: 2000,
};

describe('clientEvents', () => {
  it('asks for audio only, in the chosen voice, and sends the exact text as input', () => {
    const [session, item, create] = clientEvents(REQ);
    expect(session).toEqual({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1-mini',
        output_modalities: ['audio'],
        instructions: 'INSTRUCTIONS',
        audio: { output: { voice: 'cedar', format: { type: 'audio/pcm', rate: PCM_SAMPLE_RATE } } },
      },
    });
    expect(item).toEqual({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: REQ.text }] },
    });
    expect(create).toEqual({ type: 'response.create' });
  });
});

describe('synthesize', () => {
  it('connects with the key in the header only, collects audio and the transcript', async () => {
    const { factory, calls } = fakeRealtime(() =>
      completedTake(REQ.text, [Buffer.alloc(100, 1), Buffer.alloc(60, 2)]),
    );
    const r = await synthesize(KEY, REQ, factory);
    expect(r.ok).toBe(true);
    expect(r.pcm.length).toBe(160);
    expect(r.transcript).toBe(REQ.text);
    expect(r.firstAudioMs).not.toBeNull();
    expect(r.responseStatus).toBe('completed');
    expect(r.eventTypes['response.output_audio.delta']).toBe(2);
    expect(calls[0]!.url).toBe(`${REALTIME_URL}?model=gpt-realtime-2.1-mini`);
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(calls[0]!.sent)).not.toContain(KEY);
    expect(r.audioDoneReceived).toBe(true);
    expect(calls[0]!.sent.map(e => e.type)).toEqual([
      'session.update',
      'conversation.item.create',
      'response.create',
    ]);
  });

  it('records a missing audio-finished event without hiding the audio', async () => {
    const { factory } = fakeRealtime(() =>
      completedTake(REQ.text, [Buffer.alloc(100)], { omitAudioDone: true }),
    );
    const r = await synthesize(KEY, REQ, factory);
    expect(r.ok).toBe(true);
    expect(r.audioDoneReceived).toBe(false);
    expect(r.pcm.length).toBe(100);
  });

  it('fails on a service error event, without leaking a key in the message', async () => {
    const { factory } = fakeRealtime(() => [
      { type: 'error', error: { code: 'invalid_request_error', message: `bad voice; key ${KEY}` } },
    ]);
    const r = await synthesize(KEY, REQ, factory);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('invalid_request_error');
    expect(r.error).not.toContain(KEY);
    expect(r.pcm.length).toBe(0);
  });

  it('fails an incomplete response or one with no audio', async () => {
    const inc = fakeRealtime(() => [{ type: 'response.done', response: { status: 'incomplete' } }]);
    expect(await synthesize(KEY, REQ, inc.factory)).toMatchObject({
      ok: false,
      error: 'response incomplete',
    });
    const silent = fakeRealtime(() => [
      { type: 'response.done', response: { status: 'completed' } },
    ]);
    expect(await synthesize(KEY, REQ, silent.factory)).toMatchObject({
      ok: false,
      error: 'response completed with no audio',
    });
  });

  it('times out, and fails on an early close or a failed connect', async () => {
    const hang = fakeRealtime(() => null);
    expect(await synthesize(KEY, { ...REQ, timeoutMs: 30 }, hang.factory)).toMatchObject({
      ok: false,
      error: 'timeout after 30ms',
    });
    const closed = fakeRealtime(() => null, { closeEarly: true });
    expect((await synthesize(KEY, REQ, closed.factory)).error).toContain('closed before');
    const refused = fakeRealtime(() => null, { failConnect: true });
    expect((await synthesize(KEY, REQ, refused.factory)).error).toContain('connect failed');
  });
});

describe('helpers', () => {
  it('pcmToWav writes a valid 24 kHz mono PCM16 header', () => {
    const wav = pcmToWav(Buffer.alloc(480));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(480);
    expect(wav.length).toBe(44 + 480);
  });

  it('redact removes key-shaped text', () => {
    expect(redact(`x ${KEY} y`)).toBe('x sk-[redacted] y');
  });
});
