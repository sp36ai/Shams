/**
 * OracleChatScreen — Send re-entrancy-guard regression test.
 * --------------------------------------------------------------------------
 * Reproduces the exact failure this branch was created to fix: an
 * askWatchOracle() rejection with code 'unauthenticated' routes into a
 * diagnostic probe (auth().currentUser.getIdToken() + getAppCheckToken())
 * that, on some real devices, hangs forever instead of settling. Because
 * that probe sat inside the same try/catch/finally that resets
 * sendingRef.current, a hang there used to leave the Ask screen's Send
 * button (and every suggestion chip) permanently dead for the rest of the
 * sitting — the very first tap after the failure would silently no-op.
 *
 * Both native calls are mocked here to never resolve or reject, exactly
 * reproducing that hang. This test uses REAL timers (not fake ones) and
 * waits out the actual DIAGNOSTIC_PROBE_TIMEOUT_MS backstop — slower than a
 * faked clock, but it avoids the fragility of interleaving fake timers with
 * this component's several chained awaits (classifyQuestion, consumeOne,
 * acquireLocation, runEngine), and there is exactly one test in this
 * category, not a hot loop.
 *
 * Uses the `userEvent` API (not `fireEvent`) for the TextInput interaction —
 * `fireEvent.changeText` does not reliably flush a controlled TextInput's
 * value in this project's RNTL setup, while `userEvent.type` does.
 */
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { renderScreen } from '../../test-utils/renderScreen';
import OracleChatScreen from '../OracleChatScreen';

jest.mock('../../firebase/watchOracle', () => ({
  askWatchOracle: jest.fn(() => {
    const err = Object.assign(new Error('askWatchOracle rejected'), {
      code: 'unauthenticated',
    });
    return Promise.reject(err);
  }),
  deviceUtcOffsetMinutes: jest.fn(() => 330),
}));

jest.mock('../../firebase/appCheck', () => ({
  // Never settles — the exact real-world failure mode this test targets.
  getAppCheckToken: jest.fn(() => new Promise(() => undefined)),
}));

// Unrelated to the guard under test — this only silences a caught, logged
// "trial server registration failed" error from the free-plan gate's
// startTrial() side effect (a fresh quota store always starts a trial on
// the first ask), which otherwise clutters test output.
jest.mock('../../firebase/trial', () => ({
  activateTrialOnServer: jest.fn(() =>
    Promise.resolve({ startedAt: new Date().toISOString(), expiresAt: '', alreadyActive: false }),
  ),
}));

describe('OracleChatScreen — Send button re-entrancy guard', () => {
  beforeEach(() => {
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
      push: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    });

    // auth().currentUser.getIdToken() is the diagnostic probe's other
    // never-settling call — see the firebase/appCheck mock above for the
    // other one.
    const auth = jest.requireMock('@react-native-firebase/auth').default;
    auth().currentUser = { getIdToken: jest.fn(() => new Promise(() => undefined)) };
  });

  it('re-enables Send after the App Check diagnostic probe hangs forever', async () => {
    const { askWatchOracle } = jest.requireMock('../../firebase/watchOracle');

    await renderScreen(<OracleChatScreen />);
    const user = userEvent.setup();

    const input = screen.getByTestId('oracle-input');
    await user.type(input, 'Will the job offer come through?');
    await user.press(screen.getByTestId('oracle-send-btn'));

    // In flight: the composer disables the instant runEngine()/
    // askWatchOracle() is pending. Checked on the TextInput's `editable`
    // prop rather than the Send Pressable's `disabled` prop — RNTL doesn't
    // surface Pressable's `disabled` on `.props` the way it does a real
    // TextInput prop, and `editable={!sending}` isolates exactly the state
    // this test cares about.
    await waitFor(() => expect(input.props.editable).toBe(false));
    expect(askWatchOracle).toHaveBeenCalledTimes(1);

    // The real regression: previously, a hang in the diagnostic probe kept
    // this true forever. It must flip back within DIAGNOSTIC_PROBE_TIMEOUT_MS
    // (8s) of the rejection, not never.
    await waitFor(() => expect(input.props.editable).toBe(true), { timeout: 12000 });

    // The stronger assertion: sendingRef.current (invisible to RTL) is only
    // observable through its effect — a second attempt must actually go
    // through, not silently no-op the way it did before the fix.
    await user.type(screen.getByTestId('oracle-input'), 'Will the job offer come through?');
    await user.press(screen.getByTestId('oracle-send-btn'));

    await waitFor(() => expect(askWatchOracle).toHaveBeenCalledTimes(2));
  }, 20000);
});
