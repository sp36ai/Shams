import type { Voice } from 'react-native-tts';
import { chooseNarratorVoice } from '../useTextToSpeech';

const voice = (id: string, extra: Partial<Voice> = {}): Voice => ({
  id,
  name: id,
  language: id.slice(0, 5),
  quality: 400,
  latency: 200,
  networkConnectionRequired: id.endsWith('-network'),
  notInstalled: false,
  ...extra,
});

describe('chooseNarratorVoice (owner decision 2026-10-14)', () => {
  it('prefers the deepest known male English voice, on-device first', () => {
    const voices = [
      voice('en-us-x-sfg-local'),
      voice('en-gb-x-rjs-local'),
      voice('en-us-x-iom-network'),
      voice('en-us-x-iom-local'),
    ];
    expect(chooseNarratorVoice(voices, 'en')).toBe('en-us-x-iom-local');
  });

  it('falls through the list and accepts a network voice when that is all there is', () => {
    expect(chooseNarratorVoice([voice('en-gb-x-rjs-network')], 'en')).toBe('en-gb-x-rjs-network');
    expect(chooseNarratorVoice([voice('en-us-x-sfg#male_1-local')], 'en')).toBe(
      'en-us-x-sfg#male_1-local',
    );
    expect(chooseNarratorVoice([voice('en-US-SMTm00')], 'en')).toBe('en-US-SMTm00');
  });

  it('skips voices that are not installed', () => {
    expect(chooseNarratorVoice([voice('en-us-x-iom-local', { notInstalled: true })], 'en')).toBe(
      null,
    );
  });

  it('keeps the engine default when no known male voice exists, or for Urdu/Hindi', () => {
    expect(chooseNarratorVoice([voice('en-us-x-sfg-local')], 'en')).toBe(null);
    expect(chooseNarratorVoice([], 'en')).toBe(null);
    expect(chooseNarratorVoice([voice('en-us-x-iom-local')], 'ur')).toBe(null);
    expect(chooseNarratorVoice([voice('en-us-x-iom-local')], 'hi')).toBe(null);
  });
});
