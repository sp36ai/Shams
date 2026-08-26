/**
 * watchJudgment — Pass 2 behavioral audit.
 * --------------------------------------------------------------------------
 * This file exists to FREEZE current watchJudgment.ts behavior as executable
 * fact, per the RKP Watch Engine audit (Pass 1 static/structural, Pass 2
 * deterministic behavioral). It does not assert that the frozen behavior is
 * astrologically "correct" — docs/RKP_RULES_FROM_SARFARAZ.md documents the
 * classical KP horary engine (judgeHorary.ts), not this watch engine, so
 * there is no owner-approved spec to check this scoring model against yet.
 * See Pass 1 findings before changing anything this file locks in:
 *
 *   1. resolveState's retrograde override precedence (below: "state
 *      resolution order").
 *   2. `reversal` vs `state` independence (below: "reversal vs state").
 *   3. The timing multiplier model (below: "timing").
 *
 * A failing test here after a source change to watchJudgment.ts means the
 * SCORING MODEL changed, not necessarily that a bug was fixed — confirm
 * against an owner spec before updating the expectation.
 *
 * Approach: judgeWatchChart(chart, qType) is exercised as a pure function
 * over hand-built WatchChart fixtures, so every contributing factor (ruler
 * dignity, ruler relation, occupancy/aspect witnesses, retrograde, combust,
 * obstruction) can be isolated and driven to a known value — no ephemeris,
 * no real dates. This deliberately bypasses buildWatchChart(): watchChart's
 * own internal consistency (occupancy mirrors real sign placement, aspects
 * mirror the real tables) is already covered by watchChart.test.ts. Here we
 * only care what judgeWatchChart does with a chart shape it is handed.
 */
import { judgeWatchChart, type WatchVerdict } from '@astrology/rkp/watchJudgment';
import type { WatchChart, WatchHouse, WatchPlanet } from '@astrology/rkp/watchChart';
import { dignityOf, type Dignity } from '@astrology/rkp/rules';
import { PLANET_NAME, SIGN_META, type HouseNumber } from '@astrology/rkp/nomenclature';
import { PLANETS, type Planet, type SignIndex } from '@astrology/types/chart';
import { HOUSE_MATRIX, type QuestionType } from '@astrology/kp/rules/houseMatrix';

/* -------------------------------------------------------------------------- */
/*  Fixture builder                                                           */
/* -------------------------------------------------------------------------- */

/** First sign in which `planet` carries `dignity`, by the real dignity table. */
function signWithDignity(planet: Planet, dignity: Dignity): SignIndex {
  for (let sign = 1; sign <= 12; sign += 1) {
    if (dignityOf(planet, sign as SignIndex) === dignity) {
      return sign as SignIndex;
    }
  }
  throw new Error(`fixture error: no sign gives ${planet} dignity ${dignity}`);
}

interface PlanetSpec {
  readonly house: HouseNumber;
  readonly dignity?: Dignity;
  readonly retrograde?: boolean;
  readonly combust?: boolean;
  /** Aspects this planet casts, for obstruction/witness tests. Default none. */
  readonly aspects?: readonly HouseNumber[];
}

function planetAt(planet: Planet, spec: PlanetSpec): WatchPlanet {
  const dignity = spec.dignity ?? 'NeutralSign';
  return {
    planet,
    name: PLANET_NAME[planet],
    sign: signWithDignity(planet, dignity),
    degreeInSign: 15,
    house: spec.house,
    isRetrograde: spec.retrograde ?? false,
    isCombust: spec.combust ?? false,
    dignity,
    aspects: Object.freeze(spec.aspects ?? []),
  };
}

/** A house record fully populated except occupants/aspectedBy, which the test controls. */
function houseAt(
  lagnaSign: SignIndex,
  house: HouseNumber,
  occupants: readonly Planet[],
  aspectedBy: readonly Planet[],
): WatchHouse {
  const sign = (((lagnaSign - 1 + house - 1) % 12) + 1) as SignIndex;
  const meta = SIGN_META[sign];
  return {
    house,
    sign,
    signName: `Burj ${meta.name}`,
    ruler: meta.ruler,
    rulerName: PLANET_NAME[meta.ruler],
    direction: meta.direction,
    polarity: meta.polarity,
    occupants: Object.freeze([...occupants]),
    aspectedBy: Object.freeze([...aspectedBy]),
  };
}

