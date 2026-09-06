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
  /*
   * Defensive reads — same reasoning as RkpWatchCard's: a composition reaches
   * this card from MMKV as often as from the network, and a cache written by
   * an older build outlives it. An unknown outcome used to produce
   * `undefined + '08'` as a colour ("undefined08"), an absent `steps` threw on
   * `.length`, and `narration !== null` let an UNDEFINED narration through to
   * `.rkp_finding`. Each of those was a render-phase throw over stored data,
   * which repeats on every launch until the cache is cleared.
   */
  const outcomeColor = tone[OUTCOME_TONE[diagnosis.outcome]] ?? colors.textMuted;
  const outcomeHeadline = OUTCOME_HEADLINE[diagnosis.outcome] ?? diagnosis.outcome;
  const postureLabel = POSTURE_LABEL[diagnosis.timingPosture] ?? diagnosis.timingPosture;
  const steps = Array.isArray(protocol?.steps) ? protocol.steps : [];
  const hasNarration = narration !== null && narration !== undefined;

  // Determine reading section background based on outcome tone
  const readingBg = outcomeColor + '08'; // Very subtle tint (5% opacity)

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
    >
      {/* ── The finding ──────────────────────────────────────────────────── */}
      <View style={[styles.readingSection, { backgroundColor: readingBg }]}>
        <Text
          style={[typography('caption'), styles.eyebrow, { color: outcomeColor, opacity: 0.7 }]}
        >
          {'✧ THE READING'}
        </Text>
        <Text style={[typography('heading'), styles.headline, { color: outcomeColor }]}>
          {outcomeHeadline}
        </Text>
        <Text style={[typography('caption'), styles.subtiming, { color: colors.textMuted }]}>
          {`${postureLabel} • ${confidenceLabel(diagnosis.confidence)}`}
        </Text>
      </View>

      {/* ── Narration, when synthesis succeeded ──────────────────────────── */}
      {hasNarration && (
        <View style={styles.narrativeSection}>
          <Text style={[typography('body'), styles.prose, { color: colors.text, lineHeight: 22 }]}>
            {narration.rkp_finding}
          </Text>
          <Text style={[typography('body'), styles.prose, { color: colors.text, lineHeight: 22 }]}>
            {narration.interpretation}
          </Text>
          <Text
            style={[
              typography('body'),
              styles.proseSubtle,
              { color: colors.textMuted, lineHeight: 21 },
            ]}
          >
            {narration.recommended_approach}
          </Text>
        </View>
      )}

      {/* ── No-remedy result — a finding, not an empty state ─────────────── */}
      {protocol?.interventionRequired !== true &&
        protocol?.guidance !== null &&
        protocol?.guidance !== undefined && (
          <View
            style={[
              styles.guidance,
              { backgroundColor: colors.maqbool + '08', borderColor: colors.maqbool + '30' },
            ]}
          >
            <View style={styles.guidanceHeader}>
              <Text
                style={[
                  typography('label'),
                  { color: colors.maqbool, fontSize: 12, fontWeight: '600' },
                ]}
              >
                {'✓ No remedy needed'}
              </Text>
            </View>
            <Text
              style={[
                typography('caption'),
                styles.guidanceText,
                { color: colors.textMuted, lineHeight: 20 },
              ]}
            >
              {protocol.guidance}
            </Text>
          </View>
        )}

      {/* ── The protocol ─────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <View style={styles.protocolSection}>
          <Text style={[typography('label'), styles.protocolLabel, { color: colors.text }]}>
            {protocol?.interventionRequired === true ? '✧ What is counselled' : '✧ Also noted'}
          </Text>
          <View style={styles.stepsContainer}>
            {numberSteps(steps).map(({ step, index }) => (
              <ProtocolStep
                key={step.id}
                step={step}
                index={index}
                colors={colors}
                typography={typography}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── Why these, in the oracle's own words ─────────────────────────── */}
      {narration?.why_this_remedy !== null && narration?.why_this_remedy !== undefined && (
        <View
          style={[
            styles.why,
            { backgroundColor: colors.goldBright + '06', borderColor: colors.goldBright + '25' },
          ]}
        >
          <Text
            style={[
              typography('label'),
              { color: colors.goldBright, fontSize: 12, fontWeight: '600', marginBottom: 6 },
            ]}
          >
            {'Why this was chosen'}
          </Text>
          <Text style={[typography('caption'), { color: colors.textMuted, lineHeight: 20 }]}>
            {narration.why_this_remedy}
          </Text>
        </View>
      )}

      {hasNarration && (
        <Text style={[typography('caption'), styles.signature, { color: colors.textFaint }]}>
          {narration.signature}
        </Text>
      )}

      {/* ── Brand seal — fixed text, present even on a degraded reading ──── */}
      {composition.brandSeal !== null && composition.brandSeal !== undefined && (
        <Text style={[typography('caption'), styles.brandSeal, { color: colors.textFaint }]}>
          {composition.brandSeal}
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
  const bgColor = step.isEscalation ? colors.caution + '10' : colors.surfaceElevated;
  const borderColor = step.isEscalation ? colors.caution + '40' : colors.border + '40';

  return (
    <View
      style={[
        styles.step,
        {
          borderColor,
          backgroundColor: bgColor,
        },
      ]}
    >
      <View style={styles.stepHead}>
        <View style={[styles.stepIndex, { backgroundColor: accent + '15' }]}>
          <Text style={[typography('caption'), { color: accent, fontWeight: '600', fontSize: 13 }]}>
            {index !== null ? `${index}` : '⚡'}
          </Text>
        </View>
        <Text
          style={[typography('label'), styles.stepName, { color: colors.text, fontWeight: '600' }]}
        >
          {step.name}
        </Text>
      </View>

      <View style={styles.badges}>
        {/* Fall back to the raw value rather than rendering nothing: a step
            from an older library still names its own category honestly. */}
        <Badge
          text={CATEGORY_LABEL[step.category] ?? step.category}
          color={colors.textFaint}
          typography={typography}
        />
        <Badge
          text={EVIDENCE_LABEL[step.evidenceType] ?? step.evidenceType}
          color={accent}
          typography={typography}
        />
        {step.duration !== null && (
          <Badge text={step.duration} color={colors.textFaint} typography={typography} />
        )}
      </View>

      <Text
        style={[
          typography('caption'),
          styles.stepText,
          { color: colors.textMuted, lineHeight: 20 },
        ]}
      >
        {step.explanation}
      </Text>

      {step.instructions.length > 0 && (
        <View style={styles.instructionsContainer}>
          {step.instructions.map((line, i) => (
            <View key={`${step.id}-${i}`} style={styles.instructionRow}>
              <Text style={[typography('caption'), { color: accent, opacity: 0.6 }]}>{'—'}</Text>
              <Text
                style={[
                  typography('caption'),
                  styles.stepText,
                  { color: colors.text, lineHeight: 20 },
                ]}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

interface BadgeProps {
  text: string;
  color: string;
  typography: ReturnType<typeof useTypography>;
}

const Badge: React.FC<BadgeProps> = ({ text, color, typography }) => (
  <View
    style={[styles.badgeContainer, { borderColor: color + '50', backgroundColor: color + '10' }]}
  >
    <Text style={[typography('caption'), styles.badge, { color, fontWeight: '500' }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },

  /* ── Reading Section ──── */
  readingSection: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 0,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subtiming: {
    fontSize: 11,
    letterSpacing: 0.3,
  },

  /* ── Narrative Section ──– */
  narrativeSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prose: {
    marginBottom: 10,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  proseSubtle: {
    marginBottom: 0,
    fontSize: 13,
    opacity: 0.85,
  },

  /* ── Guidance (No Remedy) ──– */
  guidance: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  guidanceHeader: {
    marginBottom: 6,
  },
  guidanceText: {
    marginTop: 0,
    lineHeight: 20,
    fontSize: 12,
  },

  /* ── Protocol Section ──– */
  protocolSection: {
    marginBottom: 12,
  },
  protocolLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  stepsContainer: {
    gap: 10,
  },

  /* ── Step Card ──– */
  step: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
  },
  stepName: {
    flex: 1,
    fontSize: 14,
  },

  /* ── Badges ──– */
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  badgeContainer: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge: {
    fontSize: 10,
    letterSpacing: 0.2,
  },

  /* ── Instructions ──– */
  stepText: {
    fontSize: 12,
    flex: 1,
  },
  instructionsContainer: {
    marginTop: 8,
    paddingLeft: 2,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    alignItems: 'flex-start',
  },

  /* ── Why Section ──– */
  why: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },

  /* ── Signature ──– */
  signature: {
    marginTop: 14,
    fontStyle: 'italic',
    fontSize: 12,
    letterSpacing: 0.1,
  },
  brandSeal: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

export default RemedyProtocolCard;
