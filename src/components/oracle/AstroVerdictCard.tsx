import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type {
  AstroVerdictResult,
  HousePill,
  RulingPlanetEntry,
  OracleVoice,
} from '../../types/verdict';
import HoraryChartWheel from './HoraryChartWheel';

// ── Oracle voice default (Ayat al-Kursi fallback) ─────────────────────────────

const ORACLE_DEFAULT: OracleVoice = {
  opening: '',
  interpretation: '',
  spiritual_layer: '',
  hidden_influence: '',
  timing: '',
  remedy: {
    quran_verse: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ — Al-Imran 3:173',
    translation: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
  },
  signature: 'Oracle of Shams al-Asrār (by Astro Sarfaraz)',
};

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

// ── AstroVerdictCard ──────────────────────────────────────────────────────────

interface AstroVerdictCardProps {
  result: AstroVerdictResult;
  onSwitchMode?: () => void;
}

const AstroVerdictCard: React.FC<AstroVerdictCardProps> = ({ result, onSwitchMode }) => {
  const colors = useColors();
  const typography = useTypography();

  // Animated confidence bar fill — slides in on mount
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

  const verdictColor: string = (() => {
    switch (result.verdict) {
      case 'YES':
        return colors.positive;
      case 'NO':
        return colors.negative;
      case 'CONDITIONAL':
      case 'DELAYED':
        return colors.caution;
      case 'DENIED':
        return colors.textMuted;
      default:
        return colors.textMuted;
    }
  })();

  const handleSwitch = onSwitchMode ?? result.onSwitchMode;
  const oracle = result.oracle ?? ORACLE_DEFAULT;
  const remedy = oracle.remedy;
  const hasRemedy =
    remedy.quran_verse ??
    remedy.dua ??
    remedy.name_of_allah ??
    remedy.zikr ??
    remedy.charity ??
    false;

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
            <Text style={[typography('label'), { color: colors.accent }]}>KP ASTRO</Text>
          </View>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            {result.category.toUpperCase()}
          </Text>
        </View>
        <View
          style={[
            styles.verdictBanner,
            { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
          ]}
        >
          <Text style={[typography('button'), { color: colors.textMuted, letterSpacing: 2 }]}>
            DENIED
          </Text>
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
        {handleSwitch !== undefined && (
          <Pressable
            onPress={handleSwitch}
            style={({ pressed }) => [
              styles.footer,
              { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Switch to watch-time analysis"
          >
            <Text style={[typography('label'), { color: colors.amber }]}>
              ◈ WATCH-TIME ANALYSIS →
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
    >
      {/* Mode badge */}
      <View style={styles.modeRow}>
        <View
          style={[
            styles.modeBadge,
            { backgroundColor: colors.accent + '22', borderColor: colors.accent },
          ]}
        >
          <Text style={[typography('label'), { color: colors.accent }]}>KP ASTRO</Text>
        </View>
        <Text style={[typography('caption'), { color: colors.textFaint }]}>
          {result.category.toUpperCase()}
        </Text>
      </View>

      {/* A) Opening — atmospheric first line */}
      {oracle.opening.length > 0 && (
        <Text style={[typography('bodyItalic'), styles.opening, { color: colors.amber }]}>
          {oracle.opening}
        </Text>
      )}

      {/* Horary chart wheel — shown for all verdicts except UNCLEAR (no chart built) */}
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

      {/* Sub-lord display */}
      <View style={[styles.subLordBlock, { borderTopColor: colors.border }]}>
        <Text style={[typography('caption'), { color: colors.textMuted }]}>MOON SUB-LORD</Text>
        <View style={styles.subLordRow}>
          <Text style={[typography('heading'), { color: colors.accent }]}>{result.subLord}</Text>
          <Text style={[typography('caption'), { color: colors.textFaint, marginLeft: 6 }]}>
            {result.subLordHouse > 0 ? `occupies H${result.subLordHouse}` : '—'}
          </Text>
        </View>
      </View>

      {/* House pills */}
      {result.houses.length > 0 && (
        <View style={[styles.pillsBlock, { borderTopColor: colors.border }]}>
          <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}>
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
          <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}>
            RULING PLANETS
          </Text>
          <View style={styles.pillsRow}>
            {result.rulingPlanets.map(rp => (
              <RulingPlanetChip key={rp.role} entry={rp} />
            ))}
          </View>
        </View>
      )}

      {/* B) Interpretation + spiritual_layer */}
      {(oracle.interpretation.length > 0 || oracle.spiritual_layer.length > 0) && (
        <View style={[styles.narrativeBlock, { borderTopColor: colors.border }]}>
          {oracle.interpretation.length > 0 && (
            <Text
              style={[typography('body'), { color: colors.text, fontSize: 14, lineHeight: 22 }]}
            >
              {oracle.interpretation}
            </Text>
          )}
          {oracle.spiritual_layer.length > 0 && (
            <View style={[styles.spiritualLayer, { borderLeftColor: colors.amber }]}>
              <Text style={[typography('bodyItalic'), { color: colors.textFaint, fontSize: 13 }]}>
                {oracle.spiritual_layer}
              </Text>
            </View>
          )}
          {/* Astro card: hidden_influence uses centered dot separator (no left border) */}
          {oracle.hidden_influence.length > 0 && (
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

      {/* Verdict banner — with colored glow shadow */}
      <View
        style={[
          styles.verdictBanner,
          {
            borderColor: verdictColor,
            backgroundColor: verdictColor + '18',
            shadowColor: verdictColor,
            shadowRadius: 10,
            shadowOpacity: 0.45,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Text style={[typography('button'), { color: verdictColor, letterSpacing: 3 }]}>
          {result.verdict}
        </Text>
        <Text style={[typography('caption'), { color: colors.textMuted, marginLeft: 8 }]}>
          {result.confidence}% confidence
        </Text>
      </View>

      {/* Confidence bar — animated fill on mount */}
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
      {oracle.timing.length > 0 && (
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

      {/* F) Remedy block — quran_verse → name_of_allah → dua → zikr → charity (astro order) */}
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
        {remedy.translation !== undefined && (
          <Text
            style={[
              typography('caption'),
              { color: colors.textFaint, fontSize: 11, fontStyle: 'italic', marginBottom: 6 },
            ]}
          >
            {remedy.translation}
          </Text>
        )}
        {remedy.name_of_allah !== undefined && (
          <Text
            style={[typography('label'), { color: colors.amber, fontSize: 12, marginBottom: 6 }]}
          >
            {remedy.name_of_allah}
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
        {remedy.charity !== undefined && (
          <Text style={[typography('bodyItalic'), { color: colors.textFaint, fontSize: 11 }]}>
            {remedy.charity}
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
            {result.timing.activeDasha !== undefined ? `  ·  ${result.timing.activeDasha} MD` : ''}
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
          {result.remedy.mantra !== undefined && (
            <Text
              style={[
                typography('bodyItalic'),
                { color: colors.textFaint, fontSize: 12, marginTop: 4 },
              ]}
            >
              {result.remedy.mantra}
            </Text>
          )}
        </View>
      )}

      {/* Narrative — only show when verdict is meaningful */}
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

      {/* Footer — switch to watch mode */}
      {handleSwitch !== undefined && (
        <Pressable
          onPress={handleSwitch}
          style={({ pressed }) => [
            styles.footer,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to watch-time analysis"
        >
          <Text style={[typography('label'), { color: colors.amber }]}>
            ◈ WATCH-TIME ANALYSIS →
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
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
    gap: 6,
  },
  housePill: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
  },
  rpChip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
  },
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  barTrack: {
    height: 3,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 2,
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
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 10,
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
});

export default AstroVerdictCard;
