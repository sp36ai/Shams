/**
 * OnboardingScreen — the seeker-profile questions are optional (owner
 * decision 2026-10-14). Skipping finishes onboarding with the default
 * profile and makes no server call.
 */

import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { renderScreen } from '../../test-utils/renderScreen';
import OnboardingScreen from '../OnboardingScreen';
import { useSettingsStore } from '@stores/settingsStore';
import { httpsCallable } from '../../firebase/functionsRegion';

beforeEach(() => {
  useSettingsStore.getState().resetProfile();
  (httpsCallable as jest.Mock).mockClear();
});

describe('OnboardingScreen skip', () => {
  it('offers Skip on the first question', async () => {
    await renderScreen(<OnboardingScreen />);
    expect(screen.getByTestId('onboarding-skip-btn')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('finishes onboarding with the default profile and asks the server nothing', async () => {
    await renderScreen(<OnboardingScreen />);
    await userEvent.setup().press(screen.getByTestId('onboarding-skip-btn'));

    const s = useSettingsStore.getState();
    expect(s.hasSeenOnboarding).toBe(true);
    expect(s.seekerProfile).toBe('clarity');
    expect(httpsCallable).not.toHaveBeenCalledWith('inferProfile');
  });
});
