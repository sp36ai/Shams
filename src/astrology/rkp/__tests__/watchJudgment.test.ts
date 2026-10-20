/**
 * watchJudgment — Pass 2 behavioral audit.
 * --------------------------------------------------------------------------
 * This file exists to FREEZE current watchJudgment.ts behavior as executable
 * fact, per the RKP Watch Engine audit (Pass 1 static/structural, Pass 2
 * deterministic behavioral). It does not assert that the frozen behavior is
 * astrologically "correct" — docs/RKP_RULES_FROM_SARFARAZ.md documents the
 * classical KP horary engine (judgeHorary.ts), not this watch engine, so
 * there was no owner-approved spec to check this scoring model against. The
 * owner has since confirmed a set of rules (docs/rkp-audit/RKP_RULE_LEDGER.md,
 * OD-002); tests marked "OD-002" below encode those. Rules the owner has NOT
 * yet settled are still frozen as current behaviour and say so.
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
import {
  buildWatchChart,
  type WatchChart,
  type WatchHouse,
  type WatchPlanet,
} from '@astrology/rkp/watchChart';
import { dignityOf, type Dignity } from '@astrology/rkp/rules';
import { PLANET_NAME, SIGN_META, gharLabel, type HouseNumber } from '@astrology/rkp/nomenclature';
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
  /** Pin the planet to a real sign; dignity is then read from the real table. */
  readonly sign?: SignIndex;
  readonly dignity?: Dignity;
  readonly retrograde?: boolean;
  readonly combust?: boolean;
  /** Aspects this planet casts, for obstruction/witness tests. Default none. */
  readonly aspects?: readonly HouseNumber[];
}

