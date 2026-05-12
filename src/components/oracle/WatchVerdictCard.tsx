import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import type { AstroVerdictResult, RulingPlanetEntry } from '../../types/verdict';

// ── Agreement logic ───────────────────────────────────────────────────────────

type SignalStatus = 'confirmed' | 'denied' | 'neutral';

function getSignalStatus(
  planet: string,
  confirmedSignificators?: string[],
  deniedSignificators?: string[],
): SignalStatus {
  if (confirmedSignificators?.includes(planet)) return 'confirmed';
  if (deniedSignificators?.includes(planet)) return 'denied';
  return 'neutral';
}

type AgreementLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICTED';

function computeAgreement(
  rows: Array<{ planet: string; status: SignalStatus }>,
  verdict: string,
): AgreementLevel {
  const isPositive = verdict === 'YES' || verdict === 'CONDITIONAL';
  const confirmed = rows.filter(r => r.status === 'confirmed').length;
  const denied = rows.filter(r => r.status === 'denied').length;

  if (isPositive) {
    if (confirmed >= 3) return 'STRONG';
    if (confirmed === 2 && denied === 0) return 'MODERATE';
    if (denied > confirmed) return 'CONFLICTED';
    return 'WEAK';
  } else {
    if (denied >= 3) return 'STRONG';
    if (denied === 2 && confirmed === 0) return 'MODERATE';
    if (confirmed > denied) return 'CONFLICTED';
    return 'WEAK';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TIME_LORD_ROLES: RulingPlanetEntry['role'][] = [
  'horaLord',
  'dayLord',
  'ascSignLord',
  'ascStarLord',
  'moonSignLord',
  'moonStarLord',
];

const ROLE_LABELS: Record<RulingPlanetEntry['role'], string> = {
  horaLord: 'HORA',
  dayLord: 'DAY',
  ascSignLord: 'ASC ♈',
  ascStarLord: 'ASC ★',
  moonSignLord: 'MOON ♈',
  moonStarLord: 'MOON ★',
};

interface FormulaRowProps {
  role: RulingPlanetEntry['role'];
  planet: string;
  status: SignalStatus;
}

const FormulaRow: React.FC<FormulaRowProps> = ({ role, planet, status }) => {
  const colors = useColors();
  const typography = useTypography();

  const statusColor =
    status === 'confirmed' ? colors.positive : status === 'denied' ? colors.negative : colors.textFaint;
  const statusLabel = status === 'confirmed' ? '✓ confirms' : status === 'denied' ? '✗ denies' : '· neutral';

  return (
    <View style={styles.formulaRow}>
      <View style={[styles.roleTag, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[typography('label'), { color: colors.amber, fontSize: 9, letterSpacing: 1 }]}>
          {ROLE_LABELS[role]}
        </Text>
      </View>
      <Text style={[typography('heading'), { color: colors.amber, marginHorizontal: 10, minWidth: 60 }]}>
        {planet}
      </Text>
      <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + '18' }]}>
        <Text style={[typography('label'), { color: statusColor, fontSize: 10 }]}>{statusLabel}</Text>
      </View>
    </View>
  );
};

// ── WatchVerdictCard ──────────────────────────────────────────────────────────

interface WatchVerdictCardProps {
  result: AstroVerdictResult;
  onSwitchMode?: () => void;
}

const WatchVerdictCard: React.FC<WatchVerdictCardProps> = ({ result, onSwitchMode }) => {
  const colors = useColors();
  const typography = useTypography();

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

  // Build time-lord rows in display order
  const rows = TIME_LORD_ROLES.flatMap(role => {
    const entry = result.rulingPlanets.find(rp => rp.role === role);
    if (!entry) return [];
    return [{
      role,
      planet: entry.planet,
      status: getSignalStatus(entry.planet, result.confirmedSignificators, result.deniedSignificators),
    }];
  });

  const agreement = computeAgreement(rows, result.verdict);

  const agreementColor =
    agreement === 'STRONG'
      ? colors.positive
      : agreement === 'MODERATE'
        ? colors.amber
        : agreement === 'CONFLICTED'
          ? colors.negative
          : colors.textMuted;

  const verdictColor: string = (() => {
    switch (result.verdict) {
      case 'YES': return colors.positive;
      case 'NO': return colors.negative;
      case 'CONDITIONAL':
      case 'DELAYED': return colors.caution;
      default: return colors.textMuted;
    }
  })();

  return (
    <View style={[styles.card, { borderColor: colors.amber + '55', backgroundColor: colors.surface }]}>
      {/* Mode badge */}
      <View style={styles.modeRow}>
        <View style={[styles.modeBadge, { backgroundColor: colors.amber + '22', borderColor: colors.amber }]}>
          <Text style={[typography('label'), { color: colors.amber }]}>WATCH-TIME</Text>
        </View>
        <Text style={[typography('caption'), { color: colors.textFaint }]}>
          {result.category.toUpperCase()}
        </Text>
      </View>

      {/* Formula rows */}
      {rows.length > 0 ? (
        <View style={[styles.formulaBlock, { borderTopColor: colors.border }]}>
          <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 10 }]}>
            RULING PLANET SIGNALS
          </Text>
          {rows.map(row => (
            <FormulaRow key={row.role} role={row.role} planet={row.planet} status={row.status} />
          ))}
        </View>
      ) : (
        <View style={[styles.formulaBlock, { borderTopColor: colors.border }]}>
          <Text style={[typography('caption'), { color: colors.textFaint }]}>
            No ruling planet data returned for this reading.
          </Text>
        </View>
      )}

      {/* Agreement badge */}
      {rows.length > 0 && (
        <View style={[styles.agreementBlock, { borderTopColor: colors.border }]}>
          <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 6 }]}>
            TIME-SIGNAL AGREEMENT
          </Text>
          <View style={[styles.agreementBadge, { borderColor: agreementColor, backgroundColor: agreementColor + '18' }]}>
            <Text style={[typography('button'), { color: agreementColor, letterSpacing: 2 }]}>
              {agreement}
            </Text>
          </View>
        </View>
      )}

      {/* Verdict banner */}
      <View
        style={[
          styles.verdictBanner,
          {
            borderColor: verdictColor,
            backgroundColor: verdictColor + '18',
            shadowColor: verdictColor,
            shadowRadius: 10,
            shadowOpacity: 0.35,
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

      {/* Confidence bar */}
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

      {/* Footer — switch to astro mode */}
      {onSwitchMode !== undefined && (
        <Pressable
          onPress={onSwitchMode}
          style={({ pressed }) => [
            styles.footer,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to KP astro analysis"
        >
          <Text style={[typography('label'), { color: colors.accent }]}>◈ KP ASTRO ANALYSIS →</Text>
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
  formulaBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleTag: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 52,
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  agreementBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  agreementBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
