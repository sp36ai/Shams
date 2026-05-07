import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { WatchVerdictResult, WatchFormula } from '../../engine/watchEngine';

// ── Agreement badge ───────────────────────────────────────────────────────────

function agreementLabel(count: number): string {
  if (count === 3) return 'Full Agreement';
  if (count === 2) return 'Partial Agreement';
  if (count === 1) return 'Weak Signal';
  return 'No Agreement';
}

// ── Formula row ───────────────────────────────────────────────────────────────

interface FormulaRowProps {
  formula: WatchFormula;
}

const FormulaRow: React.FC<FormulaRowProps> = ({ formula }) => {
  const colors = useColors();
  const typography = useTypography();
  return (
    <View style={styles.formulaRow}>
      <View style={styles.formulaLeft}>
        <Text style={[typography('label'), { color: colors.textMuted }]}>{formula.name}</Text>
        <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 1 }]}>
          {formula.interpretation}
        </Text>
      </View>
      <Text
        style={[
          typography('subheading'),
          { color: formula.supportive ? colors.positive : colors.negative },
        ]}
      >
        {String(formula.value)}
      </Text>
    </View>
  );
};

// ── WatchVerdictCard ──────────────────────────────────────────────────────────

interface WatchVerdictCardProps {
  result: WatchVerdictResult;
  onSwitchMode?: () => void;
}

const WatchVerdictCard: React.FC<WatchVerdictCardProps> = ({ result, onSwitchMode }) => {
  const colors = useColors();
  const typography = useTypography();

  const verdictColor: string = (() => {
    switch (result.verdict) {
      case 'YES':
        return colors.positive;
      case 'NO':
        return colors.negative;
      case 'CONDITIONAL':
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
        <View style={[styles.modeBadge, { backgroundColor: colors.amber + '22', borderColor: colors.amber }]}>
          <Text style={[typography('label'), { color: colors.amber }]}>WATCH</Text>
        </View>
        <Text style={[typography('caption'), { color: colors.textFaint }]}>
          {new Date(result.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Formula rows */}
      <View style={[styles.formulasBlock, { borderTopColor: colors.border }]}>
        {result.formulas.map(f => (
          <FormulaRow key={f.name} formula={f} />
        ))}
      </View>

      {/* Agreement badge */}
      <View style={[styles.agreementRow, { borderTopColor: colors.border }]}>
        <View
          style={[
            styles.agreementBadge,
            {
              backgroundColor:
                result.agreementCount >= 2 ? colors.positive + '22' : colors.caution + '22',
              borderColor: result.agreementCount >= 2 ? colors.positive : colors.caution,
            },
          ]}
        >
          <Text
            style={[
              typography('label'),
              { color: result.agreementCount >= 2 ? colors.positive : colors.caution },
            ]}
          >
            {agreementLabel(result.agreementCount)} ({result.agreementCount}/3)
          </Text>
        </View>
      </View>

      {/* Dominant planet */}
      <View style={styles.planetRow}>
        <Text style={[typography('caption'), { color: colors.textMuted }]}>DOMINANT PLANET</Text>
        <Text style={[typography('heading'), { color: colors.accent, marginLeft: 8 }]}>
          {result.dominantPlanet}
        </Text>
      </View>

      {/* Verdict banner */}
      <View style={[styles.verdictBanner, { borderColor: verdictColor, backgroundColor: verdictColor + '18' }]}>
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

      {/* Narrative */}
      {result.narrative.length > 0 && (
        <Text
          style={[
            typography('bodyItalic'),
            { color: colors.textMuted, marginTop: 10, lineHeight: 22 },
          ]}
        >
          {result.narrative}
        </Text>
      )}

      {/* Footer — switch to astro mode */}
      {handleSwitch !== undefined && (
        <Pressable
          onPress={handleSwitch}
          style={({ pressed }) => [
            styles.footer,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to full KP analysis"
        >
          <Text style={[typography('label'), { color: colors.accent }]}>
            ✦ FULL KP ANALYSIS →
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
  formulasBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  formulaLeft: { flex: 1, marginRight: 8 },
  agreementRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  agreementBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
});

export default WatchVerdictCard;