const QUIET_HOUSE: HouseNumber = 3;

/**
 * A chart where nothing touches the target or fulfilment house, the ruler is
 * plainly NeutralSign, and no planet is retrograde/combust. Every scoring
 * factor should read as "no contribution" against this baseline, which is
 * what lets each factor be isolated one at a time in the tests below.
 */
function quietChart(config: {
  readonly qType: QuestionType;
  readonly lagnaSign?: SignIndex;
  readonly lagnaRuler?: Planet;
  readonly overrides?: Partial<Record<Planet, PlanetSpec>>;
  readonly targetOccupants?: readonly Planet[];
  readonly targetAspectedBy?: readonly Planet[];
  readonly fulfilmentOccupants?: readonly Planet[];
  readonly fulfilmentAspectedBy?: readonly Planet[];
  readonly moonHouse?: HouseNumber;
}): WatchChart {
  const lagnaSign = config.lagnaSign ?? 1;
  const lagnaRuler = config.lagnaRuler ?? SIGN_META[lagnaSign].ruler;
  const targetHouse = HOUSE_MATRIX[config.qType].primary as HouseNumber;
  const fulfilmentHouse: HouseNumber = 11;

  const planets = {} as Record<Planet, WatchPlanet>;
  for (const planet of PLANETS) {
    const override = config.overrides?.[planet];
    if (override) {
      planets[planet] = planetAt(planet, override);
    } else if (planet === 'Moon' && config.moonHouse !== undefined) {
      planets[planet] = planetAt(planet, { house: config.moonHouse });
    } else {
      planets[planet] = planetAt(planet, { house: QUIET_HOUSE });
    }
  }

  const houses: WatchHouse[] = [];
  for (let house = 1; house <= 12; house += 1) {
    if (house === targetHouse) {
      houses.push(
        houseAt(
          lagnaSign,
          house as HouseNumber,
          config.targetOccupants ?? [],
          config.targetAspectedBy ?? [],
        ),
      );
    } else if (house === fulfilmentHouse) {
      houses.push(
        houseAt(
          lagnaSign,
          house as HouseNumber,
          config.fulfilmentOccupants ?? [],
          config.fulfilmentAspectedBy ?? [],
        ),
      );
    } else {
      houses.push(houseAt(lagnaSign, house as HouseNumber, [], []));
    }
  }

  return {
    moment: '2026-01-01T00:00:00+00:00',
    window: { bracket: 0, minute: 0, startMinute: 0, endMinute: 5, lagnaSign },
    lagnaSign,
    lagnaSignName: `Burj ${SIGN_META[lagnaSign].name}`,
    lagnaRuler,
    houses: Object.freeze(houses),
    planets: Object.freeze(planets),
  };
}

/** The target ruler for a given question type, under lagnaSign 1 (Hamal). */
function targetRulerFor(qType: QuestionType, lagnaSign: SignIndex = 1): Planet {
  const targetHouse = HOUSE_MATRIX[qType].primary as HouseNumber;
  const sign = (((lagnaSign - 1 + targetHouse - 1) % 12) + 1) as SignIndex;
  return SIGN_META[sign].ruler;
}

/* -------------------------------------------------------------------------- */
/*  Baseline: the quiet chart really is quiet                                 */
/* -------------------------------------------------------------------------- */

describe('quiet baseline', () => {
  it('scores zero and reads UNFORMED when nothing touches the chart', () => {
    const qType: QuestionType = 'career'; // primary house 10
    const chart = quietChart({ qType, lagnaRuler: 'Mercury' });
    // lagnaRuler forced to Mercury: relationBetween(Mercury, Saturn) — career's
    // target ruler under lagna 1 — is Neutral, so step 2 contributes nothing
    // and the chart is genuinely quiet, not quiet by accident.
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(0);
    expect(verdict.state).toBe('UNFORMED');
    expect(verdict.confidence).toBe('UNCERTAIN');
    expect(verdict.obstruction).toBe('None');
    expect(verdict.reversal).toBe('NONE');
  });
});

