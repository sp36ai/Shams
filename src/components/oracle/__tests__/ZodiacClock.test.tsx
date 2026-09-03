import React from 'react';
import { screen } from '@testing-library/react-native';

import { renderScreen } from '../../../test-utils/renderScreen';
import ZodiacClock from '../ZodiacClock';

describe('ZodiacClock', () => {
  it('shows the exact sun/moon labels it was given, not a recomputed one', async () => {
    await renderScreen(
      <ZodiacClock
        sunLongitude={134.5}
        moonLongitude={192.0}
        sunLabel="Burj Asad, 14.5°"
        moonLabel="Burj Mizan, 12.0°"
      />,
    );

    expect(screen.getByText('Burj Asad, 14.5°')).toBeTruthy();
    expect(screen.getByText('Burj Mizan, 12.0°')).toBeTruthy();
  });

  it('renders labels for a Sun near the 0°/360° boundary without crashing', async () => {
    await renderScreen(
      <ZodiacClock
        sunLongitude={359.9}
        moonLongitude={0}
        sunLabel="Burj Hut, 29.9°"
        moonLabel="Burj Hamal, 0.0°"
      />,
    );

    expect(screen.getByText('Burj Hut, 29.9°')).toBeTruthy();
    expect(screen.getByText('Burj Hamal, 0.0°')).toBeTruthy();
  });
});
