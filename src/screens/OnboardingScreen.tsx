import React, { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import StarfieldBackground from '@components/StarfieldBackground';
import { useSettingsStore } from '@stores/settingsStore';
import { isLocationUsable, requestLocationPermission } from '@utils/permissions';

const { width } = Dimensions.get('window');

const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const markOnboardingComplete = useSettingsStore(s => s.markOnboardingComplete);
  const markLocationPrompted = useSettingsStore(s => s.markLocationPrompted);
  const setPermissionGranted = useSettingsStore(s => s.setPermissionGranted);

  const handleNext = () => {
    if (activeIndex < 3) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * width, animated: true });
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleFinish = () => {
    markOnboardingComplete();
  };

  const handleRequestLocation = useCallback(async () => {
    const nextIndex = activeIndex + 1;
    const result = await requestLocationPermission();
    setPermissionGranted(isLocationUsable(result.status));
    markLocationPrompted();
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setActiveIndex(nextIndex);
  }, [markLocationPrompted, setPermissionGranted, activeIndex]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

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
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.slider}
      >
        {/* Slide 1 — Welcome */}
        <View style={styles.slide}>
          <Text
            style={[
              typography('caption'),
              { color: colors.textFaint, letterSpacing: 2.5, marginBottom: 4 },
            ]}
          >
            {'✦  BISMILLAH  ✦'}
          </Text>
          <Text
            style={{
              fontFamily: 'Amiri-Regular',
              fontSize: 46,
              color: colors.goldBright,
              textAlign: 'center',
              lineHeight: 58,
            }}
          >
            {'شمس الأسرار'}
          </Text>
          <OrnamentRow colors={colors} />
          <Text
            style={[
              typography('subheading'),
              {
                color: colors.text,
                textAlign: 'center',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              },
            ]}
          >
            {'The Oracle of Hidden Stars'}
          </Text>
          <Text
            style={[
              typography('body'),
              { color: colors.textMuted, textAlign: 'center', lineHeight: 26, marginTop: 4 },
            ]}
          >
            {'Ancient KP horary wisdom.\nAstronomical precision.'}
          </Text>
        </View>

        {/* Slide 2 — Two Oracle Modes */}
        <View style={styles.slide}>
          <Text
            style={[
              typography('caption'),
              { color: colors.textFaint, letterSpacing: 2.5, marginBottom: 20 },
            ]}
          >
            {'TWO PATHS OF INQUIRY'}
          </Text>
          <View style={styles.modesRow}>
            <View
              style={[
                styles.modeCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Text style={styles.modeGlyph}>{'⌚'}</Text>
              <Text
                style={[
                  typography('label'),
                  {
                    color: colors.goldBright,
                    textAlign: 'center',
                    letterSpacing: 1.4,
                    marginBottom: 8,
                  },
                ]}
              >
                {'DIGITAL\nWATCH'}
              </Text>
              <Text
                style={[
                  typography('caption'),
                  { color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
                ]}
              >
                {'Instant readings from the digits on your clock'}
              </Text>
            </View>
            <View style={[styles.modeDivider, { backgroundColor: colors.border }]} />
            <View
              style={[
                styles.modeCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Text style={styles.modeGlyph}>{'🔭'}</Text>
              <Text
                style={[
                  typography('label'),
                  {
                    color: colors.goldBright,
                    textAlign: 'center',
                    letterSpacing: 1.4,
                    marginBottom: 8,
                  },
                ]}
              >
                {'ASTRO-\nNOMICAL'}
              </Text>
              <Text
                style={[
                  typography('caption'),
                  { color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
                ]}
              >
                {'Full sub-lord precision via Swiss Ephemeris'}
              </Text>
            </View>
          </View>
        </View>

        {/* Slide 3 — Location */}
        <View style={styles.slide}>
          <Text style={[styles.bigGlyph, { color: colors.goldBright }]}>{'◎'}</Text>
          <Text
            style={[
              typography('caption'),
              { color: colors.textFaint, letterSpacing: 2.5, marginBottom: 4 },
            ]}
          >
            {'AL-MAWQI — THE ANCHOR'}
          </Text>
          <Text
            style={[
              typography('subheading'),
              { color: colors.goldBright, textAlign: 'center', letterSpacing: 1 },
            ]}
          >
            {'Enable Location'}
          </Text>
          <Text
            style={[
              typography('body'),
              { color: colors.textMuted, textAlign: 'center', lineHeight: 26, marginTop: 4 },
            ]}
          >
            {'Required for Planetary Hora — the hora lord calculation that powers your readings.'}
          </Text>
          <Pressable
            onPress={() => void handleRequestLocation()}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
              {'Allow Location'}
            </Text>
          </Pressable>
          <Pressable onPress={handleNext} style={styles.skipBtn} hitSlop={8}>
            <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 1 }]}>
              {'Skip for now'}
            </Text>
          </Pressable>
        </View>

        {/* Slide 4 — Ready */}
        <View style={styles.slide}>
          <Text style={[styles.bigGlyph, { color: colors.goldBright }]}>{'✦'}</Text>
          <OrnamentRow colors={colors} />
          <Text
            style={[
              typography('subheading'),
              {
                color: colors.goldBright,
                textAlign: 'center',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              },
            ]}
          >
            {'Your Oracle is Ready'}
          </Text>
          <Text
            style={[
              typography('body'),
              { color: colors.textMuted, textAlign: 'center', marginTop: 4 },
            ]}
          >
            {'Ask your first question.'}
          </Text>
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
              {'Enter Shams al-Asrār'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? colors.goldBright : colors.textFaint,
                  width: i === activeIndex ? 22 : 7,
                },
              ]}
            />
          ))}
        </View>
        {activeIndex < 3 && (
          <Pressable onPress={handleNext} style={styles.nextBtn} hitSlop={8}>
            <Text
              style={[
                typography('label'),
                { color: colors.goldBright, letterSpacing: 1.5, textTransform: 'uppercase' },
              ]}
            >
              {'Next  →'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
};

const OrnamentRow: React.FC<{ colors: ReturnType<typeof useColors> }> = ({ colors }) => (
  <View style={ornStyles.row}>
    <View style={[ornStyles.line, { backgroundColor: colors.goldBright }]} />
    <Text style={{ color: colors.goldBright, fontSize: 9, marginHorizontal: 10, opacity: 0.5 }}>
      {'✦  ✦  ✦'}
    </Text>
    <View style={[ornStyles.line, { backgroundColor: colors.goldBright }]} />
  </View>
);

const ornStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 6 },
  line: { flex: 1, height: 1, opacity: 0.25 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  slider: { flex: 1 },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingBottom: 96,
    gap: 10,
  },
  bigGlyph: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 4,
  },
  modesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  modeGlyph: {
    fontSize: 30,
    textAlign: 'center',
    marginBottom: 12,
  },
  modeDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    alignSelf: 'stretch',
    opacity: 0.4,
  },
  cta: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  skipBtn: {
    marginTop: 10,
    paddingVertical: 8,
  },
  pagination: {
    position: 'absolute',
    bottom: 36,
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  nextBtn: {
    paddingVertical: 4,
  },
});

export default OnboardingScreen;