/* -------------------------------------------------------------------------- */
/*  Factor 1 — strength of the ruler                                          */
/* -------------------------------------------------------------------------- */

describe('factor: ruler dignity', () => {
  const qType: QuestionType = 'finance'; // primary house 2, ruled by Venus at lagna 1

  it('adds +2 when the ruler is strong (Exalted/OwnSign)', () => {
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'Exalted' } },
    });
    expect(judgeWatchChart(chart, qType).score).toBe(2);
  });

  it('subtracts 2 when the ruler is weak (Debilitated/EnemySign)', () => {
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'Debilitated' } },
    });
    expect(judgeWatchChart(chart, qType).score).toBe(-2);
  });

  it('contributes nothing from this factor when the ruler is FriendlySign/NeutralSign', () => {
    const ruler = targetRulerFor(qType);
    const friendly = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'FriendlySign' } },
    });
    const neutral = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'NeutralSign' } },
    });
    expect(judgeWatchChart(friendly, qType).score).toBe(0);
    expect(judgeWatchChart(neutral, qType).score).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Factor 2 — querent's ruler vs. matter's ruler                             */
/* -------------------------------------------------------------------------- */

describe('factor: ruler relation', () => {
  it('adds +2 for Friend and -2 for Enemy relations (direct)', () => {
    const qType: QuestionType = 'career'; // primary house 10 → Saturn at lagna 1
    const ruler = targetRulerFor(qType);
    expect(ruler).toBe('Saturn');

    // relationBetween(lagnaRuler, targetRuler) reads FRIENDSHIP[lagnaRuler][targetRuler]
    // — Venus counts Saturn a friend, Sun counts Saturn an enemy, Jupiter is neutral.
    const friendChart = quietChart({ qType, lagnaRuler: 'Venus' });
    const enemyChart = quietChart({ qType, lagnaRuler: 'Sun' });
    const neutralChart = quietChart({ qType, lagnaRuler: 'Jupiter' });

    expect(judgeWatchChart(friendChart, qType).score).toBe(2);
    expect(judgeWatchChart(friendChart, qType).rulerRelation).toBe('Friend');

    expect(judgeWatchChart(enemyChart, qType).score).toBe(-2);
    expect(judgeWatchChart(enemyChart, qType).rulerRelation).toBe('Enemy');

    expect(judgeWatchChart(neutralChart, qType).score).toBe(0);
    expect(judgeWatchChart(neutralChart, qType).rulerRelation).toBe('Neutral');
  });
});

/* -------------------------------------------------------------------------- */
/*  Factor 3 & 4 — benefic/malefic witnesses on the target and fulfilment     */
/* -------------------------------------------------------------------------- */

describe('factor: witnesses on the target house', () => {
  const qType: QuestionType = 'legal'; // primary house 6, ruled by Mercury under lagna 1
  // Mars (the default lagna ruler under lagna 1) counts Mercury an Enemy,
  // which would silently contaminate every score below by -2. Sun is
  // Neutral to Mercury and isolates the witness factor cleanly.
  const NEUTRAL_LAGNA_RULER: Planet = 'Sun';

  it('adds +2 per benefic occupant or aspect, stacking', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: NEUTRAL_LAGNA_RULER,
      targetOccupants: ['Jupiter'],
      targetAspectedBy: ['Venus'],
    });
    expect(judgeWatchChart(chart, qType).score).toBe(4);
  });

  it('subtracts 2 per malefic occupant or aspect, stacking', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: NEUTRAL_LAGNA_RULER,
      targetOccupants: ['Saturn'],
      targetAspectedBy: ['Mars'],
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(-4);
    // Saturn occupies outranks Mars aspecting in the obstruction precedence.
    expect(verdict.obstruction).toBe('Saturn');
  });

  it('net-zeroes when a benefic and a malefic both witness, but downgrades confidence', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: NEUTRAL_LAGNA_RULER,
      targetOccupants: ['Jupiter', 'Mars'],
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(0);
    expect(verdict.factors.join(' ')).toContain('conflict');
  });
});