function planetAt(planet: Planet, spec: PlanetSpec): WatchPlanet {
  const dignity =
    spec.dignity ?? (spec.sign !== undefined ? dignityOf(planet, spec.sign) : 'NeutralSign');
  return {
    planet,
    name: PLANET_NAME[planet],
    sign: spec.sign ?? signWithDignity(planet, dignity),
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

  it('OD-002: friendly sign adds +1, neutral 0, enemy sign subtracts 1', () => {
    const ruler = targetRulerFor(qType);
    const scoreFor = (dignity: Dignity): number =>
      judgeWatchChart(
        quietChart({ qType, overrides: { [ruler]: { house: QUIET_HOUSE, dignity } } }),
        qType,
      ).score;
    expect(scoreFor('FriendlySign')).toBe(1);
    expect(scoreFor('NeutralSign')).toBe(0);
    expect(scoreFor('EnemySign')).toBe(-1);
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

  it('OD-002: a malefic sitting on the Ghar subtracts 2, one only aspecting it subtracts 1', () => {
    const chart = quietChart({
      qType,
      lagnaRuler: NEUTRAL_LAGNA_RULER,
      targetOccupants: ['Saturn'],
      targetAspectedBy: ['Mars'],
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBe(-3); // Saturn sits -2, Mars aspects -1
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

  it('OD-002: +2 per benefic, -2 per malefic sitting, -1 per malefic aspecting, independent of the target', () => {
    const chart = quietChart({
      qType,
      fulfilmentOccupants: ['Venus'],
    });
    expect(judgeWatchChart(chart, qType).score).toBe(2);

    const aspected = quietChart({
      qType,
      fulfilmentAspectedBy: ['Rahu'],
    });
    expect(judgeWatchChart(aspected, qType).score).toBe(-1);

    const sitting = quietChart({
      qType,
      fulfilmentOccupants: ['Rahu'],
    });
    expect(judgeWatchChart(sitting, qType).score).toBe(-2);
  });
});

describe('OD-002: witness weights', () => {
  it('a benefic that is exalted or in its own sign scores +3 sitting or aspecting, either Ghar', () => {
    const qType: QuestionType = 'legal';
    const exalted = quietChart({
      qType,
      lagnaRuler: 'Sun',
      overrides: { Jupiter: { house: 6, dignity: 'Exalted' } },
      targetOccupants: ['Jupiter'],
    });
    expect(judgeWatchChart(exalted, qType).score).toBe(3);

    const ownAspect = quietChart({
      qType,
      lagnaRuler: 'Sun',
      overrides: { Venus: { house: 12, dignity: 'OwnSign' } },
      targetAspectedBy: ['Venus'],
    });
    expect(judgeWatchChart(ownAspect, qType).score).toBe(3);

    const eleventh = quietChart({
      qType,
      lagnaRuler: 'Sun',
      overrides: { Jupiter: { house: 11, dignity: 'Exalted' } },
      fulfilmentOccupants: ['Jupiter'],
    });
    expect(judgeWatchChart(eleventh, qType).score).toBe(3);
  });

  it('a malefic in its own or exalted sign, sitting in the 3rd/6th/10th/11th Ghar, scores +2 for any question', () => {
    // 6th Ghar is legal's target; the 11th is always the fulfilment Ghar.
    const legal = quietChart({
      qType: 'legal',
      lagnaRuler: 'Sun',
      overrides: { Mars: { house: 6, dignity: 'OwnSign' } },
      targetOccupants: ['Mars'],
    });
    expect(judgeWatchChart(legal, 'legal').score).toBe(2);

    // The owner's own example: Mirrikh in its own sign Hamal in the 11th Ghar.
    const marriage = quietChart({
      qType: 'marriage',
      lagnaRuler: 'Mars', // Mars→Venus (marriage's ruler) is Neutral — keeps the relation factor at 0
      overrides: { Mars: { house: 11, dignity: 'OwnSign' } },
      fulfilmentOccupants: ['Mars'],
    });
    expect(judgeWatchChart(marriage, 'marriage').score).toBe(2);
  });

  it('the same malefic sitting in a Ghar that is not 3rd/6th/10th/11th still scores -2', () => {
    const chart = quietChart({
      qType: 'marriage', // target 7th
      lagnaRuler: 'Mars', // Neutral to Venus, the 7th's ruler
      overrides: { Mars: { house: 7, dignity: 'OwnSign' } },
      targetOccupants: ['Mars'],
    });
    expect(judgeWatchChart(chart, 'marriage').score).toBe(-2);
  });

  it('PENDING owner (S4 cases B and C): an ordinary malefic sitting in a growing Ghar is still -2 today', () => {
    // The owner's text says 0 for career/legal/business/finance, but his two
    // statements differ on enemy-sign and debilitated malefics (ledger OD-002).
    // Until he settles it this is frozen as the current behaviour.
    const chart = quietChart({
      qType: 'legal',
      lagnaRuler: 'Sun',
      targetOccupants: ['Saturn'], // NeutralSign
    });
    expect(judgeWatchChart(chart, 'legal').score).toBe(-2);
  });

  it('a malefic scored as helping (own sign, growing Ghar) is not named as the obstruction', () => {
    const chart = quietChart({
      qType: 'legal',
      lagnaRuler: 'Sun',
      overrides: { Mars: { house: 6, dignity: 'OwnSign' } },
      targetOccupants: ['Mars'],
    });
    const verdict = judgeWatchChart(chart, 'legal');
    expect(verdict.score).toBe(2);
    expect(verdict.obstruction).toBe('None');
  });

  it('travel is denied by the 4th and 8th Ghars (owner decision OD-002, S6)', () => {
    expect(HOUSE_MATRIX.travel.denial).toEqual([4, 8]);
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

  it('a hard block (score <= -6) wins even when the ruler is also retrograde', () => {
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
    expect(verdict.score).toBeLessThanOrEqual(-6);
    expect(verdict.state).toBe('BLOCKED');
  });

  it('OD-002: a score of +4 or more is FULFILLED even when the ruler is retrograde', () => {
    // Superseded Pass 1 finding #1: retrograde used to override a favourable
    // score. The owner's ladder checks the score first.
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: 5, dignity: 'Exalted', retrograde: true } }, // +2 dignity, +1 favorable house(5)
      targetOccupants: ['Venus'], // +2
      lagnaRuler: 'Sun', // Sun→Jupiter is Friend: +2
    });
    const verdict = judgeWatchChart(chart, qType);
    expect(verdict.score).toBeGreaterThanOrEqual(4);
    expect(verdict.state).toBe('FULFILLED');
  });

  it('OD-002: +4 is FULFILLED, +3 is MOVING', () => {
    const at = (benefics: number) =>
      judgeWatchChart(
        quietChart({
          qType,
          lagnaRuler: 'Mercury',
          targetOccupants: Array.from({ length: benefics }, () => 'Venus' as Planet),
        }),
        qType,
      );
    expect(at(2).score).toBe(4);
    expect(at(2).state).toBe('FULFILLED');
    expect(at(1).state).toBe('MOVING');
  });

  it('OD-002: -6 is BLOCKED, -5 is not', () => {
    const legal: QuestionType = 'legal'; // target 6th (a growing Ghar), ruler Mercury
    const build = (malefics: Planet[]) =>
      judgeWatchChart(
        quietChart({ qType: legal, lagnaRuler: 'Sun', targetOccupants: malefics }),
        legal,
      );
    const blocked = build(['Saturn', 'Mars', 'Rahu']); // -2 each
    expect(blocked.score).toBe(-6);
    expect(blocked.state).toBe('BLOCKED');

    const near = judgeWatchChart(
      quietChart({
        qType: legal,
        lagnaRuler: 'Sun',
        targetOccupants: ['Saturn', 'Mars'],
        targetAspectedBy: ['Rahu', 'Ketu'], // -1 each
      }),
      legal,
    );
    expect(near.score).toBe(-6);
    const fiveDown = judgeWatchChart(
      quietChart({
        qType: legal,
        lagnaRuler: 'Sun',
        targetOccupants: ['Saturn', 'Mars'],
        targetAspectedBy: ['Rahu'],
      }),
      legal,
    );
    expect(fiveDown.score).toBe(-5);
    expect(fiveDown.state).not.toBe('BLOCKED');
  });

  it('OD-002: at -6 or below a strong benefic on the matter caps the answer at DELAYED', () => {
    const legal: QuestionType = 'legal';
    const chart = quietChart({
      qType: legal,
      lagnaRuler: 'Sun',
      overrides: {
        Jupiter: { house: 6, dignity: 'Exalted' },
        [targetRulerFor(legal)]: { house: QUIET_HOUSE, dignity: 'Debilitated' },
      },
      targetOccupants: ['Saturn', 'Mars', 'Rahu', 'Ketu', 'Jupiter'], // -8 +3, ruler -2
    });
    const verdict = judgeWatchChart(chart, legal);
    expect(verdict.score).toBeLessThanOrEqual(-6);
    expect(verdict.state).toBe('DELAYED');
  });

  it('OD-002: a Zuhal in its own or exalted sign on the matter does not force DELAYED', () => {
    const career: QuestionType = 'career'; // target 10th, ruled by Saturn under lagna 1
    const ownZuhal = judgeWatchChart(
      quietChart({
        qType: career,
        lagnaRuler: 'Venus',
        overrides: { Saturn: { house: 10, dignity: 'OwnSign' } },
        targetOccupants: ['Saturn'],
      }),
      career,
    );
    expect(ownZuhal.state).not.toBe('DELAYED');

    const plainZuhal = judgeWatchChart(
      quietChart({
        qType: career,
        lagnaRuler: 'Venus',
        overrides: { Saturn: { house: 10, dignity: 'FriendlySign' } },
        targetOccupants: ['Saturn'],
      }),
      career,
    );
    expect(plainZuhal.state).toBe('DELAYED');
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
      targetAspectedBy: ['Venus', 'Mars'], // +2 +2 -1 = net +3, sawBenefic && sawMalefic
    });
    const verdict = judgeWatchChart(mixedChart, qType);
    expect(verdict.score).toBe(3); // Jupiter +2, Venus +2, Mars aspecting -1
    expect(verdict.confidence).toBe('LOW'); // MODERATE (|3|) downgraded once
  });
});

/* -------------------------------------------------------------------------- */
/*  Timing                                                                    */
/* -------------------------------------------------------------------------- */

/** Owner decision OD-002 (4.1): movable ×0.8, dual ×1.0, fixed ×1.25. */
function modalityFactor(sign: SignIndex): number {
  if ([1, 4, 7, 10].includes(sign)) {
    return 0.8;
  }
  if ([2, 5, 8, 11].includes(sign)) {
    return 1.25;
  }
  return 1;
}

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
    expect(verdict.state).toBe('FULFILLED');
    // Mars base timing: 30–60 days (BASE_TIMING); a NeutralSign ruler applies
    // no dignity multiplier, only the sign-modality one.
    const m = modalityFactor(chart.planets[targetRulerFor(qType)].sign);
    expect(verdict.timing).toEqual({ minDays: Math.round(30 * m), maxDays: Math.round(60 * m) });
  });

  it("OD-002: sign modality — movable ×0.8, dual ×1.0, fixed ×1.25 on the ruler's sign", () => {
    const spiritual: QuestionType = 'spiritual'; // target 9th, ruled by Jupiter under lagna 1
    const timingWhen = (sign: SignIndex) =>
      judgeWatchChart(
        quietChart({
          qType: spiritual,
          lagnaRuler: 'Mercury',
          overrides: { Jupiter: { house: QUIET_HOUSE, sign } },
          targetOccupants: ['Venus'],
        }),
        spiritual,
      ).timing;
    // Jupiter base 60–90. Aries (movable, friendly): ×0.8. Leo (fixed, friendly):
    // ×1.25. Sagittarius (dual, own sign): ×1.0.
    expect(timingWhen(1)).toEqual({ minDays: 48, maxDays: 72 });
    expect(timingWhen(5)).toEqual({ minDays: 75, maxDays: 113 });
    expect(timingWhen(9)).toEqual({ minDays: 60, maxDays: 90 });
  });

  it('stretches timing 1.5x for retrograde and 1.5x again for a weak ruler, compounding', () => {
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      overrides: { [ruler]: { house: QUIET_HOUSE, dignity: 'EnemySign', retrograde: true } },
      lagnaRuler: 'Jupiter',
    });
    const verdict = judgeWatchChart(chart, qType);
    // isWeak('EnemySign') is true (rank 1) → x1.5; retrograde → x1.5; 1.5*1.5=2.25;
    // then the sign-modality factor of the sign the fixture put Mars in.
    const m = modalityFactor(chart.planets[ruler].sign);
    expect(verdict.timing).toEqual({
      minDays: Math.round(30 * 1.5 * 1.5 * m),
      maxDays: Math.round(60 * 1.5 * 1.5 * m),
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
    const m = modalityFactor(chart.planets[ruler].sign);
    expect(verdict.timing).toEqual({
      minDays: Math.round(30 * 0.7 * m),
      maxDays: Math.round(60 * 0.7 * m),
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Shadow nodes — structural guarantee                                       */
/* -------------------------------------------------------------------------- */

describe('Ghar ordinals in factor prose', () => {
  // Regression: the factor strings used to interpolate `${house}th Ghar`
  // directly, so every question whose primary house is 1, 2 or 3 rendered
  // "1th Ghar" / "2th Ghar" / "3th Ghar" — both here and in RkpWatchCard.
  // gharLabel() already existed in nomenclature.ts to solve exactly this and
  // was simply not being called. These assertions cover the wording only;
  // no score is asserted, so they cannot mask a scoring-model change.
  // Matches only the malformed forms. "11th"/"12th" Ghar are correct English
  // and must not trip this, so the digit is anchored on both sides.
  const MALFORMED = /(?<!\d)[123]th Ghar/;

  it('renders 1st/2nd/3rd correctly for every reachable primary house', () => {
    // health + general -> primary 1, finance + lostitem -> primary 2: the
    // reachable cases the old interpolation got wrong. The ruler is driven
    // Exalted and into a favorable house so the factors that name a Ghar
    // actually fire.
    for (const qType of ['health', 'general', 'finance', 'lostitem'] as QuestionType[]) {
      const ruler = targetRulerFor(qType);
      const chart = quietChart({
        qType,
        lagnaRuler: 'Jupiter',
        overrides: {
          [ruler]: {
            dignity: 'Exalted' as Dignity,
            house: HOUSE_MATRIX[qType].favorable[0] as HouseNumber,
          },
        },
      });
      const factors = judgeWatchChart(chart, qType).factors;
      expect(factors.some(f => f.includes('Ghar'))).toBe(true); // guard: not vacuous
      for (const factor of factors) {
        expect(factor).not.toMatch(MALFORMED);
      }
    }
  });

  it('names the target Ghar with the shared ordinal helper', () => {
    const qType: QuestionType = 'health'; // primary house 1
    const ruler = targetRulerFor(qType);
    const chart = quietChart({
      qType,
      lagnaRuler: 'Jupiter',
      overrides: { [ruler]: { dignity: 'Exalted' as Dignity } },
    });
    const factors = judgeWatchChart(chart, qType).factors;
    expect(factors.some(f => f.includes(gharLabel(1)))).toBe(true);
    expect(factors.some(f => f.includes('1th Ghar'))).toBe(false);
  });
});

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

describe('one planet ruling both the querent and the matter (owner decision 2026-10-08)', () => {
  // Every 1st-Ghar question has the same ruler on both sides. Each 5-minute
  // watch window carries its own lagna, so sample all twelve.
  const moments = Array.from({ length: 12 }, (_, w) =>
    new Date(Date.UTC(2026, 9, 8, 7, w * 5 + 2)).toISOString(),
  );

  it('neither scores the relation nor states it', () => {
    for (const moment of moments) {
      const verdict = judgeWatchChart(buildWatchChart(moment), 'general');
      expect(verdict.targetRuler).toBe(verdict.lagnaRuler);
      expect(verdict.factors.some(f => f.includes('(your own ruler) counts'))).toBe(false);
    }
  });

  it('still judges the relation when the two rulers differ', () => {
    const judged = moments
      .map(moment => judgeWatchChart(buildWatchChart(moment), 'marriage'))
      .filter(v => v.targetRuler !== v.lagnaRuler && v.rulerRelation !== 'Neutral');
    expect(judged.length).toBeGreaterThan(0);
    for (const verdict of judged) {
      expect(verdict.factors.some(f => f.includes('(your own ruler) counts'))).toBe(true);
    }
  });
});
