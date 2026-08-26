import React, { useEffect, useRef, useState } from 'react';
import type { RenderedRemedy } from '../../data/remedyRenderer';
import { Animated, Easing, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { SEMANTIC_COLORS, confidenceBucket, confirmedConfidenceColor } from '@theme/semanticColors';
import type {
  AstroVerdictResult,
  HousePill,
  RulingPlanetEntry,
  OracleVoice,
} from '../../types/verdict';
import HoraryChartWheel from './HoraryChartWheel';
import { VerdictPill } from '../VerdictPill';

// ── Oracle voice default (Ayat al-Kursi fallback) ─────────────────────────────

const ORACLE_DEFAULT: OracleVoice = {
  opening: '',
  interpretation: '',
  spiritual_layer: '',
  hidden_influence: '',
  remedy: {
    quran_verse: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173',
    asma: 'Ya Wakil — يا وكيل — The Trustee of all affairs',
  },
  signature: 'Oracle of Shams al-Asrār (by Astro Sarfaraz)',
};

// ── Share text ────────────────────────────────────────────────────────────────

const VERDICT_LABEL: Readonly<Record<string, string>> = {
  YES: 'YES',
  NO: 'NO',
  CONDITIONAL: 'CONDITIONAL',
  DELAYED: 'DELAYED',
  UNCLEAR: 'UNCLEAR',
  DENIED: 'DENIED',
};

/**
 * Plain-text share summary — built entirely from data already on the
 * result, no extra fetch/render needed. Kept as a pure function so it's
 * easy to reason about / test independent of the Share API call itself.
 */
export function buildShareText(result: AstroVerdictResult): string {
  const oracle = result.oracle;
  const lines: string[] = [];

  lines.push('✦ Shams al-Asrār — Oracle Reading');
  lines.push('');
  if (result.question !== undefined && result.question.length > 0) {
    lines.push(`Question: ${result.question}`);
  }
  lines.push(
    `Verdict: ${VERDICT_LABEL[result.verdict] ?? result.verdict} (${result.confidence}% confidence)`,
  );
  if (result.timing !== undefined) {
    lines.push(`Timing: within ${result.timing.range.max} ${result.timing.window}`);
  }
  lines.push('');

  const prose = oracle?.interpretation ?? result.narrative;
  if (prose.length > 0) {
    lines.push(prose);
    lines.push('');
  }

  if (result.remedy !== undefined) {
    lines.push(`Remedy: ${result.remedy.action}`);
    lines.push('');
  }

  lines.push(`— ${oracle?.signature ?? ORACLE_DEFAULT.signature}`);

  return lines.join('\n');
}

/**
 * Technical export of the engine's raw scoring trace — every step
 * judgeHorary() used to reach this verdict, in evaluation order. Meant to
 * be pasted into an independent KP-rules check (by a human astrologer or
 * an AI) rather than read as a normal reading. Absent when the reading
 * predates this field or a follow-up message has no attached reading.
 */
export function buildReasoningShareText(result: AstroVerdictResult): string {
  const lines: string[] = [];

  lines.push('✦ Shams al-Asrār — Reasoning Trace (technical)');
  lines.push('');
  if (result.question !== undefined && result.question.length > 0) {
    lines.push(`Question: ${result.question}`);
  }
  lines.push(`Category: ${result.category}`);
  lines.push(`Chart moment: ${result.createdAt}`);
  lines.push(
    `Verdict: ${VERDICT_LABEL[result.verdict] ?? result.verdict} (${result.confidence}% confidence)`,
  );
  lines.push(`Moon's Sub-Lord: ${result.subLord} — occupies house ${result.subLordHouse}`);
  if (result.rulingPlanets.length > 0) {
    lines.push(
      `Ruling planets: ${result.rulingPlanets.map(rp => `${rp.role}=${rp.planet}`).join(', ')}`,
    );
  }
  lines.push('');
  lines.push('Engine steps (in evaluation order):');

  const reasoning = result.reasoning ?? [];
  if (reasoning.length === 0) {
    lines.push('(no reasoning trace attached to this reading)');
  } else {
    for (const step of reasoning) {
      const sign = step.weight > 0 ? '+' : '';
      lines.push(`[${step.ruleId}] ${step.description} (${sign}${step.weight})`);
    }
  }

  return lines.join('\n');
}

// ── House pill ────────────────────────────────────────────────────────────────

const HousePillView: React.FC<{ pill: HousePill }> = ({ pill }) => {
  const colors = useColors();
  const typography = useTypography();
  const color = pill.favorable ? colors.positive : colors.negative;
  return (
    <View style={[styles.housePill, { borderColor: color, backgroundColor: color + '1A' }]}>
      <Text style={[typography('label'), { color, fontSize: 10 }]}>H{pill.house}</Text>
      <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9, marginTop: 1 }]}>
        {pill.label}
      </Text>
    </View>
  );
};

