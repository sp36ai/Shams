/**
 * RemedyProtocolCard — renders the diagnosis and the remedy protocol.
 * --------------------------------------------------------------------------
 * Sibling of RkpWatchCard: that card shows what the chart said, this one shows
 * what follows from it. Presentation only — every value is read straight off
 * the composition, and nothing is recomputed or re-ranked here. The engine
 * chose these interventions; the card's job is to show them honestly.
 *
 * Three things the card is careful about:
 *
 *   1. Evidence. Every step carries a label saying what kind of authority it
 *      has. A traditional astrological correspondence must never be presented
 *      with the weight of a scriptural instruction, so the label sits next to
 *      the name rather than buried in the detail.
 *
 *   2. The no-remedy result. When the engine prescribes nothing, that is the
 *      finding, not an empty state. It is rendered as a positive statement so
 *      the oracle does not read as having failed to produce something.
 *
 *   3. Escalation. A professional referral leads the protocol and is styled
 *      apart from the practices, because it is not one of them.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { RkpOutcome, TimingPosture } from '@astrology/rkp/diagnosis';
import type {
  EvidenceType,
  OracleProtocolStep,
  RemedyCategory,
  WatchOracleComposition,
} from '../../types/watchOracle';

/* -------------------------------------------------------------------------- */
/*  Presentation tables                                                       */
/* -------------------------------------------------------------------------- */

/** The diagnosis in plain language — the finding, before the reasoning. */
export const OUTCOME_HEADLINE: Readonly<Record<RkpOutcome, string>> = Object.freeze({
  FAVOURABLE: 'Conditions support this',
  UNFAVOURABLE: 'The chart does not carry this',
  DELAYED: 'It stands, but not yet',
  UNCERTAIN: 'The chart has not settled',
  CONDITIONAL: 'Supported, with something in the way',
  PREMATURE: 'The timing has not arrived',
  ESCALATING: 'This is gathering strength',
  DECLINING: 'This is weakening',
});

type ToneKey = 'maqbool' | 'caution' | 'mardood' | 'muted';

export const OUTCOME_TONE: Readonly<Record<RkpOutcome, ToneKey>> = Object.freeze({
  FAVOURABLE: 'maqbool',
  ESCALATING: 'maqbool',
  CONDITIONAL: 'caution',
  DELAYED: 'caution',
  PREMATURE: 'caution',
  DECLINING: 'caution',
  UNFAVOURABLE: 'mardood',
  UNCERTAIN: 'muted',
});

/** What the timing asks the seeker to do, as an instruction rather than a code. */
export const POSTURE_LABEL: Readonly<Record<TimingPosture, string>> = Object.freeze({
  ACT_NOW: 'Move on this now',
  ACT_SOON: 'Move on this shortly',
  WAIT: 'Wait before committing',
  WAIT_LONG: 'A long wait — do not force it',
  UNKNOWN: 'The chart gives no timing',
});

/**
 * How much authority each kind of remedy carries. These labels are the whole
 * reason evidenceType exists: the seeker is entitled to know whether they are
 * being shown scripture, inherited practice, or ordinary prudence.
 */
export const EVIDENCE_LABEL: Readonly<Record<EvidenceType, string>> = Object.freeze({
  scriptural: 'Qurʾān & Sunnah',
  traditional: 'Traditional practice',
  astrological: 'Traditional correspondence',
  behavioral: 'Practical step',
});

export const CATEGORY_LABEL: Readonly<Record<RemedyCategory, string>> = Object.freeze({
  contemplative: 'Reflection',
  devotional: 'Devotion',
  astrological: 'Traditional',
  behavioral: 'Action',
  practical: 'Professional advice',
});

/** Confidence as a phrase. Bands match the engine's own scalar mapping. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) {
    return 'very high confidence';
  }
  if (confidence >= 0.75) {
    return 'high confidence';
  }
  if (confidence >= 0.5) {
    return 'moderate confidence';
  }
  if (confidence >= 0.3) {
    return 'low confidence';
  }
  return 'the chart is unsettled';
}

/**
 * Number the practices 1..n while leaving referrals unnumbered.
 *
 * A referral is not one practice among several, and numbering it invites
 * reading it as optional. Counting it would also start the practices at 2,
 * which reads as a missing first step.
 */
