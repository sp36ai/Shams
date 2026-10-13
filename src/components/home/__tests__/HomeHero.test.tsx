/**
 * HomeHero — presentation contract: it shows exactly the values and actions
 * it is given, and an em dash (never a made-up number) when a value is
 * missing.
 */
import React from 'react';
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
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
        onAsk={jest.fn()}
        askLabel="Ask Shams"
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

  it('asks once when the mandala is pressed, however often it is tapped', async () => {
    const ask = jest.fn();
    await renderScreen(<HomeHero metrics={[]} onAsk={ask} askLabel="Ask Shams" />);
    await fireEvent(screen.getByTestId('home-mandala-slot'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 240 } },
    });

    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Ask Shams'));
    await user.press(screen.getByLabelText('Ask Shams'));

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });
});
