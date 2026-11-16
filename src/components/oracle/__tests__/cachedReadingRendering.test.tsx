/**
 * A reading from the cache must open, whatever shape it is in.
 *
 * These cards do not only render fresh server responses. Both the readings
 * archive and the Reading threads persist a verdict and its composition to
 * MMKV, and a cache written by an older build outlives that build. Every
 * dereference that assumed the current shape — `verdict.confidence.replace()`,
 * `HOUSE_META[targetHouse].bait`, `protocol.steps.length`, an UNDEFINED
 * narration slipping past a `!== null` check — was a render-phase throw over
 * stored data. That is the worst kind: it repeats on every launch, because the
 * same cache loads again, so the screen is not merely broken once but
 * permanently unopenable until the app's data is cleared.
 *
 * So the contract is: render what can be described, say nothing false about
 * what cannot, and never throw. The malformed inputs below are deliberately
 * cast — that is the point, since the type system is exactly what a stale
 * cache does not honour.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { buildWatchChart } from '@astrology/rkp/watchChart';
import { judgeWatchChart } from '@astrology/rkp/watchJudgment';
import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import RkpWatchCard from '../RkpWatchCard';
import RemedyProtocolCard from '../RemedyProtocolCard';
import VerdictSeal from '../VerdictSeal';
import type { WatchOracleComposition } from '../../../types/watchOracle';

const MOMENT = '2026-08-08T11:13:00+05:30';
const WINDOW = { startMinute: 43, endMinute: 48, minute: 43 };

function wrap(ui: React.ReactElement): Promise<ReturnType<typeof render>> {
  // render() resolves asynchronously in this project's RTL/React pairing —
  // renderScreen (src/test-utils) awaits it for the same reason.
  return render(
    <ThemeProvider>
      <I18nProvider initialLang="en">{ui}</I18nProvider>
    </ThemeProvider>,
  );
}

function freshVerdict() {
  return judgeWatchChart(buildWatchChart(MOMENT), 'legal');
}

function composition(): WatchOracleComposition {
  return {
    narration: null,
    diagnosis: {
      outcome: 'CONDITIONAL',
      primaryPattern: 'OBSTRUCTION',
      secondaryPatterns: [],
      timingPosture: 'WAIT',
      confidence: 0.7,
      obstructingAgent: 'Zuhal',
      rationale: ['Target ruler is retrograde.'],
    },
    protocol: {
      interventionRequired: false,
      guidance: 'Let the window arrive.',
      steps: [],
      rationale: [],
    },
  } as WatchOracleComposition;
}

describe('RkpWatchCard with a degraded cached verdict', () => {
  it('renders a verdict whose confidence was never stored', async () => {
    const verdict = { ...freshVerdict(), confidence: undefined } as never;
    await expect(
      wrap(
        <RkpWatchCard
          window={WINDOW}
          lagnaSignName="Burj Jauza"
          lagnaRulerName="Utarid"
          verdict={verdict}
          directionalFocus={null}
        />,
      ),
    ).resolves.toBeDefined();
  });

  it('renders a verdict naming a house it has no description for', async () => {
    const verdict = { ...freshVerdict(), targetHouse: 99 } as never;
    const { queryByText } = await wrap(
      <RkpWatchCard
        window={WINDOW}
        lagnaSignName="Burj Jauza"
        lagnaRulerName="Utarid"
        verdict={verdict}
        directionalFocus={null}
      />,
    );
    // The row it cannot describe is omitted, not filled with a guess.
    expect(queryByText(/99th Ghar/)).toBeNull();
  });

  it('renders a verdict with no factors and an unknown state', async () => {
    const verdict = {
      ...freshVerdict(),
      state: 'SOMETHING_NEW',
      factors: undefined,
      rulerRelation: undefined,
    } as never;
    await expect(
      wrap(
        <RkpWatchCard
          window={WINDOW}
          lagnaSignName="Burj Jauza"
          lagnaRulerName="Utarid"
          verdict={verdict}
          directionalFocus={null}
        />,
      ),
    ).resolves.toBeDefined();
  });
});

describe('RemedyProtocolCard with a degraded cached composition', () => {
  it('renders when narration is undefined rather than null', async () => {
    // The field is typed `| null`, so `narration !== null` looked sufficient.
    // A cache that simply omitted the key made it undefined, which passed that
    // check and then threw on `.rkp_finding`.
    const degraded = { ...composition(), narration: undefined } as never;
    await expect(wrap(<RemedyProtocolCard composition={degraded} />)).resolves.toBeDefined();
  });

  it('renders when the protocol has no steps array at all', async () => {
    const degraded = {
      ...composition(),
      protocol: { interventionRequired: true, guidance: null },
    } as never;
    await expect(wrap(<RemedyProtocolCard composition={degraded} />)).resolves.toBeDefined();
  });

  it('renders an outcome the current build has no label or colour for', async () => {
    const degraded = {
      ...composition(),
      diagnosis: { ...composition().diagnosis, outcome: 'SOMETHING_NEW', timingPosture: 'LATER' },
    } as never;
    const { queryByText } = await wrap(<RemedyProtocolCard composition={degraded} />);
    // Falls back to the engine's own word rather than a blank headline.
    expect(queryByText('SOMETHING_NEW')).not.toBeNull();
  });
});

/*
 * The Reading design draws these same cards as sections inside the Oracle's
 * message (`flush`), under a redesigned VerdictSeal. Cached data reaches that
 * layout exactly as it reached the old one, so the same contract holds.
 */
describe('the Reading design layout with degraded cached data', () => {
  it('renders the flush chart section for a verdict missing confidence and factors', async () => {
    const verdict = { ...freshVerdict(), confidence: undefined, factors: undefined } as never;
    const { getByTestId } = await wrap(
      <RkpWatchCard
        flush
        showVerdict={false}
        window={WINDOW}
        lagnaSignName="Burj Jauza"
        lagnaRulerName="Utarid"
        verdict={verdict}
        directionalFocus={null}
      />,
    );
    expect(getByTestId('rkp-watch-section')).toBeTruthy();
  });

  it('renders the flush remedy sections when narration is undefined and steps are absent', async () => {
    const degraded = {
      ...composition(),
      narration: undefined,
      protocol: { interventionRequired: true, guidance: null },
    } as never;
    const { getByTestId } = await wrap(
      <RemedyProtocolCard composition={degraded} showFinding={false} flush />,
    );
    expect(getByTestId('remedy-protocol-sections')).toBeTruthy();
  });

  it('renders the verdict seal for an unknown state with no confidence, showing no pips', async () => {
    const verdict = { ...freshVerdict(), state: 'SOMETHING_NEW', confidence: undefined } as never;
    const { getByTestId, queryByTestId, getByText } = await wrap(
      <VerdictSeal verdict={verdict} diagnosis={null} />,
    );
    expect(getByTestId('verdict-seal')).toBeTruthy();
    expect(getByText('This reading could not be described')).toBeTruthy();
    // No confidence on record → no strength shown, never a guessed one.
    expect(queryByTestId('verdict-strength-pips')).toBeNull();
  });

  it('renders the verdict seal mid-reveal without throwing', async () => {
    await expect(
      wrap(<VerdictSeal verdict={freshVerdict() as never} diagnosis={null} reveal />),
    ).resolves.toBeDefined();
  });
});