describe('factor: witnesses on the fulfilment (11th) house', () => {
  const qType: QuestionType = 'lostitem'; // primary house 2, fulfilment always 11

  it('adds +2 per benefic and subtracts 2 per malefic on the 11th, independent of the target', () => {
    const chart = quietChart({
      qType,
      fulfilmentOccupants: ['Venus'],
    });
    expect(judgeWatchChart(chart, qType).score).toBe(2);

    const blocked = quietChart({
      qType,
      fulfilmentAspectedBy: ['Rahu'],
    });
    expect(judgeWatchChart(blocked, qType).score).toBe(-2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Factor 5 — where the ruler itself has landed                             */
/* -------------------------------------------------------------------------- */

describe('factor: house the ruler has landed in', () => {
  const qType: QuestionType = 'career'; // favorable [6,10,11], denial [5,8,12]
  const ruler = targetRulerFor(qType); // Saturn

  it('adds +1 when the ruler sits in one of the matrix favorable houses', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: 'Jupiter', // neutral to Saturn, isolates this factor
      overrides: { [ruler]: { house: 11 } },
    });
    expect(judgeWatchChart(chart, qType).score).toBe(1);
  });

  it('subtracts 1 when the ruler sits in one of the matrix denial houses', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: 'Jupiter',
      overrides: { [ruler]: { house: 8 } },
    });
    expect(judgeWatchChart(chart, qType).score).toBe(-1);
  });

  it('contributes nothing when the ruler sits outside both lists', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: 'Jupiter',
      overrides: { [ruler]: { house: QUIET_HOUSE } }, // 3 is in neither list
    });
    expect(judgeWatchChart(chart, qType).score).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Factor 6 — retrogression and combustion                                   */
/* -------------------------------------------------------------------------- */

