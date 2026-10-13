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
});

describe('OracleScreen hero', () => {
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

  it('opens an empty Reading from the hero Ask button', async () => {
    const { push, navigate } = mockNavigation();
    await renderScreen(<OracleScreen />);

    await userEvent.setup().press(screen.getByTestId('home-hero-action-ask'));

    expect(push).toHaveBeenCalledWith('Reading', {});
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['alfalak', 'AlFalak'],
    ['readings', 'Readings'],
  ])('hero %s button navigates to the %s tab', async (key, route) => {
    const { navigate, push } = mockNavigation();
    await renderScreen(<OracleScreen />);

    await userEvent.setup().press(screen.getByTestId(`home-hero-action-${key}`));

    expect(navigate).toHaveBeenCalledWith(route);
    expect(push).not.toHaveBeenCalled();
  });

  it('labels each metric capsule with its real value, never a placeholder number', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);

    for (const key of ['hora', 'sunrise', 'sunset']) {
      const capsule = screen.getByTestId(`home-hero-metric-${key}`);
      // label: value — the value is either live data or the em dash for
      // "not available yet"; it must never be empty.
      expect(capsule.props.accessibilityLabel).toMatch(/^.+: .+$/);
    }
    expect(screen.getByTestId('home-hero-metric-hora').props.accessibilityLabel).toMatch(
      /^Current Hora: /,
    );
  });

  it('puts the capsules first, in the order sunrise, current hora, sunset', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    const tree = JSON.stringify(screen.toJSON());
    const ids = [
      '"home-hero-metric-sunrise"',
      '"home-hero-metric-hora"',
      '"home-hero-metric-sunset"',
      '"home-hero-action-ask"',
    ];
    const positions = ids.map(id => tree.indexOf(id));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('opens the full text of a tile in the detail sheet, and closes it', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    const user = userEvent.setup();

    expect(screen.queryByTestId('home-detail-sheet')).toBeNull();
    await user.press(screen.getByTestId('home-tile-favored'));
    expect(screen.getByTestId('home-detail-sheet')).toBeTruthy();
    // The tile's label, and the same label as the sheet's title.
    expect(screen.getAllByText('FAVORED NOW')).toHaveLength(2);

    await user.press(screen.getByTestId('home-detail-close'));
    expect(screen.queryByTestId('home-detail-sheet')).toBeNull();
  });

  it('opens Al-Falak from the Current Hora detail', async () => {
    const { navigate } = mockNavigation();
    await renderScreen(<OracleScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('home-tile-hora'));
    await user.press(screen.getByTestId('home-detail-open-alfalak'));

    expect(navigate).toHaveBeenCalledWith('AlFalak');
    expect(screen.queryByTestId('home-detail-sheet')).toBeNull();
  });
});

describe('OracleScreen layout', () => {
  it('keeps everything inside the hero: capsules, actions, tiles, then tier', async () => {
    await renderScreen(<OracleScreen />);
    const tree = JSON.stringify(screen.toJSON());
    const ids = [
      '"home-hero"',
      '"home-hero-metric-hora"',
      '"home-hero-action-ask"',
      '"home-tile-hora"',
      '"home-tile-sky"',
      '"home-tile-manzil"',
      '"home-tile-favored"',
      '"home-tile-blessing"',
      '"home-tier-line"',
    ];
    const positions = ids.map(id => tree.indexOf(id));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('no longer duplicates the Ask box or the Reading History row', async () => {
    await renderScreen(<OracleScreen />);
    expect(screen.queryByTestId('home-ask-input')).toBeNull();
    expect(screen.queryByText('What would you like to ask?')).toBeNull();
    expect(screen.queryByText('Reading History')).toBeNull();
  });
});
