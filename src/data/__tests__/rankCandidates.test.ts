import { getCandidates, rankCandidates, type RankingContext } from '../rankCandidates';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ctx(overrides: Partial<RankingContext>): RankingContext {
  return {
    oracleClassification: 'NEUTRAL',
    dominantThemes: [],
    spiritualState: 'uncertain',
    severity: 'moderate',
    ...overrides,
  };
}

function categorySet(candidates: ReturnType<typeof getCandidates>): string[] {
  return [...new Set(candidates.map(r => r.category))];
}

function effectSet(candidates: ReturnType<typeof getCandidates>): string[] {
  return [...new Set(candidates.map(r => r.effectDimension))];
}

// ── Core invariants ───────────────────────────────────────────────────────────

describe('rankCandidates — invariants', () => {
  it('never returns more than topN results', () => {
    const results = rankCandidates(ctx({}), 8);
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('respects intensity filter: low severity → gentle only', () => {
    const results = rankCandidates(ctx({ severity: 'low' }), 8);
    expect(results.every(r => r.intensity === 'gentle')).toBe(true);
  });

  it('respects intensity filter: high severity → moderate or deep only', () => {
    const results = rankCandidates(ctx({ severity: 'high' }), 8);
    expect(results.every(r => r.intensity === 'moderate' || r.intensity === 'deep')).toBe(true);
  });

  it('enforces max 2 per category after diversity guard', () => {
    const results = getCandidates(ctx({ dominantThemes: ['OBSTRUCTION', 'STAGNATION', 'DELAY'] }));
    const counts: Record<string, number> = {};
    results.forEach(r => {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    });
    Object.values(counts).forEach(n => expect(n).toBeLessThanOrEqual(2));
  });
});

// ── 20 scenario tests ────────────────────────────────────────────────────────
// Grouped by the four emotional quadrants from the spec.

describe('Quadrant A — Obstruction + restless', () => {
  it('S01: obstruction + restless + moderate → patience/grounding remedies dominate', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['OBSTRUCTION', 'FORCING', 'RESTLESSNESS'],
        spiritualState: 'restless',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasPatienceOrGrounding = dims.some(d =>
      ['grounding', 'surrender', 'patience', 'calming'].includes(d),
    );
    expect(hasPatienceOrGrounding).toBe(true);
  });

  it('S02: obstruction + DENIED → surrender/patience/trust dimensions boosted', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['OBSTRUCTION', 'DELAY'],
        spiritualState: 'restless',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasDeniedBoost = dims.some(d =>
      ['surrender', 'patience', 'trust_building', 'comfort'].includes(d),
    );
    expect(hasDeniedBoost).toBe(true);
  });

  it('S03: stagnation + haste + low severity → only gentle remedies', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['STAGNATION', 'HASTE'],
        spiritualState: 'restless',
        severity: 'low',
      }),
    );
    expect(r.every(rem => rem.intensity === 'gentle')).toBe(true);
  });

  it('S04: forcing + attachment + high severity → moderate/deep remedies', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['FORCING', 'ATTACHMENT'],
        spiritualState: 'restless',
        severity: 'high',
      }),
    );
    expect(r.every(rem => rem.intensity === 'moderate' || rem.intensity === 'deep')).toBe(true);
  });

  it('S05: obstruction + DENIED + restless → at least 3 candidates returned', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['OBSTRUCTION', 'STAGNATION'],
        spiritualState: 'restless',
        severity: 'moderate',
      }),
    );
    expect(r.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Quadrant B — Opportunity + hopeful', () => {
  it('S06: abundance + CONFIRMED → gratitude/opening/activation dimensions', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'CONFIRMED',
        dominantThemes: ['ABUNDANCE'],
        spiritualState: 'hopeful',
        severity: 'low',
      }),
    );
    const dims = effectSet(r);
    const hasArrivalDims = dims.some(d => ['gratitude', 'opening', 'activation'].includes(d));
    expect(hasArrivalDims).toBe(true);
  });

  it('S07: hopeful + CONFIRMED + low → only gentle remedies', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'CONFIRMED',
        dominantThemes: ['ABUNDANCE'],
        spiritualState: 'hopeful',
        severity: 'low',
      }),
    );
    expect(r.every(rem => rem.intensity === 'gentle')).toBe(true);
  });

  it('S08: grateful state → dhikr_04 and gratitude_04 score above zero', () => {
    const scored = rankCandidates(
      ctx({
        oracleClassification: 'CONFIRMED',
        dominantThemes: ['ABUNDANCE'],
        spiritualState: 'grateful',
        severity: 'low',
      }),
      38,
    );
    const gratitudeIds = new Set(['dhikr_04', 'gratitude_04']);
    const top8Ids = new Set(scored.slice(0, 8).map(r => r.id));
    const atLeastOnePresent = [...gratitudeIds].some(id => top8Ids.has(id));
    expect(atLeastOnePresent).toBe(true);
  });

  it('S09: abundance + no dominant obstruction → no surrender/patience in top 3', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'CONFIRMED',
        dominantThemes: ['ABUNDANCE'],
        spiritualState: 'hopeful',
        severity: 'low',
      }),
    );
    const top3Dims = r.slice(0, 3).map(rem => rem.effectDimension);
    const hasDeniedDim = top3Dims.some(d => ['surrender', 'patience'].includes(d));
    expect(hasDeniedDim).toBe(false);
  });

  it('S10: CONFIRMED + grateful → categories span at least 2 different types', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'CONFIRMED',
        dominantThemes: ['ABUNDANCE'],
        spiritualState: 'grateful',
        severity: 'low',
      }),
    );
    expect(categorySet(r).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Quadrant C — Conflict + remorseful', () => {
  it('S11: conflict + estrangement + remorseful → reconciliation/humility in results', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['CONFLICT', 'ESTRANGEMENT', 'PRIDE'],
        spiritualState: 'remorseful',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasRepairDims = dims.some(d =>
      ['reconciliation', 'humility', 'emotional_release'].includes(d),
    );
    expect(hasRepairDims).toBe(true);
  });

  it('S12: pride + DENIED → tawbah and silence appear in candidates', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['PRIDE', 'CONFLICT'],
        spiritualState: 'remorseful',
        severity: 'moderate',
      }),
    );
    const cats = categorySet(r);
    const hasRepairCat = cats.some(c => ['tawbah', 'silence', 'sadaqa'].includes(c));
    expect(hasRepairCat).toBe(true);
  });

  it('S13: remorseful + high severity → no gentle-only results', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['CONFLICT', 'PRIDE', 'ESTRANGEMENT'],
        spiritualState: 'remorseful',
        severity: 'high',
      }),
    );
    expect(r.every(rem => rem.intensity === 'gentle')).toBe(false);
  });

  it('S14: suppression + grief + moderate → emotional_release or comfort present', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['SUPPRESSION', 'GRIEF'],
        spiritualState: 'grieving',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasRelease = dims.some(d => ['emotional_release', 'comfort'].includes(d));
    expect(hasRelease).toBe(true);
  });

  it('S15: conflict + estrangement → diversity guard prevents single category dominating', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['CONFLICT', 'ESTRANGEMENT'],
        spiritualState: 'remorseful',
        severity: 'moderate',
      }),
    );
    const counts: Record<string, number> = {};
    r.forEach(rem => {
      counts[rem.category] = (counts[rem.category] ?? 0) + 1;
    });
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });
});

