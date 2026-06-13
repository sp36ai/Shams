/**
 * LocationPermissionScreen — onboarding step.
 * --------------------------------------------------------------------------
 * Why this screen exists:
 *   A horary chart is anchored to the precise moment AND place of the
 *   question. Without GPS, the chart cannot be cast — the engine simply
 *   refuses to produce a verdict from a missing ascendant. Asking for
 *   permission upfront (before signup) gives a higher grant rate than
 *   asking after the user is already invested in their first question.
 *
 * Flow contract:
 *   1. User lands here before the main shell (RootNavigator gates on
 *      settingsStore.onboardingLocationPrompted).
 *   2. User taps "Grant access" → the native OS dialog appears → on grant
 *      we capture coordinates immediately and store
 *      to settingsStore.lastLocation, then mark onboardingPrompted=true.
 *   3. User taps "Skip" → we mark onboardingPrompted=true WITHOUT
 *      capturing location. Oracle screen will re-prompt on first question.
 *   4. Either way, RootNavigator's gate re-renders and opens the main shell.
 *
 * Permission state machine (simplified — full handling in §1.11 utils):
 *   GRANTED              → capture coords, persist, advance
 *   DENIED               → show "denied" CTA → user can try again
 *   BLOCKED              → show "open settings" CTA → linkToSettings()
 *   UNAVAILABLE          → show error, allow skip
 *   LIMITED (iOS only)   → treat as granted (precise enough for horary)
 *
 * NOTE on actual permission/geolocation calls:
 *   This screen uses the real thin wrapper in `@utils/permissions` and then
 *   captures a device fix through the RN geolocation API.
 *
 * Visual contract:
 *   - Centered illustration (location pin in compass) — built with SVG
 *     primitives, no asset dependency. Themed to accent color.
 *   - Title (typography.title), rationale body (typography.body), two CTAs
 *     stacked vertically: primary "Grant access" + secondary "Not now".
 *   - DENIED state: title swaps to "Permission denied" with retry guidance.
 *   - BLOCKED state: secondary CTA becomes "Open Settings".
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import StarfieldBackground from '@components/StarfieldBackground';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import { useSettingsStore } from '@stores/settingsStore';
import { requestLocationPermission, isLocationUsable } from '@utils/permissions';

type ScreenStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'blocked';

const LocationPermissionScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const setLastLocation = useSettingsStore(s => s.setLastLocation);
  const markLocationPrompted = useSettingsStore(s => s.markLocationPrompted);
  const setPermissionGranted = useSettingsStore(s => s.setPermissionGranted);

  const [status, setStatus] = useState<ScreenStatus>('idle');

  const handleGrant = useCallback(async () => {
    setStatus('requesting');
    try {
      const permResult = await requestLocationPermission();

      if (!isLocationUsable(permResult.status)) {
        setPermissionGranted(false);
        markLocationPrompted();
        setStatus(permResult.status === 'never-ask' ? 'blocked' : 'denied');
        return;
      }

      setPermissionGranted(true);

      // Capture current position via W3C Geolocation API (available globally in RN).
      await new Promise<void>(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setLastLocation({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              label: null,
              capturedAt: Date.now(),
            });
            resolve();
          },
          () => {
            // Permission granted but fix failed — advance without coords.
            resolve();
          },
          {
            enableHighAccuracy: permResult.status === 'granted-fine',
            timeout: 8000,
            maximumAge: 30000,
          },
        );
      });

      markLocationPrompted();
      setStatus('granted');
      // RootNavigator's gate re-renders automatically because
      // onboardingLocationPrompted flipped — no manual navigation needed.
    } catch {
      setStatus('denied');
    }
  }, [setLastLocation, setPermissionGranted, markLocationPrompted]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const isDenied = status === 'denied' || status === 'blocked';
  const isLoading = status === 'requesting';

  // Google Play Compliance: Prominent disclosure must be shown before the system prompt.
  const titleText = isDenied ? t('permission.deniedTitle') : 'Location Required to Continue';
  const bodyText = isDenied
    ? t('permission.deniedBody')
    : 'Shams al-Asrār requires your precise location to read the heavens for your exact position. Every question is anchored to its moment and place — without both, the celestial counsel cannot be trusted.\n\nWithout location access, the app cannot function.';

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
      edges={['top', 'bottom']}
    >
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Supra-label */}
        <View style={styles.supraWrap}>
          <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 2.5 }]}>
            {'AL-MAWQI — THE ANCHOR'}
          </Text>
          <View style={styles.supraLine}>
            <View style={[styles.supraHairline, { backgroundColor: colors.goldBright }]} />
            <Text
              style={{ color: colors.goldBright, fontSize: 9, marginHorizontal: 10, opacity: 0.45 }}
            >
              {'✦'}
            </Text>
            <View style={[styles.supraHairline, { backgroundColor: colors.goldBright }]} />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.borderAccent },
          ]}
        >
          <View style={styles.illustrationWrap}>
            <CompassPinIllustration
              accent={colors.accent}
              muted={colors.textFaint}
              amber={colors.amber}
            />
          </View>

          <Text style={[typography('subheading'), styles.title, { color: colors.goldBright }]}>
            {titleText}
          </Text>

          <View style={styles.titleRule}>
            <View style={[styles.ruleHairline, { backgroundColor: colors.goldBright }]} />
          </View>

          <Text style={[typography('body'), styles.body, { color: colors.textMuted }]}>
            {bodyText}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={isDenied && status === 'blocked' ? handleOpenSettings : handleGrant}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.accent,
                  shadowOpacity: pressed ? 0.2 : 0.45,
                  shadowRadius: pressed ? 4 : 16,
                  shadowOffset: { width: 0, height: pressed ? 1 : 6 },
                  elevation: pressed ? 2 : 6,
                  opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    typography('button'),
                    { color: colors.textOnPrimary, textAlign: 'center' },
                  ]}
                >
                  {status === 'blocked'
                    ? t('permission.openSettings')
                    : t('permission.grantAccess')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Privacy notice */}
        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 },
          ]}
        >
          {'✦  '}
          {Platform.OS === 'android'
            ? 'Coordinates are captured at the moment of each question and stored on this device.'
            : 'Coordinates stay on this device.'}
          {'  ✦'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Inline illustration — compass with location pin                           */
/* -------------------------------------------------------------------------- */

const CompassPinIllustration: React.FC<{ accent: string; muted: string; amber: string }> = ({
  accent,
  muted,
  amber,
}) => {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      {/* Outer zodiac tick ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={88}
        stroke={accent}
        strokeOpacity={0.12}
        strokeWidth={14}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={88}
        stroke={accent}
        strokeOpacity={0.3}
        strokeWidth={1}
        fill="none"
      />
      {Array.from({ length: 12 }).map((_, i) => {
        const rad = (i * 30 - 90) * (Math.PI / 180);
        const isMain = i % 3 === 0;
        const r1 = 88;
        const r2 = isMain ? 78 : 82;
        return (
          <Line
            key={`tick-${i}`}
            x1={cx + r1 * Math.cos(rad)}
            y1={cy + r1 * Math.sin(rad)}
            x2={cx + r2 * Math.cos(rad)}
            y2={cy + r2 * Math.sin(rad)}
            stroke={isMain ? amber : accent}
            strokeWidth={isMain ? 2 : 1}
            opacity={isMain ? 0.7 : 0.4}
          />
        );
      })}

      {/* Inner compass ring */}
      <Circle cx={cx} cy={cy} r={68} stroke={muted} strokeWidth={1} fill="none" opacity={0.4} />
      <Circle cx={cx} cy={cy} r={56} stroke={muted} strokeWidth={1} fill="none" opacity={0.2} />

      {/* Cardinal ticks */}
      {[0, 90, 180, 270].map(deg => {
        const rad = (deg - 90) * (Math.PI / 180);
        const isNorth = deg === 0;
        return (
          <Line
            key={deg}
            x1={cx + 68 * Math.cos(rad)}
            y1={cy + 68 * Math.sin(rad)}
            x2={cx + 56 * Math.cos(rad)}
            y2={cy + 56 * Math.sin(rad)}
            stroke={isNorth ? amber : accent}
            strokeWidth={isNorth ? 2.5 : 1.5}
          />
        );
      })}

      {/* Compass needle */}
      <G>
        <Path
          d={`M ${cx} ${cy - 48} L ${cx - 7} ${cy + 4} L ${cx + 7} ${cy + 4} Z`}
          fill={amber}
          opacity={0.95}
        />
        <Path
          d={`M ${cx} ${cy + 48} L ${cx - 7} ${cy - 4} L ${cx + 7} ${cy - 4} Z`}
          fill={muted}
          opacity={0.5}
        />
      </G>

      {/* Center hub */}
      <Circle cx={cx} cy={cy} r={7} fill={accent} />
      <Circle cx={cx} cy={cy} r={3.5} fill={muted} opacity={0.9} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 20,
  },
  supraWrap: {
    alignItems: 'center',
    gap: 8,
  },
  supraLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  supraHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.3,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    gap: 0,
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  titleRule: {
    alignItems: 'center',
    marginVertical: 14,
  },
  ruleHairline: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    opacity: 0.3,
  },
  body: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
});

export default LocationPermissionScreen;
