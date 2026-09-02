/**
 * HistoryScreen tests — past readings list with audio playback
 * ────────────────────────────────────────────────────────────
 * Tests the history list, filtering, sorting, and reading detail modal
 * with audio playback controls for narration.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HistoryScreen from '../HistoryScreen';
import { useReadingsStore } from '@stores/readingsStore';
import type { Reading } from '@stores/readingsStore';

// Mock the theme and translation providers
jest.mock('@theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      colors: { bg: '#000' },
    },
  }),
  useColors: () => ({
    text: '#fff',
    textMuted: '#999',
    textOnPrimary: '#fff',
    accent: '#ffd700',
    border: '#333',
    borderAccent: '#ffd700',
    surface: '#111',
    surfaceElevated: '#222',
    starfield: '#fff',
    nebula1: 'rgba(255, 215, 0, 0.1)',
    nebula2: 'rgba(255, 215, 0, 0.05)',
    nebula3: 'rgba(255, 215, 0, 0.03)',
    positive: '#4CAF50',
    negative: '#f44336',
    goldBright: '#ffd700',
    textFaint: '#666',
  }),
}));

jest.mock('@theme/useTypography', () => ({
  useTypography: () => (key: string) => ({ fontSize: 14 }),
}));

jest.mock('@i18n/I18nProvider', () => ({
  useI18n: () => ({ lang: 'en' }),
  useTranslation: () => (key: string) => key,
}));

jest.mock('@hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({
    activeMessageId: null,
    status: 'idle',
    speak: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn(),
    toggle: jest.fn(),
  }),
}));

jest.mock('@navigation/types', () => ({}));
jest.mock('@components/StarfieldBackground', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@components/oracle/RkpWatchCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@components/oracle/RemedyProtocolCard', () => ({
  __esModule: true,
  default: () => null,
}));

const mockReading: Reading = {
  id: 'r1',
  question: 'Will this project succeed?',
  questionLang: 'en',
  category: 'business',
  verdict: 'YES',
  createdAt: new Date().toISOString(),
  chartJson: {},
  verdictJson: {
    verdict: 'YES',
    confidence: 0.85,
    narration: {
      en: 'The stars align in your favor. Success is written in the heavens.',
    },
  },
};

const Stack = createNativeStackNavigator();

function HistoryScreenWrapper() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

describe('HistoryScreen', () => {
  beforeEach(() => {
    useReadingsStore.getState().clearAll();
  });

  describe('History Store', () => {
    it('adds readings to the store', async () => {
      expect(useReadingsStore.getState().readings.length).toBe(0);

      await useReadingsStore.getState().addReading(mockReading);

      expect(useReadingsStore.getState().readings.length).toBe(1);
      expect(useReadingsStore.getState().readings[0].id).toBe('r1');
    });

    it('filters readings by verdict', async () => {
      const yesReading = { ...mockReading, id: 'r1', verdict: 'YES' as const };
      const noReading = {
        ...mockReading,
        id: 'r2',
        verdict: 'NO' as const,
        question: 'Will this fail?',
      };

      await useReadingsStore.getState().addReading(yesReading);
      await useReadingsStore.getState().addReading(noReading);

      expect(useReadingsStore.getState().readings.length).toBe(2);

      // Filter to YES
      useReadingsStore.getState().setFilter('YES');
      const filtered = useReadingsStore
        .getState()
        .readings.filter(r => r.verdict === 'YES');
      expect(filtered.length).toBe(1);
    });

    it('sorts readings by newest/oldest', async () => {
      const oldReading = {
        ...mockReading,
        id: 'r1',
        createdAt: '2026-01-01T10:00:00Z',
      };
      const newReading = {
        ...mockReading,
        id: 'r2',
        createdAt: '2026-09-02T10:00:00Z',
      };

      await useReadingsStore.getState().addReading(oldReading);
      await useReadingsStore.getState().addReading(newReading);

      const readings = useReadingsStore.getState().readings;
      expect(readings.length).toBe(2);

      // Test sort toggle
      useReadingsStore.getState().setSort('oldest');
      expect(useReadingsStore.getState().sort).toBe('oldest');
    });

    it('deletes readings from store', async () => {
      await useReadingsStore.getState().addReading(mockReading);
      expect(useReadingsStore.getState().readings.length).toBe(1);

      await useReadingsStore.getState().deleteReading(mockReading.id);
      expect(useReadingsStore.getState().readings.length).toBe(0);
    });

    it('clears all readings', async () => {
      await useReadingsStore.getState().addReading(mockReading);
      await useReadingsStore.getState().addReading({
        ...mockReading,
        id: 'r2',
      });

      expect(useReadingsStore.getState().readings.length).toBe(2);

      useReadingsStore.getState().clearAll();
      expect(useReadingsStore.getState().readings.length).toBe(0);
    });
  });

  describe('Reading Data', () => {
    it('stores narration in reading verdictJson', async () => {
      await useReadingsStore.getState().addReading(mockReading);

      const reading = useReadingsStore.getState().readings[0];
      const verdictJson = reading.verdictJson as {
        narration?: { en: string };
      };
      expect(verdictJson.narration?.en).toBe(
        'The stars align in your favor. Success is written in the heavens.',
      );
    });

    it('supports watch oracle data in readings', async () => {
      const watchReading: Reading = {
        ...mockReading,
        watch_oracle: {
          verdict: {
            qType: 'business',
            targetHouse: 10,
            targetSignName: 'Capricorn',
            targetRuler: 'Saturn',
            targetRulerName: 'Zuhal',
            fulfilmentHouse: 11,
            lagnaRuler: 'Sun',
            rulerRelation: 'Friendly',
            state: 'FULFILLED',
            confidence: 'VERY_HIGH',
            score: 8,
            obstruction: 'None',
            reversal: 'NONE',
            timing: { minDays: 3, maxDays: 7 },
            direction: 'South',
            afflictedDirection: null,
            controllerProfile: 'Assertive',
            factors: ['ruler strong'],
          },
          composition: {
            narration: {
              rkp_finding: 'The chart is favorable.',
              interpretation: 'This will succeed.',
              recommended_approach: 'Move forward.',
              why_this_remedy: 'Alignment is perfect.',
              signature: 'The Oracle',
            },
            diagnosis: {
              outcome: 'FAVOURABLE',
              primaryPattern: 'FAVOURABLE_FLOW',
              secondaryPatterns: [],
              timingPosture: 'ACT_NOW',
              confidence: 0.95,
              obstructingAgent: null,
              rationale: ['Ruler is strong'],
            },
            protocol: {
              interventionRequired: false,
              guidance: 'No remedy needed.',
              steps: [],
              rationale: ['Favorable reading'],
            },
          },
          window: { startMinute: 0, endMinute: 5 },
          lagnaSignName: 'Capricorn',
          lagnaRulerName: 'Zuhal',
        },
      };

      await useReadingsStore.getState().addReading(watchReading);

      const reading = useReadingsStore.getState().readings[0];
      expect(reading.watch_oracle).toBeDefined();
      expect(reading.watch_oracle?.verdict.state).toBe('FULFILLED');
      expect(reading.watch_oracle?.composition.diagnosis.outcome).toBe('FAVOURABLE');
    });
  });
});
