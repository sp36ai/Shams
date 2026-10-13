/**
 * Tier-gating regression tests.
 * --------------------------------------------------------------------------
 * Covers THEME_TIER / tierMeetsRequirement / isThemeUnlocked in themes.ts —
 * the logic that decides which of the 9 themes a user on a given plan may
 * select. See src/theme/ThemeProvider.tsx and src/components/ThemeSwitcher.tsx
 * for where this is enforced.
 */

import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  THEME_TIER,
  VISIBLE_THEME_IDS,
  getHomeStyle,
  getTheme,
  isThemeUnlocked,
  isValidThemeId,
  pickerThemeIds,
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

  it('midnightCelestial (the default) and darAlShams are the free-tier themes', () => {
    const freeThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'free');
    expect(freeThemes).toEqual(['midnightCelestial', 'darAlShams']);
  });

  it('the default theme is free, so no plan can lock a user out of it', () => {
    expect(THEME_TIER[DEFAULT_THEME_ID]).toBe('free');
  });

  it('the five original colour variants and Qamar al-Fiḍḍa require Mureed', () => {
    const mureedThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'mureed');
    expect(mureedThemes.sort()).toEqual(
      [
        'laylAlBahr',
        'narAlHadid',
        'subhAlWahy',
        'zaytunAlHikma',
        'sirrAlBanafsaj',
        'qamarAlFidda',
      ].sort(),
    );
  });

  it('Quṭb, Kanz and Zumurrud al-Malakūt require Khāṣṣ', () => {
    const khassThemes = THEME_IDS.filter(id => THEME_TIER[id] === 'khass');
    expect(khassThemes.sort()).toEqual(['qutbAlAnwar', 'kanzAlAsrar', 'zumurrudAlMalakut'].sort());
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

/**
 * The real per-tier gating decision, independent of the testing-mode
 * override in isThemeUnlocked(). This is exactly what isThemeUnlocked()
 * computes when TESTING_MODE_ALL_THEMES_UNLOCKED is false — expressed here
 * via tierMeetsRequirement()/THEME_TIER directly (both untouched by the
 * override) so this coverage survives testing mode being on or off.
 */
function realGatingDecision(id: ThemeId, userTier: PlanTier): boolean {
  return tierMeetsRequirement(userTier, THEME_TIER[id]);
}

describe('the real per-tier gating decision (bypassing testing mode)', () => {
  const casesByPlan: Record<PlanTier, { unlocked: ThemeId[]; locked: ThemeId[] }> = {
    free: {
      unlocked: ['midnightCelestial', 'darAlShams'],
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
        'midnightCelestial',
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
          expect(realGatingDecision(id, plan)).toBe(true);
        });
      }
      for (const id of casesByPlan[plan].locked) {
        it(`locks ${id}`, () => {
          expect(realGatingDecision(id, plan)).toBe(false);
        });
      }
    });
  }
});

describe('isThemeUnlocked — TEMPORARY testing-mode override', () => {
  // TESTING_MODE_ALL_THEMES_UNLOCKED is true in themes.ts right now, so
  // isThemeUnlocked() ignores tier entirely. Delete this describe block
  // (and rely solely on the suite above) once that flag is reverted to
  // false — at which point isThemeUnlocked() and realGatingDecision()
  // become identical again.
  for (const plan of ['free', 'mureed', 'khass'] as PlanTier[]) {
    it(`unlocks every theme on the ${plan} plan while testing mode is on`, () => {
      for (const id of THEME_IDS) {
        expect(isThemeUnlocked(id, plan)).toBe(true);
      }
    });
  }
});

describe('theme picker list', () => {
  it('offers the three colour themes and the two premium themes', () => {
    expect(VISIBLE_THEME_IDS).toEqual([
      'midnightCelestial',
      'darAlShams',
      'laylAlBahr',
      'qamarAlFidda',
      'zumurrudAlMalakut',
    ]);
    expect(pickerThemeIds('darAlShams')).toEqual(VISIBLE_THEME_IDS);
  });

  it('still shows a hidden theme while it is the active one', () => {
    expect(pickerThemeIds('kanzAlAsrar')).toEqual([...VISIBLE_THEME_IDS, 'kanzAlAsrar']);
  });

  it('keeps every hidden theme valid, so existing users are not reset', () => {
    for (const id of THEME_IDS) {
      expect(isValidThemeId(id)).toBe(true);
    }
  });
});

describe('Home style per theme', () => {
  it('keeps the original Midnight Celestial hero exactly', () => {
    const home = getHomeStyle(getTheme('midnightCelestial'));
    expect(home.palette).toEqual({
      midnight: '#061722',
      deepTeal: '#0B2735',
      antiqueGold: '#C5A36A',
      champagne: '#F2D9A0',
      bronze: '#80603D',
      ivory: '#F6EBDD',
      amber: '#D89A4A',
    });
    expect(home).toMatchObject({
      tileShape: 'rounded',
      tileLayout: 'grid',
      capsule: 'pill',
      emblem: 'gold',
    });
  });

  it('gives colour themes their own palette from their colours, with the original shapes', () => {
    const theme = getTheme('laylAlBahr');
    const home = getHomeStyle(theme);
    expect(home.palette.midnight).toBe(theme.colors.bg);
    expect(home.palette.antiqueGold).toBe(theme.colors.gold);
    expect(home).toMatchObject({ tileShape: 'rounded', capsule: 'pill', emblem: 'gold' });
  });

  it('makes the two premium themes differ from each other in shape and emblem, not just colour', () => {
    const qamar = getHomeStyle(getTheme('qamarAlFidda'));
    const zumurrud = getHomeStyle(getTheme('zumurrudAlMalakut'));
    expect(qamar).toMatchObject({
      tileShape: 'facet',
      tileLayout: 'list',
      capsule: 'medallion',
      emblem: 'silver',
    });
    expect(zumurrud).toMatchObject({
      tileShape: 'arch',
      tileLayout: 'grid',
      capsule: 'tablet',
      emblem: 'emerald',
    });
  });
});
