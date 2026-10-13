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
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
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

  it('has no settings gear any more; Settings is in the menu', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    expect(screen.queryByTestId('settings-gear-btn')).toBeNull();
    expect(screen.getByTestId('home-menu-btn').props.accessibilityLabel).toBe('Menu');
  });

  it('opens the menu with Al-Falak, Readings and Settings, in that order', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    expect(screen.queryByTestId('home-menu')).toBeNull();

    await userEvent.setup().press(screen.getByTestId('home-menu-btn'));

    const tree = JSON.stringify(screen.toJSON());
    const ids = ['"home-menu-alfalak"', '"home-menu-readings"', '"home-menu-settings"'];
    const positions = ids.map(id => tree.indexOf(id));
    expect(positions.every(p => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it.each([
    ['alfalak', 'AlFalak'],
    ['readings', 'Readings'],
    ['settings', 'Settings'],
  ])('menu item %s navigates to %s and closes the menu', async (key, route) => {
    const { navigate } = mockNavigation();
    await renderScreen(<OracleScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByTestId('home-menu-btn'));
    await user.press(screen.getByTestId(`home-menu-${key}`));

    expect(navigate).toHaveBeenCalledWith(route);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('home-menu')).toBeNull();
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

  /** The mandala renders once its slot is measured; tests have no layout pass. */
  async function layoutMandalaSlot(): Promise<void> {
    await fireEvent(screen.getByTestId('home-mandala-slot'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 240 } },
    });
  }

  it('opens an empty Reading when the mandala is pressed', async () => {
    const { push, navigate } = mockNavigation();
    await renderScreen(<OracleScreen />);
    await layoutMandalaSlot();

    await userEvent.setup().press(screen.getByTestId('home-hero-action-ask'));

    // After the lift animation, not before it.
    await waitFor(() => expect(push).toHaveBeenCalledWith('Reading', {}), { timeout: 3000 });
    expect(push).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('labels the mandala as the Ask Shams button', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    await layoutMandalaSlot();

    const mandala = screen.getByTestId('home-hero-action-ask');
    expect(mandala.props.accessibilityRole).toBe('button');
    expect(mandala.props.accessibilityLabel).toBe('Ask Shams');
  });

  it('no longer shows the round Readings / Al-Falak / Ask buttons', async () => {
    mockNavigation();
    await renderScreen(<OracleScreen />);
    expect(screen.queryByTestId('home-hero-action-alfalak')).toBeNull();
    expect(screen.queryByTestId('home-hero-action-readings')).toBeNull();
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
      '"home-mandala-slot"',
      '"home-tile-hora"',
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

describe('OracleScreen genie', () => {
  it('opens the Genie guide from the 🧞 button', async () => {
    await renderScreen(<OracleScreen />);
    expect(screen.queryByTestId('genie-guide')).toBeNull();
    await userEvent.setup().press(screen.getByTestId('genie-btn'));
    expect(screen.getByTestId('genie-guide')).toBeTruthy();
  });
});

describe('OracleScreen layout', () => {
  it('keeps everything inside the hero: capsules, actions, tiles, then tier', async () => {
    await renderScreen(<OracleScreen />);
    const tree = JSON.stringify(screen.toJSON());
    const ids = [
      '"home-hero"',
      '"home-hero-metric-hora"',
      '"home-mandala-slot"',
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
