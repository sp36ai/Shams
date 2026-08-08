/**
 * KPReadingScreen — classical KP engine's verdict for a reading.
 * --------------------------------------------------------------------------
 * A separate, static-display screen (not a chat) for the classical KP
 * engine's independently-computed verdict — reached via a link on the RKP
 * chat's verdict card (see OracleChatScreen.tsx). Deliberately NOT a chat:
 * everything the classical KP engine has to say about this reading is
 * rendered at once. See docs/KP_RULES_CLASSICAL.md for the doctrine this
 * screen surfaces, and RKP_KP_FORENSIC_AUDIT.md §I for which fields are
 * "default" vs. "expert" detail.
 *
 * UI chrome labels are hardcoded English, matching the existing convention
 * in AstroVerdictCard/WatchVerdictCard (verdict-card structural text is not
 * routed through i18n — only the narrative prose is, since it already
 * arrives pre-localized from the server in the question's language).
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StarfieldBackground from '@components/StarfieldBackground';
import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useReadingsStore } from '@stores/readingsStore';
import { readingToKpResult } from '@utils/kpVerdict';
import type { KpWitnessEntry } from '../types/verdict';
import type { RootStackScreenProps } from '@navigation/types';

const ROLE_LABELS: Record<KpWitnessEntry['role'], string> = {
  dayLord: 'DAY LORD',
  ascSignLord: 'ASC SIGN ♈',
  ascStarLord: 'ASC STAR ★',
  moonSignLord: 'MOON SIGN ♈',
  moonStarLord: 'MOON STAR ★',
};

function verdictColorFor(verdict: string, colors: ReturnType<typeof useColors>): string {
  switch (verdict) {
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
}

const WitnessRow: React.FC<{ entry: KpWitnessEntry }> = ({ entry }) => {
  const colors = useColors();
  const typography = useTypography();

  const statusColor =
    entry.status === 'confirmed'
      ? colors.positive
      : entry.status === 'denied'
        ? colors.negative
        : colors.textFaint;
  const statusLabel =
    entry.status === 'confirmed'
      ? '✓ confirms'
      : entry.status === 'denied'
        ? '✗ denies'
        : '· neutral';

  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.roleTag, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[typography('label'), { color: colors.amber, fontSize: 9, letterSpacing: 1 }]}>
          {ROLE_LABELS[entry.role]}
        </Text>
      </View>
      <Text
        style={[typography('heading'), { color: colors.amber, marginHorizontal: 10, minWidth: 60 }]}
      >
        {entry.planet}
      </Text>
      <View
        style={[
          rowStyles.statusBadge,
          { borderColor: statusColor, backgroundColor: statusColor + '18' },
        ]}
      >
        <Text style={[typography('label'), { color: statusColor, fontSize: 10 }]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
};

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roleTag: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 92,
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 72,
    alignItems: 'center',
  },
});

const KPReadingScreen: React.FC<RootStackScreenProps<'KPReading'>> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();

  const reading = useReadingsStore(s => s.readings.find(r => r.id === route.params.readingId));
  const result = reading ? readingToKpResult(reading) : undefined;

  const verdictColor = result ? verdictColorFor(result.verdict, colors) : colors.textMuted;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      <View
        style={[
          styles.header,
          { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to RKP reading"
        >
          <Text style={[typography('label'), { color: colors.accent, fontSize: 20 }]}>‹</Text>
        </Pressable>
        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, letterSpacing: 2.5, textAlign: 'center' },
          ]}
        >
          {'CLASSICAL KP'}
        </Text>
        <Text
          style={[
            typography('subheading'),
            { color: colors.goldBright, marginTop: 4, textAlign: 'center' },
          ]}
        >
          {'Krishnamurti Paddhati Analysis'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {result === undefined ? (
          <View
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[typography('body'), { color: colors.textMuted }]}>
              {reading === undefined
                ? 'This reading could not be found.'
                : 'This reading was saved before classical KP analysis was added — ask again to get both readings side by side.'}
            </Text>
          </View>
        ) : (
          <>
            {result.question !== undefined && (
              <Text
                style={[
                  typography('body'),
                  { color: colors.textMuted, marginBottom: 14, fontStyle: 'italic' },
                ]}
              >
                {`“${result.question}”`}
              </Text>
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
                {result.confidence}% agreement
              </Text>
            </View>
            <Text
              style={[
                typography('caption'),
                { color: colors.textFaint, marginTop: 4, marginBottom: 16 },
              ]}
            >
              {
                'Agreement ratio between confirming and denying witnesses — not a KP doctrine score, see the app’s classical KP notes.'
              }
            </Text>

            {/* Narrative */}
            <View
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[typography('body'), { color: colors.text, lineHeight: 22 }]}>
                {result.narrative}
              </Text>
            </View>

            {/* 5 Classical Witnesses */}
            {result.witnesses.length > 0 && (
              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[typography('caption'), { color: colors.textMuted, marginBottom: 12 }]}
                >
                  {'THE 5 CLASSICAL WITNESSES'}
                </Text>
                {result.witnesses.map(w => (
                  <WitnessRow key={w.role} entry={w} />
                ))}
                <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 4 }]}>
                  {`${result.confirmedCount} confirm · ${result.deniedCount} deny — majority count, not a weighted score.`}
                </Text>
              </View>
            )}

            {/* Horary number witness */}
            {result.horaryNumber !== undefined && (
              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                  {'HORARY NUMBER WITNESS'}
                </Text>
                <Text style={[typography('body'), { color: colors.text }]}>
                  {`№${result.horaryNumber}`}
                  {result.horarySubLord !== undefined
                    ? ` — sub-lord ${result.horarySubLord}${
                        result.horarySubLordHouse !== undefined
                          ? `, house ${result.horarySubLordHouse}`
                          : ''
                      }`
                    : ''}
                </Text>
              </View>
            )}

            {/* Timing */}
            {result.timing && (
              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                  {'TIMING'}
                </Text>
                <Text style={[typography('body'), { color: colors.text }]}>
                  {`Within ${result.timing.range.min}–${result.timing.range.max} ${result.timing.window}`}
                </Text>
                {result.timing.activeDasha !== undefined && (
                  <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 4 }]}>
                    {`Active period: ${result.timing.activeDasha}`}
                  </Text>
                )}
              </View>
            )}

            {/* Remedy */}
            {result.remedy && (
              <View
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                  {'REMEDY'}
                </Text>
                <Text style={[typography('body'), { color: colors.text }]}>
                  {result.remedy.action}
                </Text>
                {result.remedy.avoid.length > 0 && (
                  <Text style={[typography('caption'), { color: colors.textFaint, marginTop: 6 }]}>
                    {`Avoid: ${result.remedy.avoid}`}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
  },
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

export default KPReadingScreen;
