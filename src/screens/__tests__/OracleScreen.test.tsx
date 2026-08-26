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
import { screen, userEvent } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { renderScreen } from '../../test-utils/renderScreen';
import OracleScreen from '../OracleScreen';

describe('OracleScreen navigation wiring', () => {
  function mockNavigate() {
    const navigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate,
      goBack: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
      push: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    });
    return navigate;
  }

  it('navigates to Settings when the header gear is pressed', async () => {
    const navigate = mockNavigate();
    await renderScreen(<OracleScreen />);

    const user = userEvent.setup();
    await user.press(screen.getByTestId('settings-gear-btn'));

    expect(navigate).toHaveBeenCalledWith('Settings');
  });
});
