import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { AstroVerdictResult, HousePill, RulingPlanetEntry } from '../../types/verdict';

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
        {entry.role === 'dayLord' ? 'Day' : entry.role === 'horaLord' ? 'Hora' : 'Min'}
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

  const verdictColor: string = (() => {
    switch (result.verdict) {
      case 'YES':
        return colors.positive;
      case 'NO':
        return colors.negative;
      case 'CONDITIONAL':
      case 'DELAYED':
        return colors.caution;
      default:
        return colors.textMuted;
    }
  })();

  const handleSwitch = onSwitchMode ?? result.onSwitchMode;

  return (
    <View style={[styles.card, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}>
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

      {/* Sub-lord display */}
      <View style={[styles.subLordBlock, { borderTopColor: colors.border }]}>
        <Text style={[typography('caption'), { color: colors.textMuted }]}>MOON SUB-LORD</Text>
        <View style={styles.subLordRow}>
          <Text style={[typography('heading'), { color: colors.accent }]}>{result.subLord}</Text>
          <Text style={[typography('caption'), { color: colors.textFaint, marginLeft: 6 }]}>
            occupies H{result.subLordHouse}
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

      {/* Verdict banner */}
      <View
        style={[
          styles.verdictBanner,
          { borderColor: verdictColor, backgroundColor: verdictColor + '18' },
        ]}
      >
        <Text style={[typography('button'), { color: verdictColor, letterSpacing: 2 }]}>
          {result.verdict}
        </Text>
        <Text style={[typography('caption'), { color: colors.textMuted, marginLeft: 8 }]}>
          {result.confidence}% confidence
        </Text>
      </View>

      {/* Confidence bar */}
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceElevated }]}>
        <View
          style={[
            styles.barFill,
            { width: `${result.confidence}%` as `${number}%`, backgroundColor: verdictColor },
          ]}
        />
      </View>

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
          {result.remedy.mantra !== undefined && (
            <Text
              style={[typography('bodyItalic'), { color: colors.textFaint, fontSize: 12, marginTop: 4 }]}
            >
              {result.remedy.mantra}
            </Text>
          )}
        </View>
      )}

      {/* Narrative */}
      {result.narrative.length > 0 && (
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
});

export default AstroVerdictCard;
