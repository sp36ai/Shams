/**
 * HomeHero — presentation contract: it shows exactly the values and actions
 * it is given, and an em dash (never a made-up number) when a value is
 * missing.
 */
import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { renderScreen } from '../../../test-utils/renderScreen';
import HomeHero from '../HomeHero';

describe('HomeHero', () => {
  it('shows an em dash for a value that is not available yet', async () => {
    await renderScreen(
      <HomeHero
        metrics={[
          { key: 'hora', label: 'Current Hora', glyph: 'hora', value: '42m' },
          { key: 'sunrise', label: 'Sunrise', glyph: 'sunrise', value: null },
        ]}
        actions={[]}
      />,
    );

    expect(screen.getByTestId('home-hero-metric-hora').props.accessibilityLabel).toBe(
      'Current Hora: 42m',
    );
    expect(screen.getByTestId('home-hero-metric-sunrise').props.accessibilityLabel).toBe(
      'Sunrise: —',
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls the handler of the action that was pressed, and only that one', async () => {
    const ask = jest.fn();
    const other = jest.fn();
    await renderScreen(
      <HomeHero
        metrics={[]}
        actions={[
          { key: 'ask', label: 'Ask Shams', icon: 'oracle', onPress: ask },
          { key: 'readings', label: 'Readings', icon: 'history', onPress: other },
        ]}
      />,
    );

    await userEvent.setup().press(screen.getByLabelText('Ask Shams'));

    expect(ask).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});