// ── Ruling planet chip ────────────────────────────────────────────────────────

const RulingPlanetChip: React.FC<{ entry: RulingPlanetEntry }> = ({ entry }) => {
  const colors = useColors();
  const typography = useTypography();
  return (
    <View
      style={[
        styles.rpChip,
        {
          borderColor: entry.matching ? colors.accent : colors.border,
          backgroundColor: entry.matching ? colors.accent + '22' : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          typography('label'),
          { color: entry.matching ? colors.accent : colors.textMuted, fontSize: 10 },
        ]}
      >
        {entry.planet}
      </Text>
      <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 9, marginTop: 1 }]}>
        {entry.role === 'dayLord'
          ? 'Day'
          : entry.role === 'horaLord'
            ? 'Hora'
            : entry.role === 'ascSignLord'
              ? 'Asc♈'
              : entry.role === 'ascStarLord'
                ? 'Asc★'
                : entry.role === 'moonSignLord'
                  ? 'Moon♈'
                  : '☽★'}
      </Text>
    </View>
  );
};

// ── VeilLine — pulsing gold line shown during Phase 0 ────────────────────────

const VeilLine: React.FC = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={{
        height: 1,
        width: '60%',
        alignSelf: 'center',
        backgroundColor: '#C9A84C',
        opacity: anim,
        marginVertical: 28,
      }}
    />
  );
};

// ── confidencePhrase — number (0-100) → locked display string ─────────────────

function confidencePhrase(confidence: number): string {
  if (confidence >= 70) {
    return '4 celestial witnesses aligned';
  }
  if (confidence >= 40) {
    return 'The heavens speak with measured certainty';
  }
  return 'The stars speak softly — listen closely';
}

// ── CrescentGlow — the verdict reveal's crescent + radiating glow icon ────────
// A small "casting the chart" flourish above the sacred-term pill, matching
// the reference verdict card: a thin gold crescent under a burst of light.

const CRESCENT_RAYS: ReadonlyArray<readonly [angleDeg: number, length: number, opacity: number]> = [
  [0, 14, 0.8],
  [-16, 11, 0.55],
  [16, 11, 0.55],
  [-32, 8, 0.3],
  [32, 8, 0.3],
];