export function numberSteps<T extends { isEscalation: boolean }>(
  steps: readonly T[],
): Array<{ step: T; index: number | null }> {
  let n = 0;
  return steps.map(step => ({
    step,
    index: step.isEscalation ? null : ++n,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

export interface RemedyProtocolCardProps {
  composition: WatchOracleComposition;
}

const RemedyProtocolCard: React.FC<RemedyProtocolCardProps> = ({ composition }) => {
  const colors = useColors();
  const typography = useTypography();

  const { diagnosis, protocol, narration } = composition;

  const tone: Record<ToneKey, string> = {
    maqbool: colors.maqbool,
    caution: colors.caution,
    mardood: colors.mardood,
    muted: colors.textMuted,
  };
  const outcomeColor = tone[OUTCOME_TONE[diagnosis.outcome]];

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
    >
      {/* ── The finding ──────────────────────────────────────────────────── */}
      <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 1.5 }]}>
        {'THE READING'}
      </Text>
      <Text style={[typography('heading'), styles.headline, { color: outcomeColor }]}>
        {OUTCOME_HEADLINE[diagnosis.outcome]}
      </Text>
      <Text style={[typography('caption'), { color: colors.textMuted }]}>
        {`${POSTURE_LABEL[diagnosis.timingPosture]} · ${confidenceLabel(diagnosis.confidence)}`}
      </Text>

      {/* ── Narration, when synthesis succeeded ──────────────────────────── */}
      {narration !== null && (
        <>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <Text style={[typography('body'), styles.prose, { color: colors.text }]}>
            {narration.rkp_finding}
          </Text>
          <Text style={[typography('body'), styles.prose, { color: colors.text }]}>
            {narration.interpretation}
          </Text>
          <Text style={[typography('body'), styles.prose, { color: colors.textMuted }]}>
            {narration.recommended_approach}
          </Text>
        </>
      )}

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      {/* ── No-remedy result — a finding, not an empty state ─────────────── */}
      {!protocol.interventionRequired && protocol.guidance !== null && (
        <View style={[styles.guidance, { borderColor: colors.border }]}>
          <Text style={[typography('label'), { color: colors.maqbool }]}>{'No remedy needed'}</Text>
          <Text style={[typography('caption'), styles.guidanceText, { color: colors.textMuted }]}>
            {protocol.guidance}
          </Text>
        </View>
      )}

      {/* ── The protocol ─────────────────────────────────────────────────── */}
      {protocol.steps.length > 0 && (
        <>
          <Text style={[typography('label'), { color: colors.text, marginBottom: 10 }]}>
            {protocol.interventionRequired ? 'What is counselled' : 'Also noted'}
          </Text>
          {numberSteps(protocol.steps).map(({ step, index }) => (
            <ProtocolStep
              key={step.id}
              step={step}
              index={index}
              colors={colors}
              typography={typography}
            />
          ))}
        </>
      )}

      {/* ── Why these, in the oracle's own words ─────────────────────────── */}
      {narration?.why_this_remedy !== null && narration?.why_this_remedy !== undefined && (
        <View style={[styles.why, { borderColor: colors.border }]}>
          <Text style={[typography('label'), { color: colors.goldBright }]}>
            {'Why this was chosen'}
          </Text>
          <Text style={[typography('caption'), styles.guidanceText, { color: colors.textMuted }]}>
            {narration.why_this_remedy}
          </Text>
        </View>
      )}

      {narration !== null && (
        <Text style={[typography('caption'), styles.signature, { color: colors.textFaint }]}>
          {narration.signature}
        </Text>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */

interface StepProps {
  step: OracleProtocolStep;
  index: number | null;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
}

const ProtocolStep: React.FC<StepProps> = ({ step, index, colors, typography }) => {
  // A referral is bordered and tinted apart from the practices — it is advice
  // of a different kind, not a stronger version of the same thing.
  const accent = step.isEscalation ? colors.caution : colors.goldBright;

  return (
    <View
      style={[
        styles.step,
        {
          borderColor: step.isEscalation ? colors.caution : colors.border,
          backgroundColor: step.isEscalation ? colors.surfaceElevated : 'transparent',
        },
      ]}
    >
      <View style={styles.stepHead}>
        <Text style={[typography('caption'), { color: accent }]}>
          {index !== null ? `${index}.` : '!'}
        </Text>
        <Text style={[typography('label'), styles.stepName, { color: colors.text }]}>
          {step.name}
        </Text>
      </View>

      <View style={styles.badges}>
        <Badge
          text={CATEGORY_LABEL[step.category]}
          color={colors.textFaint}
          typography={typography}
        />
        <Badge text={EVIDENCE_LABEL[step.evidenceType]} color={accent} typography={typography} />
        {step.duration !== null && (
          <Badge text={step.duration} color={colors.textFaint} typography={typography} />
        )}
      </View>

      <Text style={[typography('caption'), styles.stepText, { color: colors.textMuted }]}>
        {step.explanation}
      </Text>

      {step.instructions.map((line, i) => (
        <View key={`${step.id}-${i}`} style={styles.instructionRow}>
          <Text style={[typography('caption'), { color: accent }]}>{'·'}</Text>
          <Text style={[typography('caption'), styles.stepText, { color: colors.text }]}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
};

interface BadgeProps {
  text: string;
  color: string;
  typography: ReturnType<typeof useTypography>;
}

const Badge: React.FC<BadgeProps> = ({ text, color, typography }) => (
  <Text style={[typography('caption'), styles.badge, { color, borderColor: color }]}>{text}</Text>
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
  prose: {
    marginBottom: 8,
  },
  guidance: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  guidanceText: {
    marginTop: 4,
  },
  step: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
  },
  stepHead: {
    flexDirection: 'row',
    gap: 8,
  },
  stepName: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.3,
  },
  stepText: {
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  why: {
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signature: {
    marginTop: 14,
    fontStyle: 'italic',
  },
});

export default RemedyProtocolCard;