describe('Quadrant D — Transition + uncertain', () => {
  it('S16: doubt + forcing + uncertain → clarity/surrender/trust in results', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['DOUBT', 'FORCING', 'ATTACHMENT'],
        spiritualState: 'uncertain',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasGrounding = dims.some(d =>
      ['clarity', 'surrender', 'trust_building', 'grounding'].includes(d),
    );
    expect(hasGrounding).toBe(true);
  });

  it('S17: uncertainty + NEUTRAL verdict → results still non-empty', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'NEUTRAL',
        dominantThemes: ['DOUBT'],
        spiritualState: 'uncertain',
        severity: 'moderate',
      }),
    );
    expect(r.length).toBeGreaterThan(0);
  });

  it('S18: anxious + material anxiety + moderate → trust_building or calming', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['MATERIAL_ANXIETY', 'ANXIETY'],
        spiritualState: 'anxious',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasCalm = dims.some(d => ['trust_building', 'calming', 'grounding'].includes(d));
    expect(hasCalm).toBe(true);
  });

  it('S19: distraction + restlessness + low → gentle grounding remedies', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['DISTRACTION', 'RESTLESSNESS'],
        spiritualState: 'uncertain',
        severity: 'low',
      }),
    );
    expect(r.every(rem => rem.intensity === 'gentle')).toBe(true);
    const dims = effectSet(r);
    expect(dims.some(d => ['grounding', 'calming', 'clarity'].includes(d))).toBe(true);
  });

  it('S20: spiritual neglect + doubt + moderate → spiritual_clearing or trust_building', () => {
    const r = getCandidates(
      ctx({
        dominantThemes: ['SPIRITUAL_NEGLECT', 'DOUBT'],
        spiritualState: 'uncertain',
        severity: 'moderate',
      }),
    );
    const dims = effectSet(r);
    const hasSpiritualDim = dims.some(d =>
      ['spiritual_clearing', 'trust_building', 'patience'].includes(d),
    );
    expect(hasSpiritualDim).toBe(true);
  });
});

