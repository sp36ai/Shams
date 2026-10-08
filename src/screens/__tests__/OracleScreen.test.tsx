/**
 * OracleScreen — navigation wiring regression tests.
 * --------------------------------------------------------------------------
 * This is the home dashboard reported "paralysed" earlier in this branch's
 * history (root cause: react-native-screens delivering no touch events at
 * all without GestureHandlerRootView at the app root — see App.tsx). RNTL's
 * fireEvent/userEvent call a component's onPress handler directly rather
 * than exercising real native touch dispatch, so these tests cannot catch
 * that specific native-delivery regression — what they DO cover, and are
 * worth having regardless, is that each button is wired to the navigation
 * call it's supposed to make. A typo'd route name or a handler that got
 * disconnected during a refactor fails here immediately.
 */
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import Voice from '@react-native-voice/voice';
import { renderScreen } from '../../test-utils/renderScreen';
import OracleScreen from '../OracleScreen';

jest.mock('@utils/permissions', () => ({
  checkMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
  requestMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
}));

describe('OracleScreen navigation wiring', () => {
  /**
   * Home both navigates (tabs, Settings) and pushes (a Reading), so the mock
   * hands back the whole handle rather than one method — asserting on the
   * wrong one is how a push regression would slip past.
   */
  function mockNavigation() {
    const handle = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
      push: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    };
    (useNavigation as jest.Mock).mockReturnValue(handle);
    return handle;
  }

  it('navigates to Settings when the header gear is pressed', async () => {
    const { navigate } = mockNavigation();
    await renderScreen(<OracleScreen />);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('settings-gear-btn'));

    expect(navigate).toHaveBeenCalledWith('Settings');
  });

  it('opens an empty Reading when the ask button is pressed with nothing typed', async () => {
    const { push } = mockNavigation();
    await renderScreen(<OracleScreen />);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('ask-shams-btn'));

    // push, not navigate: a Reading is always its own screen, never a params
    // update to one already on the stack.
    expect(push).toHaveBeenCalledWith('Reading', {});
  });

  it('carries a typed question into the Reading it opens', async () => {
    const { push } = mockNavigation();
    await renderScreen(<OracleScreen />);

    const user = userEvent.setup();
    await user.type(
      screen.getByTestId('home-ask-input'),
      'Should I accept this business opportunity?',
    );
    await user.press(screen.getByTestId('ask-shams-btn'));

    // Home owns the composer that STARTS a Reading; the Reading itself is
    // created on the other side, when the question is actually submitted.
    expect(push).toHaveBeenCalledWith('Reading', {
      initialQuestion: 'Should I accept this business opportunity?',
      initialQuestionKind: 'text',
    });
  });

  // A spoken question takes the same route as a typed one: Home hands it to a
  // new Reading, which asks askWatchOracle. Nothing voice-specific beyond the
  // kind tag travels with it.
  it('opens a Reading with a spoken question when the recognizer stops on its own', async () => {
    const { push } = mockNavigation();
    await renderScreen(<OracleScreen />);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('home-ask-mic-btn'));
    await waitFor(() => expect(Voice.start).toHaveBeenCalled());

    const voice = Voice as unknown as {
      onSpeechEnd?: () => void;
      onSpeechResults?: (e: { value?: string[] }) => void;
    };
    voice.onSpeechEnd?.();
    voice.onSpeechResults?.({ value: ['Will I get the job?'] });

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('Reading', {
        initialQuestion: 'Will I get the job?',
        initialQuestionKind: 'voice',
      }),
    );
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe('OracleScreen layout', () => {
  it('follows the Observatory Hall order: hora, sky, ask, manzil, tier', async () => {
    await renderScreen(<OracleScreen />);
    // Each section's own heading, in the order the design system lists them.
    const headings = [
      'CURRENT HORA',
      "TODAY'S SKY FOR YOU",
      'What would you like to ask?',
      'MOON MANZIL',
      'YOUR TIER',
    ];
    // Rendered order is document order in the serialised tree.
    const tree = JSON.stringify(screen.toJSON());
    const positions = headings.map(h => tree.indexOf(JSON.stringify(h)));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