describe('factor: combustion', () => {
  it('subtracts 1 when the ruler is combust, independent of everything else', () => {
    const qType: QuestionType = 'travel'; // denial: none, so this factor is isolable
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      lagnaRuler: 'Mercury', // Neutral to travel's ruler (Jupiter) — isolates this factor
      // House 2, not QUIET_HOUSE(3): travel's favorable list is [3,9,12], so
      // parking the ruler at the usual quiet house would sneak in a +1.
      overrides: { [ruler]: { house: 2, combust: true } },
    });
    expect(judgeWatchChart(chart, qType).score).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Obstruction precedence                                                    */
/* -------------------------------------------------------------------------- */

describe('obstruction precedence', () => {
  const qType: QuestionType = 'business'; // primary house 7

  it('ranks Saturn > Mars > Rahu > Ketu when several occupy the target house', () => {
    const withAll = quietChart({
      qType,
      targetOccupants: ['Ketu', 'Rahu', 'Mars', 'Saturn'],
    });
    expect(judgeWatchChart(withAll, qType).obstruction).toBe('Saturn');

    const withoutSaturn = quietChart({
      qType,
      targetOccupants: ['Ketu', 'Rahu', 'Mars'],
    });
    expect(judgeWatchChart(withoutSaturn, qType).obstruction).toBe('Mars');
  });

  it('prefers an occupant over a mere aspect, regardless of rank', () => {
    const chart = quietChart({
      qType,
      targetOccupants: ['Ketu'], // lowest rank, but present
      targetAspectedBy: ['Saturn'], // highest rank, but only aspecting
    });
    expect(judgeWatchChart(chart, qType).obstruction).toBe('Ketu');
  });

  it('falls back to MoonDisagreement only when no malefic touches the target at all', () => {
    const denying = quietChart({ qType, moonHouse: 8 });
    expect(judgeWatchChart(denying, qType).obstruction).toBe('MoonDisagreement');

    const alsoDenying = quietChart({ qType, moonHouse: 12 });
    expect(judgeWatchChart(alsoDenying, qType).obstruction).toBe('MoonDisagreement');

    const clear = quietChart({ qType, moonHouse: 5 });
    expect(judgeWatchChart(clear, qType).obstruction).toBe('None');
  });

  it('a malefic touching the target always outranks MoonDisagreement', () => {
    const chart = quietChart({
      qType,
      targetAspectedBy: ['Ketu'],
      moonHouse: 8, // would otherwise trigger MoonDisagreement
    });
    expect(judgeWatchChart(chart, qType).obstruction).toBe('Ketu');
  });
});

/* -------------------------------------------------------------------------- */
/*  State resolution order — Pass 1 finding #1, frozen precisely              */
/* -------------------------------------------------------------------------- */

describe('state resolution order (current behavior — see audit finding #1)', () => {
  const qType: QuestionType = 'spiritual'; // primary house 9, denial [6,8]
  const ruler = targetRulerFor(qType);

  it('a hard block (score <= -5) wins even when the ruler is also retrograde', () => {
    // spiritual's ruler at lagna 1 is Jupiter, which no planet regards as an
    // Enemy (see the FRIENDSHIP table — Jupiter has no natural enemies), so
    // the block has to come from dignity + house placement + a malefic
    // witness rather than the relation factor.
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: 6, dignity: 'Debilitated', retrograde: true, combust: true } }, // -2 dignity, -1 denial house(6), -1 combust
      targetOccupants: ['Saturn'], // -2
      lagnaRuler: 'Mercury', // Neutral to Jupiter — isolates the block from the relation factor
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBeLessThanOrEqual(-5);
    expect(verdict.state).toBe('BLOCKED');
  });

  it('retrograde overrides a strongly favorable score (>= 5) to REVERSING, not FULFILLED', () => {
    // This is the behavior flagged in Pass 1 finding #1: a chart that would
    // otherwise read FULFILLED reads REVERSING instead once the ruler is
    // retrograde. Locked in as CURRENT behavior, not endorsed as correct.
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: 5, dignity: 'Exalted', retrograde: true } }, // +2 dignity, +1 favorable house(5)
      targetOccupants: ['Venus'], // +2
      lagnaRuler: 'Sun', // Sun→Jupiter is Friend: +2
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBeGreaterThanOrEqual(5);
    expect(verdict.state).toBe('REVERSING');
  });

  it('retrograde overrides MOVING and UNFORMED too, not only FULFILLED', () => {
    const midScore = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'Exalted', retrograde: true } }, // +2 only
      lagnaRuler: 'Mercury', // Neutral to Jupiter — keeps the score isolated to +2
    });
    const verdict = judgeWatchChart(midScore, qType);
    expect(verdict.score).toBe(2); // MOVING range if not for retrograde
    expect(verdict.state).toBe('REVERSING');

    const zeroScore = quietChart({
      qType,
      lagnaRuler: 'Mercury',
      overrides: { Moon: { house: QUIET_HOUSE, retrograde: true } },
    });
    // Moon is never a matrix ruler (see structural test below), so making
    // Moon retrograde without it being the ruler or lagna ruler does NOT
    // trigger this path — included here only to contrast with the
    // ruler-retrograde case above.
    expect(judgeWatchChart(zeroScore, qType).score).toBe(0);
    expect(judgeWatchChart(zeroScore, qType).state).toBe('UNFORMED');
  });

  it('Saturn obstruction or ruler weakness forces DELAYED ahead of a plain MOVING read', () => {
    const delayedByObstruction = quietChart({
      qType,
      lagnaRuler: 'Mercury', // Neutral to Jupiter — isolates the score to the two factors below
      targetOccupants: ['Saturn'], // -2, obstruction=Saturn
      fulfilmentOccupants: ['Venus', 'Jupiter'], // +4, net score +2 (MOVING range)
    });
    const v = judgeWatchChart(delayedByObstruction, qType);
    expect(v.score).toBe(2);
    expect(v.obstruction).toBe('Saturn');
    expect(v.state).toBe('DELAYED');
  });
});