const CrescentGlow: React.FC<{ color: string }> = ({ color }) => {
  const colors = useColors();
  const SIZE = 60;
  const CX = SIZE / 2;
  const CY = SIZE / 2 + 8;
  const R = 13;
  const rayOrigin = CY - R - 3;

  return (
    <View style={styles.crescentWrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {CRESCENT_RAYS.map(([angle, length, opacity], i) => {
          const rad = (angle * Math.PI) / 180;
          const x2 = CX + length * Math.sin(rad);
          const y2 = rayOrigin - length * Math.cos(rad);
          return (
            <Line
              key={`ray${i}`}
              x1={CX}
              y1={rayOrigin}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={1.4}
              opacity={opacity}
              strokeLinecap="round"
            />
          );
        })}
        {/* Crescent — a bright disc with an offset "shadow" disc cut across it */}
        <Circle cx={CX} cy={CY} r={R} fill={color} opacity={0.92} />
        <Circle cx={CX + R * 0.55} cy={CY - R * 0.18} r={R * 0.94} fill={colors.surface} />
      </Svg>
    </View>
  );
};

// ── Category icon map — Unicode geometry, no emoji except 📿 ─────────────────

const CATEGORY_ICON: Record<string, string> = {
  salawat: '☽',
  dua: '✦',
  istikhara: '◈',
  sadaqa: '◇',
  fasting: '◌',
  quran: '✧',
  dhikr: '📿',
  charity: '◇',
  night_prayer: '★',
  silence: '◎',
  tawbah: '↩',
};

// ── effectDimension → display string ─────────────────────────────────────────

const EFFECT_LABEL: Record<string, string> = {
  spiritual_clearing: 'A practice of spiritual purification',
  calming: 'A practice of inner stillness',
  emotional_release: 'A practice of releasing what is held',
  surrender: 'A practice of returning to Allah',
  trust_building: 'A practice of deepening trust',
  reconciliation: 'A practice of mending what is broken',
  activation: 'A practice of renewed movement',
  grounding: 'A practice of returning to centre',
  humility: 'A practice of softening the self',
  clarity: 'A practice of clearing the inner eye',
  opening: 'A practice of opening closed doors',
  comfort: 'A practice of receiving divine comfort',
  patience: 'A practice of sacred waiting',
  gratitude: 'A practice of anchoring in blessing',
};

// ── AstroVerdictCard ──────────────────────────────────────────────────────────

interface AstroVerdictCardProps {
  result: AstroVerdictResult;
  onSwitchMode?: () => void;
  selectedRemedies?: RenderedRemedy[];
}

const AstroVerdictCard: React.FC<AstroVerdictCardProps> = ({
  result,
  onSwitchMode,
  selectedRemedies,
}) => {
  const colors = useColors();
  const typography = useTypography();

  // ── 4-phase reveal ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);

  // Chart Details — the raw KP data (wheel, manzil, sub-lord, house pills,
  // ruling planets) is collapsed by default so the chat reads as a clear
  // verdict + guidance, not a technical form. Still one tap away for anyone
  // who wants the underlying chart.
  const [showChartDetails, setShowChartDetails] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []); // empty dep — fires once on mount, never again

  const verdictOpacity = useRef(new Animated.Value(0)).current;
  const proseOpacity = useRef(new Animated.Value(0)).current;
  const remedyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 1) {
      Animated.timing(verdictOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
    if (phase === 2) {
      Animated.timing(proseOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
    if (phase === 3) {
      Animated.timing(remedyOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, verdictOpacity, proseOpacity, remedyOpacity]);

  // Confidence bar — fires once Phase 2 layout is measured
  const [barContainerWidth, setBarContainerWidth] = useState(0);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (barContainerWidth > 0) {
      barAnim.setValue(0);
      Animated.timing(barAnim, {
        toValue: barContainerWidth * (result.confidence / 100),
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [result.confidence, barContainerWidth, barAnim]);

  // CONFIRMED / DENIED coloring is a fixed confidence signal (see
  // theme/semanticColors.ts), not a theme token — this must render
  // identically no matter which theme is active.
  const verdictColor: string = (() => {
    switch (result.verdict) {
      case 'YES':
        return confirmedConfidenceColor(confidenceBucket(result.confidence));
      case 'NO':
      case 'DENIED':
        return SEMANTIC_COLORS.denied;
      case 'CONDITIONAL':
      case 'DELAYED':
        return colors.caution;
      default:
        return colors.textMuted;
    }
  })();

  const handleSwitch = onSwitchMode ?? result.onSwitchMode;
  const oracle = result.oracle ?? ORACLE_DEFAULT;
  // `oracle.remedy` is typed non-optional, but the `?? ORACLE_DEFAULT` fallback
  // above only fires when `oracle` is entirely absent. A reading persisted
  // before the oracle schema settled — or a partial server payload — can carry
  // an `oracle` object with no `remedy` sub-object, and reading `.quran_verse`
  // off `undefined` would throw straight into the "veil trembled" boundary.
  const remedy = oracle.remedy ?? ORACLE_DEFAULT.remedy;
  const hasRemedy =
    remedy.quran_verse ?? remedy.dua ?? remedy.asma ?? remedy.zikr ?? remedy.sadaqah ?? false;

  // Hero meta line — "{Hora Lord} Hora · {date} · {time}" — mirrors the
  // reference verdict card's timestamp strip, built from data already on
  // the result (no new plumbing needed).
  const horaLordEntry = result.rulingPlanets.find(rp => rp.role === 'horaLord');
  const createdDate = new Date(result.createdAt);
  const createdValid = !Number.isNaN(createdDate.getTime());
  const heroMetaLine = [
    horaLordEntry !== undefined ? `${horaLordEntry.planet} Hora` : null,
    createdValid
      ? createdDate.toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : null,
    createdValid
      ? createdDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : null,
  ]
    .filter((piece): piece is string => piece !== null)
    .join('  ·  ');

  // UNCLEAR with H0 — location was missing when engine ran; render nothing
  if (result.verdict === 'UNCLEAR' && result.subLordHouse === 0) {
    return null;
  }

  // DENIED: chart cannot address the question — render a distinct minimal card
  if (result.verdict === 'DENIED') {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.modeRow}>
          <View
            style={[
              styles.modeBadge,
              { backgroundColor: colors.accent + '22', borderColor: colors.accent },
            ]}
          >
            <Text style={[typography('label'), { color: colors.accent }]}>RKP ASTRO</Text>
          </View>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            {(result.category ?? '').toUpperCase()}
          </Text>
        </View>
        <View style={styles.verdictPillContainer}>
          <VerdictPill verdict="DENIED" confidence="HIGH" />
        </View>
        {result.narrative.length > 0 && (
          <Text
            style={[
              typography('bodyItalic'),
              { color: colors.textMuted, margin: 12, lineHeight: 22 },
            ]}
          >
            {result.narrative}
          </Text>
        )}
        {/* Comfort layer — 30–40 word spiritual reframe, visually separated */}
        {(result.oracle?.hidden_influence?.length ?? 0) > 0 && (
          <>
            <View
              style={{
                marginHorizontal: 24,
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.borderAccent,
                opacity: 0.6,
              }}
            />
            <Text
              style={[
                typography('bodyItalic'),
                {
                  color: colors.textFaint,
                  margin: 12,
                  marginTop: 10,
                  lineHeight: 20,
                  fontSize: 12,
                },
              ]}
            >
              {result.oracle!.hidden_influence}
            </Text>
          </>
        )}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => {
              Share.share({ message: buildShareText(result) }).catch(() => {
                // Share sheet dismissal/cancellation throws on some platforms —
                // nothing to recover from, just don't crash the card over it.
              });
            }}
            style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Share this reading"
          >
            <Text style={[typography('label'), { color: colors.amber }]}>↗ SHARE</Text>
          </Pressable>
          {handleSwitch !== undefined && (
            <Pressable
              onPress={handleSwitch}
              style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Switch to watch-time analysis"
            >
              <Text style={[typography('label'), { color: colors.amber }]}>
                ◈ WATCH-TIME ANALYSIS →
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
    >
      {/* ── Phase 0 — Veil ─────────────────────────────────────────────────── */}
      {phase === 0 && <VeilLine />}

      {/* ── Phase 1 — Verdict (600ms) ──────────────────────────────────────── */}
      {phase >= 1 && (
        <Animated.View style={{ opacity: verdictOpacity }}>
          {/* Mode badge */}
          <View style={styles.modeRow}>
            <View
              style={[
                styles.modeBadge,
                { backgroundColor: colors.accent + '22', borderColor: colors.accent },
              ]}
            >
              <Text style={[typography('label'), { color: colors.accent }]}>RKP ASTRO</Text>
            </View>
            <Text style={[typography('caption'), { color: colors.textFaint }]}>
              {(result.category ?? '').toUpperCase()}
            </Text>
          </View>

          {/* Verdict hero — crescent glow + sacred-term pill, the ceremonial reveal */}
          <View style={styles.verdictHero}>
            <CrescentGlow color={verdictColor} />
            <VerdictPill
              verdict={result.verdict}
              confidence={confidenceBucket(result.confidence)}
            />
            {heroMetaLine.length > 0 && (
              <Text
                style={[
                  typography('caption'),
                  { color: colors.textFaint, marginTop: 10, letterSpacing: 0.6 },
                ]}
              >
                {heroMetaLine}
              </Text>
            )}
            <Text
              style={[
                typography('caption'),
                { color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
              ]}
            >
              {confidencePhrase(result.confidence)}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Phase 2 — Prose and all detail (1400ms) ────────────────────────── */}
      {phase >= 2 && (
        <Animated.View style={{ opacity: proseOpacity }}>
          {/* A) Opening — atmospheric first line */}
          {(oracle.opening?.length ?? 0) > 0 && (
            <Text style={[typography('bodyItalic'), styles.opening, { color: colors.amber }]}>
              {oracle.opening}
            </Text>
          )}

          {/* Chart Details toggle — the raw KP data below is real and often
              wanted, but it reads as noise stacked ahead of the actual
              guidance. Collapsed by default; one tap reveals it. */}
          <Pressable
            onPress={() => setShowChartDetails(v => !v)}
            style={({ pressed }) => [
              styles.chartDetailsToggle,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={showChartDetails ? 'Hide chart details' : 'View chart details'}
          >
            <Text style={[typography('label'), { color: colors.textMuted, fontSize: 11 }]}>
              {showChartDetails ? '⌃ HIDE CHART DETAILS' : '⌄ VIEW CHART DETAILS'}
            </Text>
          </Pressable>

          {showChartDetails && (
            <>
              {/* Horary chart wheel */}
              {result.verdict !== 'UNCLEAR' &&
                result.planetDegrees !== undefined &&
                result.cuspDegrees !== undefined &&
                result.cuspSigns !== undefined && (
                  <HoraryChartWheel
                    planetDegrees={result.planetDegrees}
                    cuspDegrees={result.cuspDegrees}
                    cuspSigns={result.cuspSigns}
                    planetChain={result.planetChain}
                    significators={result.significators}
                    confirmedSignificators={result.confirmedSignificators}
                    deniedSignificators={result.deniedSignificators}
                    rulingPlanets={result.rulingPlanets}
                    moonSubLord={result.subLord}
                  />
                )}

              {/* al-Qamar's manzila */}
              {result.manzila !== undefined && (
                <View style={[styles.manzilaBlock, { borderTopColor: colors.border }]}>
                  <Text style={[typography('caption'), { color: colors.textMuted }]}>
                    {'al-Qamar  ·  منازل القمر'}
                  </Text>
                  <View style={styles.manzilaRow}>
                    <Text style={[typography('heading'), { color: colors.accent }]}>
                      {result.manzila.arabic}
                    </Text>
                    <Text style={[typography('body'), { color: colors.text, marginLeft: 8 }]}>
                      {result.manzila.name}
                    </Text>
                  </View>
                  <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 2 }]}>
                    {result.manzila.oracleDescriptor}
                  </Text>
                </View>
              )}

              {/* Sub-lord display */}
              <View style={[styles.subLordBlock, { borderTopColor: colors.border }]}>
                <Text style={[typography('caption'), { color: colors.textMuted }]}>
                  MOON SUB-LORD
                </Text>
                <View style={styles.subLordRow}>
                  <Text style={[typography('heading'), { color: colors.accent }]}>
                    {result.subLord}
                  </Text>
                  <Text style={[typography('caption'), { color: colors.textFaint, marginLeft: 6 }]}>
                    {result.subLordHouse > 0 ? `occupies H${result.subLordHouse}` : '—'}
                  </Text>
                </View>
              </View>

              {/* House pills */}
              {result.houses.length > 0 && (
                <View style={[styles.pillsBlock, { borderTopColor: colors.border }]}>
                  <Text
                    style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}
                  >
                    HOUSE SIGNIFICATIONS
                  </Text>
                  <View style={styles.pillsRow}>
                    {result.houses.map(h => (
                      <HousePillView key={`${h.house}-${h.favorable ? 'f' : 'd'}`} pill={h} />
                    ))}
                  </View>
                </View>
              )}

              {/* Ruling planets */}
              {result.rulingPlanets.length > 0 && (
                <View style={[styles.pillsBlock, { borderTopColor: colors.border }]}>
                  <Text
                    style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}
                  >
                    RULING PLANETS
                  </Text>
                  <View style={styles.pillsRow}>
                    {result.rulingPlanets.map(rp => (
                      <RulingPlanetChip key={rp.role} entry={rp} />
                    ))}
                  </View>
                </View>
              )}

              {/* Reasoning trace — the engine's own scoring steps, for
                  anyone who wants to independently verify the verdict
                  against classical KP rules. Technical/expert data, so it
                  lives here alongside the rest of the chart details. */}
              {result.reasoning !== undefined && result.reasoning.length > 0 && (
                <View style={[styles.pillsBlock, { borderTopColor: colors.border }]}>
                  <View style={styles.reasoningHeaderRow}>
                    <Text style={[typography('caption'), { color: colors.textMuted }]}>
                      REASONING TRACE
                    </Text>
                    <Pressable
                      onPress={() => {
                        Share.share({ message: buildReasoningShareText(result) }).catch(() => {});
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Share reasoning trace"
                      hitSlop={8}
                    >
                      <Text style={[typography('caption'), { color: colors.amber, fontSize: 10 }]}>
                        ↗ SHARE
                      </Text>
                    </Pressable>
                  </View>
                  {result.reasoning.map((step, idx) => (
                    <Text
                      key={`${step.ruleId}-${idx}`}
                      selectable
                      style={[
                        typography('caption'),
                        {
                          color:
                            step.weight > 0
                              ? colors.positive
                              : step.weight < 0
                                ? colors.negative
                                : colors.textFaint,
                          fontSize: 11,
                          lineHeight: 16,
                          marginTop: 4,
                        },
                      ]}
                    >
                      [{step.ruleId}] {step.description} ({step.weight > 0 ? '+' : ''}
                      {step.weight})
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}

          {/* B) Oracle prose — gold hairline separator then interpretation */}
          {(oracle.interpretation?.length ?? 0) > 0 && (
            <View style={[styles.narrativeBlock, { borderTopColor: colors.border }]}>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.borderAccent,
                  marginBottom: 12,
                  opacity: 0.7,
                }}
              />
              <Text
                style={[typography('body'), { color: colors.text, fontSize: 14, lineHeight: 22 }]}
              >
                {oracle.interpretation}
              </Text>
              {(oracle.spiritual_layer?.length ?? 0) > 0 && (
                <View style={[styles.spiritualLayer, { borderLeftColor: colors.amber }]}>
                  <Text
                    style={[typography('bodyItalic'), { color: colors.textFaint, fontSize: 13 }]}
                  >
                    {oracle.spiritual_layer}
                  </Text>
                </View>
              )}
              {(oracle.hidden_influence?.length ?? 0) > 0 && (
                <>
                  <Text
                    style={[
                      typography('caption'),
                      { color: colors.textFaint, textAlign: 'center', fontSize: 10, marginTop: 8 },
                    ]}
                  >
                    · · ·
                  </Text>
                  <Text
                    style={[
                      typography('caption'),
                      { color: colors.textFaint, fontSize: 11, marginTop: 4 },
                    ]}
                  >
                    {'✦ ' + oracle.hidden_influence}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Confidence bar — subtle data decoration */}
          <View
            style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}
            onLayout={e => setBarContainerWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.barFill,
                {
                  width: barAnim,
                  backgroundColor: verdictColor,
                  shadowColor: verdictColor,
                  shadowRadius: 4,
                  shadowOpacity: 0.6,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            />
          </View>

          {/* D) Oracle timing */}
          {(oracle.timing?.length ?? 0) > 0 && (
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.text, marginHorizontal: 12, marginTop: 10, fontSize: 13 },
              ]}
            >
              {'⏳ ' + oracle.timing}
            </Text>
          )}

          {/* E) Warning (conditional) */}
          {oracle.warning !== undefined && oracle.warning.length > 0 && (
            <View
              style={[
                styles.warningBlock,
                { borderColor: colors.negative + '66', borderTopColor: colors.border },
              ]}
            >
              <Text style={[typography('caption'), { color: colors.textFaint, fontSize: 11 }]}>
                {'⚠ ' + oracle.warning}
              </Text>
            </View>
          )}

          {/* F) Oracle remedy block */}
          <View style={[styles.oracleRemedyBlock, { borderTopColor: colors.border }]}>
            <Text
              style={[
                typography('label'),
                { color: colors.amber, textAlign: 'center', marginBottom: 8, fontSize: 10 },
              ]}
            >
              — Guidance —
            </Text>
            {remedy.quran_verse !== undefined && (
              <Text
                style={[
                  typography('bodyItalic'),
                  { color: colors.amber, fontSize: 14, marginBottom: 6 },
                ]}
              >
                {remedy.quran_verse}
              </Text>
            )}
            {remedy.asma !== undefined && (
              <Text
                style={[
                  typography('label'),
                  { color: colors.amber, fontSize: 12, marginBottom: 6 },
                ]}
              >
                {remedy.asma}
              </Text>
            )}
            {remedy.dua !== undefined && (
              <Text style={[typography('caption'), { color: colors.text, marginBottom: 6 }]}>
                {remedy.dua}
              </Text>
            )}
            {remedy.zikr !== undefined && (
              <Text
                style={[
                  typography('caption'),
                  { color: colors.textFaint, fontSize: 11, marginBottom: 6 },
                ]}
              >
                {remedy.zikr}
              </Text>
            )}
            {remedy.sadaqah !== undefined && (
              <Text style={[typography('bodyItalic'), { color: colors.textFaint, fontSize: 11 }]}>
                {remedy.sadaqah}
              </Text>
            )}
            {!hasRemedy && (
              <Text style={[typography('bodyItalic'), { color: colors.amber, fontSize: 14 }]}>
                {'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173'}
              </Text>
            )}
          </View>

          {/* G) Signature */}
          <Text style={[typography('caption'), styles.signature, { color: colors.textFaint }]}>
            {oracle.signature}
          </Text>

          {/* Timing block */}
          {result.timing !== undefined && (
            <View style={[styles.timingBlock, { borderTopColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.accent }]}>
                ⊛ Within {result.timing.range.max} {result.timing.window}
                {result.timing.activeDasha !== undefined
                  ? `  ·  ${result.timing.activeDasha} MD`
                  : ''}
                {result.timing.activeAntardasha !== undefined
                  ? ` / ${result.timing.activeAntardasha} AD`
                  : ''}
              </Text>
            </View>
          )}

          {/* Remedy block */}
          {result.remedy !== undefined && (
            <View style={[styles.remedyBlock, { borderTopColor: colors.border }]}>
              <Text style={[typography('caption'), { color: colors.amber, fontStyle: 'italic' }]}>
                ◈ {result.remedy.planet}: {result.remedy.action}
              </Text>
              {result.remedy.zikr !== undefined && (
                <Text
                  style={[
                    typography('bodyItalic'),
                    { color: colors.textFaint, fontSize: 12, marginTop: 4 },
                  ]}
                >
                  {result.remedy.zikr}
                </Text>
              )}
            </View>
          )}

          {/* Narrative */}
          {result.narrative.length > 0 && result.verdict !== 'UNCLEAR' && (
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.textMuted, marginTop: 10, marginHorizontal: 12, lineHeight: 22 },
              ]}
            >
              {result.narrative}
            </Text>
          )}

          {/* Footer — share + switch to watch mode */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={() => {
                Share.share({ message: buildShareText(result) }).catch(() => {
                  // Share sheet dismissal/cancellation throws on some platforms —
                  // nothing to recover from, just don't crash the card over it.
                });
              }}
              style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Share this reading"
            >
              <Text style={[typography('label'), { color: colors.amber }]}>↗ SHARE</Text>
            </Pressable>
            {handleSwitch !== undefined && (
              <Pressable
                onPress={handleSwitch}
                style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Switch to watch-time analysis"
              >
                <Text style={[typography('label'), { color: colors.amber }]}>
                  ◈ WATCH-TIME ANALYSIS →
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── Phase 3 — Remedy block (2400ms) ───────────────────────────────── */}
      {phase >= 3 && selectedRemedies && selectedRemedies.length > 0 && (
        <Animated.View style={{ opacity: remedyOpacity }}>
          {/* Gold hairline separator */}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.borderAccent,
              marginHorizontal: 16,
              opacity: 0.7,
            }}
          />
          <Text
            style={[
              typography('label'),
              {
                color: colors.amber,
                textAlign: 'center',
                letterSpacing: 1.4,
                fontSize: 10,
                marginTop: 14,
                marginBottom: 10,
              },
            ]}
          >
            GUIDANCE FOR THIS MOMENT
          </Text>
          {selectedRemedies.map(libraryRemedy => (
            <View
              key={libraryRemedy.id}
              style={[
                styles.libraryRemedyCard,
                { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
              ]}
            >
              {/* Header row — category icon + name */}
              <View style={styles.libraryRemedyHeader}>
                <Text
                  style={[
                    typography('label'),
                    { color: colors.amber, opacity: 0.6, fontSize: 10, letterSpacing: 1.2 },
                  ]}
                >
                  {(CATEGORY_ICON[libraryRemedy.category] ?? '◈') +
                    '  ' +
                    libraryRemedy.category.toUpperCase().replace('_', ' ')}
                </Text>
              </View>
              {/* Title */}
              <Text
                style={[
                  typography('body'),
                  { color: colors.text, marginBottom: 4, fontSize: 14, lineHeight: 20 },
                ]}
              >
                {libraryRemedy.title}
              </Text>
              {/* Description — Haiku-generated or effectDimension fallback */}
              <Text
                style={[
                  typography('caption'),
                  { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 8 },
                ]}
              >
                {libraryRemedy.description ??
                  EFFECT_LABEL[libraryRemedy.effectDimension] ??
                  'A practice of sacred intention'}
              </Text>
              {/* effectDimension pill */}
              <View style={[styles.effectPill, { borderColor: colors.borderAccent }]}>
                <Text
                  style={[
                    typography('label'),
                    { color: colors.amber, opacity: 0.5, fontSize: 9, letterSpacing: 0.8 },
                  ]}
                >
                  {libraryRemedy.effectDimension.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  chartDetailsToggle: {
    marginHorizontal: 12,
    marginTop: 4,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modeBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  manzilaBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  manzilaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  subLordBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subLordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  pillsBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasoningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  housePill: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 40,
  },
  rpChip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
  },
  verdictHero: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  crescentWrap: {
    marginBottom: 4,
  },
  barTrack: {
    height: 4,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  timingBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  remedyBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    gap: 20,
  },
  footerBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  opening: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 22,
  },
  narrativeBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  spiritualLayer: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    marginTop: 8,
  },
  warningBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  oracleRemedyBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  signature: {
    textAlign: 'right',
    marginHorizontal: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  libraryRemedyCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  libraryRemedyHeader: {
    marginBottom: 6,
  },
  effectPill: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  verdictPillContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});

export default AstroVerdictCard;
