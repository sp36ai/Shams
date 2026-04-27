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

  const setLastLocation = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.setLastLocation,
  );
  const markLocationPrompted = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.markLocationPrompted,
  );
  const setPermissionGranted = useSettingsStore(
    (s: ReturnType<typeof useSettingsStore.getState>) => s.setPermissionGranted,
  );

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

  const handleSkip = useCallback(() => {
    // Don't capture location, but mark the prompt as shown so we don't
    // loop the user back here. Oracle screen will request on first ask.
    markLocationPrompted();
    setPermissionGranted(false);
  }, [markLocationPrompted, setPermissionGranted]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const isDenied = status === 'denied' || status === 'blocked';
  const isLoading = status === 'requesting';

  const titleText = isDenied ? t('permission.deniedTitle') : t('permission.locationTitle');
  const bodyText = isDenied ? t('permission.deniedBody') : t('permission.locationRationale');

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
      edges={['top', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.illustrationWrap}>
          <CompassPinIllustration accent={colors.accent} muted={colors.textFaint} />
        </View>

        <Text style={[typography('title'), styles.title, { color: colors.text }]}>{titleText}</Text>

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
                opacity: isLoading ? 0.7 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text
                style={[typography('button'), { color: colors.textOnPrimary, textAlign: 'center' }]}
              >
                {status === 'blocked' ? t('permission.openSettings') : t('permission.grantAccess')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[typography('button'), { color: colors.textMuted, textAlign: 'center' }]}>
              {t('permission.notNow')}
            </Text>
          </Pressable>
        </View>

        {/* Privacy reassurance — engineered, not generic */}
        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
          ]}
        >
          {Platform.OS === 'android'
            ? 'Coordinates are captured at the moment of each question and stored on this device.'
            : 'Coordinates stay on this device.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  Inline illustration — compass with location pin                           */
/* -------------------------------------------------------------------------- */

const CompassPinIllustration: React.FC<{ accent: string; muted: string }> = ({ accent, muted }) => {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <Svg width={size} height={size}>
      {/* Outer compass ring */}
      <Circle cx={cx} cy={cy} r={70} stroke={muted} strokeWidth={1} fill="none" opacity={0.5} />
      <Circle cx={cx} cy={cy} r={58} stroke={muted} strokeWidth={1} fill="none" opacity={0.3} />
      {/* Cardinal ticks (N, E, S, W) */}
      {[0, 90, 180, 270].map(deg => {
        const rad = (deg - 90) * (Math.PI / 180);
        const x1 = cx + 70 * Math.cos(rad);
        const y1 = cy + 70 * Math.sin(rad);
        const x2 = cx + 60 * Math.cos(rad);
        const y2 = cy + 60 * Math.sin(rad);
        return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth={2} />;
      })}
      {/* North needle (filled triangle pointing up) */}
      <G>
        <Path
          d={`M ${cx} ${cy - 50} L ${cx - 8} ${cy + 4} L ${cx + 8} ${cy + 4} Z`}
          fill={accent}
        />
        <Path
          d={`M ${cx} ${cy + 50} L ${cx - 8} ${cy - 4} L ${cx + 8} ${cy - 4} Z`}
          fill={muted}
          opacity={0.6}
        />
      </G>
      {/* Center pin head */}
      <Circle cx={cx} cy={cy} r={6} fill={accent} />
      <Circle cx={cx} cy={cy} r={3} fill={muted} opacity={0.9} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    textAlign: 'center',
    marginBottom: 32,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
});

export default LocationPermissionScreen;
