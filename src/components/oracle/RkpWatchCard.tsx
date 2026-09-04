/**
 * RkpWatchCard — renders a Digital Watch Oracle verdict.
 * --------------------------------------------------------------------------
 * Backed by the watch engine in `src/astrology/rkp/`; takes a
 * `DisplayWatchVerdict` exactly as it arrives from askWatchOracle.
 *
 * The card is presentation only. Every value shown is read straight off the
 * verdict; nothing is recomputed here, so what the user sees is exactly what
 * the engine judged.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { HOUSE_META, PLANET_NAME, gharLabel } from '@astrology/rkp/nomenclature';
import type { DisplayWatchVerdict, WatchState } from '@astrology/rkp/watchJudgment';
import type { DirectionalFocus } from '../../data/watchRemedyContext';

/* -------------------------------------------------------------------------- */
/*  Presentation tables                                                       */
/* -------------------------------------------------------------------------- */

/** Plain-language heading for each state — the answer, before the reasoning. */
export const STATE_HEADLINE: Readonly<Record<WatchState, string>> = Object.freeze({
  FULFILLED: 'The matter completes',
  MOVING: 'The matter is moving',
  DELAYED: 'It stands, but slowly',
  BLOCKED: 'The way is closed',
  REVERSING: 'Expect it to turn back',
  UNFORMED: 'The chart has not settled',
});

/**
 * Which of the theme's semantic colours each state carries. The palette's own
 * vocabulary is used: maqbool (accepted) for favourable, mardood (rejected) for
 * closed, caution for the states that stand but resist.
 */
type ToneKey = 'maqbool' | 'caution' | 'mardood' | 'muted';

const STATE_TONE: Readonly<Record<WatchState, ToneKey>> = Object.freeze({
  FULFILLED: 'maqbool',
  MOVING: 'maqbool',
  DELAYED: 'caution',
  REVERSING: 'caution',
  BLOCKED: 'mardood',
  UNFORMED: 'muted',
});

/**
 * How an obstruction should read in a sentence. Qamar's disagreement is a state
 * of mind rather than an agent standing in the way, so it is worded differently.
 *
 * `verdict.obstruction` is already boundary-mapped for the shadow nodes (see
 * DisplayWatchVerdict above), so it is either a display name straight from
 * the server (Ras/Dhanab) or an internal Planet key for the other seven —
 * PLANET_NAME resolves those, and unresolved values (already display-ready)
 * pass through as-is.
 */
export function obstructionLabel(verdict: DisplayWatchVerdict): string | null {
  if (verdict.obstruction === 'None') {
    return null;
  }
  if (verdict.obstruction === 'MoonDisagreement') {
    return 'Qamar disagrees — the mind behind the question is unsettled';
  }
  return PLANET_NAME[verdict.obstruction as keyof typeof PLANET_NAME] ?? verdict.obstruction;
}