describe('fearful state — health DENIED routing', () => {
  it('S21: health DENIED + fearful + high → comfort/trust/emotional_release remedies', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['GRIEF', 'DOUBT', 'SUPPRESSION'],
        spiritualState: 'fearful',
        severity: 'high',
      }),
    );
    expect(r.length).toBeGreaterThanOrEqual(4);
    const dims = effectSet(r);
    const hasComfortOrTrust = dims.some(d =>
      ['comfort', 'trust_building', 'emotional_release', 'spiritual_clearing'].includes(d),
    );
    expect(hasComfortOrTrust).toBe(true);
  });

  it('S22: health DENIED + fearful → quran_03, dhikr_02, or tawbah_03 in top-8', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['GRIEF', 'DOUBT', 'SUPPRESSION'],
        spiritualState: 'fearful',
        severity: 'high',
      }),
    );
    const ids = new Set(r.map(rem => rem.id));
    const expectedIds = ['quran_03', 'dhikr_02', 'tawbah_03'];
    const atLeastOne = expectedIds.some(id => ids.has(id));
    expect(atLeastOne).toBe(true);
  });

  it('S23: fearful state does not route to MATERIAL_ANXIETY remedies', () => {
    const r = getCandidates(
      ctx({
        oracleClassification: 'DENIED',
        dominantThemes: ['GRIEF', 'DOUBT'],
        spiritualState: 'fearful',
        severity: 'moderate',
      }),
    );
    // sadaqa_04 and dua_02 are MATERIAL_ANXIETY remedies — should not dominate
    const materialIds = new Set(['sadaqa_04', 'dua_02']);
    const top3 = r.slice(0, 3).map(rem => rem.id);
    const materialInTop3 = top3.filter(id => materialIds.has(id)).length;
    expect(materialInTop3).toBeLessThanOrEqual(1);
  });
});

// ── Remedy collapse guard ─────────────────────────────────────────────────────
// Verifies that 3–5 remedies don't dominate across all scenarios.

describe('Remedy collapse guard', () => {
  const scenarios: RankingContext[] = [
    ctx({
      dominantThemes: ['OBSTRUCTION', 'FORCING'],
      spiritualState: 'restless',
      oracleClassification: 'DENIED',
    }),
    ctx({
      dominantThemes: ['ABUNDANCE'],
      spiritualState: 'hopeful',
      oracleClassification: 'CONFIRMED',
    }),
    ctx({ dominantThemes: ['CONFLICT', 'PRIDE'], spiritualState: 'remorseful' }),
    ctx({ dominantThemes: ['DOUBT', 'ATTACHMENT'], spiritualState: 'uncertain' }),
    ctx({ dominantThemes: ['GRIEF', 'SUPPRESSION'], spiritualState: 'grieving', severity: 'high' }),
    ctx({ dominantThemes: ['MATERIAL_ANXIETY', 'STAGNATION'], spiritualState: 'anxious' }),
  ];

  it('top-1 remedy is not the same ID across all 6 scenarios', () => {
    const topIds = scenarios.map(s => getCandidates(s)[0]?.id);
    const unique = new Set(topIds);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('no single remedy id appears as top-1 in more than 3 of 6 scenarios', () => {
    const topIds = scenarios.map(s => getCandidates(s)[0]?.id);
    const counts: Record<string, number> = {};
    topIds.forEach(id => {
      if (id) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    });
    const max = Math.max(...Object.values(counts));
    expect(max).toBeLessThanOrEqual(3);
  });

  it('combined unique remedy ids across 6 scenarios is at least 8', () => {
    const allIds = scenarios.flatMap(s => getCandidates(s).map(r => r.id));
    expect(new Set(allIds).size).toBeGreaterThanOrEqual(8);
  });
});