/* -------------------------------------------------------------------------- */
/*  `reversal` vs. `state` — Pass 1 finding #2                                 */
/* -------------------------------------------------------------------------- */

describe('reversal vs. state independence (current behavior — see audit finding #2)', () => {
  const qType: QuestionType = 'education'; // primary house 4
  const ruler = targetRulerFor(qType);

  it('reversal considers the lagna ruler too, independent of what drives `state`', () => {
    // Ruler itself direct (not retrograde) and strong → state should NOT be
    // REVERSING. But the lagna ruler is retrograde, so `reversal` still reads
    // POSSIBLE. A chart can therefore show state=FULFILLED, reversal=POSSIBLE
    // simultaneously — confirm this combination is reachable, not resolved
    // one way or the other, since no spec defines its intended meaning yet.
    const chart = quietChart({
      qType,
      overrides: {
        [ruler]: { house: 11, dignity: 'Exalted', retrograde: false },
        Saturn: { house: QUIET_HOUSE, retrograde: ruler === 'Saturn' ? false : true },
      },
      targetOccupants: ['Jupiter'],
      targetAspectedBy: ['Venus'],
      lagnaRuler: 'Saturn',
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBeGreaterThanOrEqual(5);
    expect(verdict.state).toBe('FULFILLED');
    expect(chart.planets[chart.lagnaRuler].isRetrograde).toBe(true);
    expect(verdict.reversal).toBe('POSSIBLE');
  });

  it('reversal reads NONE only when neither the ruler nor the lagna ruler is retrograde', () => {
    const chart = quietChart({ qType, lagnaRuler: 'Jupiter' });
    expect(judgeWatchChart(chart, qType).reversal).toBe('NONE');
  });
});

/* -------------------------------------------------------------------------- */
/*  Confidence bands                                                          */
/* -------------------------------------------------------------------------- */

describe('confidence banding', () => {
  const qType: QuestionType = 'marriage'; // primary house 7
  const ruler = targetRulerFor(qType);

  it('bands |score| into VERY_HIGH / HIGH / MODERATE / LOW / UNCERTAIN', () => {
    const cases: Array<[number, WatchVerdict['confidence']]> = [
      [6, 'VERY_HIGH'],
      [4, 'HIGH'],
      [2, 'MODERATE'],
      [1, 'LOW'],
      [0, 'UNCERTAIN'],
    ];
    for (const [target, expected] of cases) {
      // Build a chart landing on `target` purely via benefic occupants (+2
      // each) plus, for odd magnitudes, one favorable-house +1.
      const benefics = Math.floor(Math.abs(target) / 2);
      const occupants: Planet[] = Array.from({ length: benefics }, () => 'Jupiter');
      const chart = quietChart({
        qType,
        targetOccupants: benefics > 0 ? occupants : [],
        overrides:
          Math.abs(target) % 2 === 1
            ? { [ruler]: { house: HOUSE_MATRIX[qType].favorable[0] as HouseNumber } }
            : undefined,
      });
      const verdict = judgeWatchChart(chart, qType);
      expect(verdict.score).toBe(target);
      expect(verdict.confidence).toBe(expected);
    }
  });

  it('downgrades one band when both a benefic and a malefic witness the target', () => {
    // Jupiter (+2) and Mars (-2) both on the target: score net 0 (UNCERTAIN
    // already floor), so use a case where the underlying band is visibly
    // above UNCERTAIN before the downgrade — Saturn's -2 stacked against two
    // benefics nets +2 (MODERATE), which downgrades to LOW.
    const mixedChart = quietChart({
      qType,
      targetOccupants: ['Jupiter'],
      targetAspectedBy: ['Venus', 'Mars'], // +2 +2 -2 = net +2, sawBenefic && sawMalefic
    });
    const verdict = judgeWatchChart(mixedChart, qType);
    expect(verdict.score).toBe(2);
    expect(verdict.confidence).toBe('LOW'); // MODERATE (|2|) downgraded once
  });
});

/* -------------------------------------------------------------------------- */
/*  Timing                                                                    */
/* -------------------------------------------------------------------------- */

describe('timing multipliers (bespoke model — see audit finding #3)', () => {
  const qType: QuestionType = 'health'; // primary house 1

  // health's primary house is 1 — the lagna's own house — so its ruler (Mars,
  // under lagna 1) is also the DEFAULT lagna ruler. Left alone that makes the
  // ruler-relation factor score itself as Friend (+2) via self-relation.
  // Force a Neutral-to-Mars lagna ruler (Mercury) to keep these two tests'
  // scores exactly at the values they assert.
  const NEUTRAL_LAGNA_RULER: Planet = 'Mercury';

  it('is null exactly when the state is UNFORMED', () => {
    const chart = quietChart({ qType, lagnaRuler: NEUTRAL_LAGNA_RULER });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(0);
    expect(verdict.state).toBe('UNFORMED');
    expect(verdict.timing).toBeNull();
  });

  it('uses the ruler base timing unmodified when direct and neither weak nor exalted', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: NEUTRAL_LAGNA_RULER,
      targetOccupants: ['Jupiter', 'Venus'], // score +4, MOVING, non-null timing
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(4);
    expect(verdict.state).toBe('MOVING');
    // Mars base timing: 30–60 days (BASE_TIMING); NeutralSign ruler applies
    // no multiplier.
    expect(verdict.timing).toEqual({ minDays: 30, maxDays: 60 });
  });

  it('stretches timing 1.5x for retrograde and 1.5x again for a weak ruler, compounding', () => {
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'EnemySign', retrograde: true } },
      lagnaRuler: 'Jupiter',
    });
    const verdict = judgeWatchChart(chart, qType);
    // isWeak('EnemySign') is true (rank 1) → x1.5; retrograde → x1.5; 1.5*1.5=2.25
    expect(verdict.timing).toEqual({
      minDays: Math.round(30 * 2.25),
      maxDays: Math.round(60 * 2.25),
    });
  });

  it('compresses timing 0.7x for an exalted ruler', () => {
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: 11, dignity: 'Exalted' } }, // +2 dignity +1 house = +3, DELAYED/MOVING dependent
      targetOccupants: ['Jupiter'],
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.timing).toEqual({
      minDays: Math.round(30 * 0.7),
      maxDays: Math.round(60 * 0.7),
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Shadow nodes — structural guarantee                                       */
/* -------------------------------------------------------------------------- */

describe('Rahu/Ketu structural guarantee', () => {
  it('never rule a sign, so they can never surface as targetRuler or lagnaRuler', () => {
    for (let sign = 1; sign <= 12; sign += 1) {
      const ruler = SIGN_META[sign as SignIndex].ruler;
      expect(ruler).not.toBe('Rahu');
      expect(ruler).not.toBe('Ketu');
    }
  });

  it('can still surface as the obstruction, via occupancy or aspect', () => {
    const qType: QuestionType = 'enemies';
    const rahu = quietChart({ qType, targetOccupants: ['Rahu'] });
    const ketu = quietChart({ qType, targetOccupants: ['Ketu'] });
    expect(judgeWatchChart(rahu, qType).obstruction).toBe('Rahu');
    expect(judgeWatchChart(ketu, qType).obstruction).toBe('Ketu');
  });
});

/* -------------------------------------------------------------------------- */
/*  Determinism                                                               */
/* -------------------------------------------------------------------------- */

describe('determinism', () => {
  it('gives byte-identical verdicts for byte-identical charts, across every question type', () => {
    for (const qType of Object.keys(HOUSE_MATRIX) as QuestionType[]) {
      const chart = quietChart({ qType, targetOccupants: ['Jupiter'], moonHouse: 8 });
      expect(judgeWatchChart(chart, qType)).toEqual(judgeWatchChart(chart, qType));
    }
  });
});