export function timingLabel(verdict: DisplayWatchVerdict): string {
  if (verdict.timing === null) {
    return 'Unclear';
  }
  const { minDays, maxDays } = verdict.timing;
  if (maxDays <= 14) {
    return `${minDays}–${maxDays} days`;
  }
  if (maxDays <= 60) {
    return `${Math.round(minDays / 7)}–${Math.round(maxDays / 7)} weeks`;
  }
  return `${Math.round(minDays / 30)}–${Math.round(maxDays / 30)} months`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

export interface RkpWatchCardProps {
  /** The 5-minute bracket the question fell in. */
  window: { readonly startMinute: number; readonly endMinute: number };
  /** e.g. "Burj Jauza" — the sign on the 1st Ghar. */
  lagnaSignName: string;
  /** e.g. "Utarid" — classical name of the querent's own ruler. */
  lagnaRulerName: string;
  verdict: DisplayWatchVerdict;
  /** Optional physical correspondence, from data/watchRemedyContext.ts. */
  directionalFocus?: DirectionalFocus | null;
}

const RkpWatchCard: React.FC<RkpWatchCardProps> = ({
  window,
  lagnaSignName,
  lagnaRulerName,
  verdict,
  directionalFocus,
}) => {
  const colors = useColors();
  const typography = useTypography();

  const tone: Record<ToneKey, string> = {
    maqbool: colors.maqbool,
    caution: colors.caution,
    mardood: colors.mardood,
    muted: colors.textMuted,
  };
  const stateColor = tone[STATE_TONE[verdict.state]];
  const obstruction = obstructionLabel(verdict);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
    >
      {/* ── The window this reading was taken in ─────────────────────────── */}
      <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 1.5 }]}>
        {`WATCH WINDOW  :${pad2(window.startMinute)}–:${pad2(
          window.endMinute % 60,
        )}  ·  ${lagnaSignName}`}
      </Text>

      {/* ── The answer ───────────────────────────────────────────────────── */}
      <Text style={[typography('heading'), styles.headline, { color: stateColor }]}>
        {STATE_HEADLINE[verdict.state]}
      </Text>
      <Text style={[typography('caption'), { color: colors.textMuted }]}>
        {`${verdict.state} · confidence ${verdict.confidence.replace('_', ' ').toLowerCase()}`}
      </Text>

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      {/* ── What was judged ──────────────────────────────────────────────── */}
      <Row
        label={gharLabel(verdict.targetHouse)}
        value={`${HOUSE_META[verdict.targetHouse].bait} — ${verdict.targetSignName}`}
        colors={colors}
        typography={typography}
      />
      <Row
        label="Ruled by"
        value={`${verdict.targetRulerName}, which your ruler ${lagnaRulerName} counts ${verdict.rulerRelation.toLowerCase()}`}
        colors={colors}
        typography={typography}
      />
      <Row label="Timing" value={timingLabel(verdict)} colors={colors} typography={typography} />
      {obstruction !== null && (
        <Row label="Held by" value={obstruction} colors={colors} typography={typography} />
      )}
      {verdict.reversal === 'POSSIBLE' && (
        <Row
          label="Reversal"
          value="A ruling planet is retrograde — settled points may reopen"
          colors={colors}
          typography={typography}
        />
      )}
      <Row label="Direction" value={verdict.direction} colors={colors} typography={typography} />

      {/* ── Physical correspondence, when the chart names one ────────────── */}
      {directionalFocus !== null && directionalFocus !== undefined && (
        <View style={[styles.focus, { borderColor: colors.border }]}>
          <Text style={[typography('label'), { color: colors.goldBright }]}>
            {`Attend to the ${directionalFocus.direction.toLowerCase()}`}
          </Text>
          <Text style={[typography('caption'), { color: colors.textMuted, marginTop: 2 }]}>
            {directionalFocus.focus}
          </Text>
        </View>
      )}

      {/* ── Why — spoken from the engine's own record ────────────────────── */}
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <Text style={[typography('label'), { color: colors.text, marginBottom: 6 }]}>
        {'How the chart reads'}
      </Text>
      {verdict.factors.map((factor, i) => (
        <View key={`${i}-${factor.slice(0, 12)}`} style={styles.factorRow}>
          <Text style={[typography('caption'), { color: colors.goldBright }]}>{'✦'}</Text>
          <Text style={[typography('caption'), styles.factorText, { color: colors.textMuted }]}>
            {factor}
          </Text>
        </View>
      ))}
    </View>
  );
};

/* -------------------------------------------------------------------------- */

interface RowProps {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}

const Row: React.FC<RowProps> = ({ label, value, colors, typography }) => (
  <View style={styles.row}>
    <Text style={[typography('caption'), styles.rowLabel, { color: colors.textFaint }]}>
      {label}
    </Text>
    <Text style={[typography('caption'), styles.rowValue, { color: colors.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 12,
  },
  headline: {
    marginTop: 6,
    marginBottom: 2,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  rowLabel: {
    width: 92,
    letterSpacing: 0.3,
  },
  rowValue: {
    flex: 1,
  },
  focus: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  factorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  factorText: {
    flex: 1,
  },
});

export default RkpWatchCard;
