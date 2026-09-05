/**
 * Tier-gating regression tests.
 * --------------------------------------------------------------------------
 * Covers THEME_TIER / tierMeetsRequirement / isThemeUnlocked in themes.ts —
 * the logic that decides which of the 8 themes a user on a given plan may
 * select. See src/theme/ThemeProvider.tsx and src/components/ThemeSwitcher.tsx
 * for where this is enforced.
 */

import {
  THEME_IDS,
  THEME_TIER,
  isThemeUnlocked,
  tierMeetsRequirement,
  type ThemeId,
} from '../themes';
import type { PlanTier } from '@stores/quotaStore';

describe('THEME_TIER', () => {
  it('assigns a tier to every theme — no gap that would silently unlock/hide one', () => {
    for (const id of THEME_IDS) {
      expect(THEME_TIER[id]).toBeDefined();
    }
  });

  it('darAlShams is the one free-tier theme', () => {
    const freeThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'free');
    expect(freeThemes).toEqual(['darAlShams']);
  });

  it('the five original colour variants require Mureed', () => {
    const mureedThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'mureed');
    expect(mureedThemes.sort()).toEqual(
      ['laylAlBahr', 'narAlHadid', 'subhAlWahy', 'zaytunAlHikma', 'sirrAlBanafsaj'].sort(),
    );
  });

  it('the two newest themes require Khāṣṣ', () => {
    const khassThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'khass');
    expect(khassThemes.sort()).toEqual(['qutbAlAnwar', 'kanzAlAsrar'].sort());
  });
});

describe('tierMeetsRequirement', () => {
  it('a higher-ranked tier always meets a lower requirement', () => {
    expect(tierMeetsRequirement('khass', 'free')).toBe(true);
    expect(tierMeetsRequirement('khass', 'mureed')).toBe(true);
    expect(tierMeetsRequirement('khass', 'khass')).toBe(true);
    expect(tierMeetsRequirement('mureed', 'free')).toBe(true);
    expect(tierMeetsRequirement('mureed', 'mureed')).toBe(true);
  });

  it('a lower-ranked tier never meets a higher requirement', () => {
    expect(tierMeetsRequirement('free', 'mureed')).toBe(false);
    expect(tierMeetsRequirement('free', 'khass')).toBe(false);
    expect(tierMeetsRequirement('mureed', 'khass')).toBe(false);
  });
});

describe('isThemeUnlocked', () => {
  const casesByPlan: Record<PlanTier, { unlocked: ThemeId[]; locked: ThemeId[] }> = {
    free: {
      unlocked: ['darAlShams'],
      locked: [
        'laylAlBahr',
        'narAlHadid',
        'subhAlWahy',
        'zaytunAlHikma',
        'sirrAlBanafsaj',
        'qutbAlAnwar',
        'kanzAlAsrar',
      ],
    },
    mureed: {
      unlocked: [
        'darAlShams',
        'laylAlBahr',
        'narAlHadid',
        'subhAlWahy',
        'zaytunAlHikma',
        'sirrAlBanafsaj',
      ],
      locked: ['qutbAlAnwar', 'kanzAlAsrar'],
    },
    khass: {
      unlocked: [...THEME_IDS],
      locked: [],
    },
  };

  for (const plan of Object.keys(casesByPlan) as PlanTier[]) {
    describe(`on the ${plan} plan`, () => {
      for (const id of casesByPlan[plan].unlocked) {
        it(`unlocks ${id}`, () => {
          expect(isThemeUnlocked(id, plan)).toBe(true);
        });
      }
      for (const id of casesByPlan[plan].locked) {
        it(`locks ${id}`, () => {
          expect(isThemeUnlocked(id, plan)).toBe(false);
        });
      }
    });
  }
});
