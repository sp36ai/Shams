import React, { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useColors } from '@theme/ThemeProvider';
import { useSettingsStore } from '@stores/settingsStore';
import { isLocationUsable, requestLocationPermission } from '@utils/permissions';

const { width } = Dimensions.get('window');

const OnboardingScreen: React.FC = () => {
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const markOnboardingComplete = useSettingsStore(s => s.markOnboardingComplete);
  const markLocationPrompted = useSettingsStore(s => s.markLocationPrompted);
  const setPermissionGranted = useSettingsStore(s => s.setPermissionGranted);

  const gold = colors.accent;
  const dim = colors.textMuted;
  const slideStyle = { backgroundColor: colors.surfaceElevated, borderColor: colors.border };

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Slide 1: Welcome */}
        <View style={[styles.slide, slideStyle]}>
          <View style={[styles.slideMarker, { backgroundColor: colors.accent }]} />
          <Text style={[styles.arabicTitle, { color: gold }]}>شمس الأسرار</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>The Oracle of Hidden Stars</Text>
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            Ancient wisdom. Astronomical precision.
          </Text>
          <Text style={[styles.star, { color: gold }]}>✦</Text>
        </View>

        {/* Slide 2: Two Modes */}
        <View style={[styles.slide, slideStyle]}>
          <View style={styles.slideMarker} />
          <View style={styles.modesContainer}>
            <View style={[styles.modeHalf, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
              <Text style={styles.modeIcon}>⌚</Text>
              <Text style={[styles.modeTitle, { color: colors.text }]}>Digital Watch RKP</Text>
              <Text style={[styles.modeText, { color: colors.textMuted }]}> 
                Instant readings from the digits on your clock
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={[styles.modeHalf, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
              <Text style={styles.modeIcon}>🔭</Text>
              <Text style={[styles.modeTitle, { color: colors.text }]}>Astronomical RKP</Text>
              <Text style={[styles.modeText, { color: colors.textMuted }]}>
                Full sub-lord precision using Swiss Ephemeris math
              </Text>
            </View>
          </View>
        </View>

        {/* Slide 3: Location Permission */}
        <View style={[styles.slide, slideStyle]}>
          <View style={styles.slideMarker} />
          <Text style={[styles.modeIcon, { color: gold }]}>◎</Text>
          <Text style={[styles.title, { color: gold }]}>Enable Location</Text>
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            Required for Planetary Hora — the GPS-based hora lord calculation that powers your
            Digital Watch readings.
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: gold }]}
            onPress={() => void handleRequestLocation()}
          >
            <Text style={[styles.ctaText, { color: colors.bg }]}>Allow Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipLink} onPress={handleNext}>
            <Text style={[styles.skipText, { color: dim }]}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        {/* Slide 4: Ready */}
        <View style={[styles.slide, slideStyle]}>
          <View style={styles.slideMarker} />
          <Text style={[styles.star, { color: gold }]}>✦</Text>
          <Text style={[styles.title, { color: gold }]}>Your oracle is ready.</Text>
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            Ask your first question.
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: gold }]}
            onPress={handleFinish}
          >
            <Text style={[styles.ctaText, { color: colors.bg }]}>Enter Shams-Al-Asrār</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.pagination}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? gold : dim }]} />
        ))}
        {activeIndex < 3 && (
          <TouchableOpacity style={styles.nextArrow} onPress={handleNext}>
            <Text style={[styles.nextText, { color: gold }]}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 28 },
  slide: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    paddingTop: 48,
    gap: 18,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  slideMarker: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.85,
  },
  arabicTitle: {
    fontSize: 38,
    fontFamily: 'Amiri-Regular',
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Cairo-Regular',
    marginTop: 10,
    letterSpacing: 0.4,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 26,
    maxWidth: 320,
  },
  star: { fontSize: 40, marginTop: 40 },
  modesContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeHalf: {
    flex: 1,
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff22',
    backgroundColor: '#ffffff08',
  },
  modeIcon: { fontSize: 36, marginBottom: 16 },
  modeTitle: { fontSize: 14, fontFamily: 'Cairo-Bold', textAlign: 'center' },
  modeText: { fontSize: 12, fontFamily: 'Cairo-Regular', textAlign: 'center', marginTop: 10, lineHeight: 18 },
  divider: { width: 1, height: 100, backgroundColor: '#ffffff12' },
  title: { fontSize: 26, fontFamily: 'Cinzel-Regular', textAlign: 'center', letterSpacing: 0.8 },
  ctaButton: {
    marginTop: 40,
    paddingVertical: 16,
    paddingHorizontal: 34,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  ctaText: { fontSize: 16, fontFamily: 'Cairo-SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  skipLink: { marginTop: 16 },
  skipText: { fontSize: 12, fontFamily: 'Cairo-Regular', letterSpacing: 0.8 },
  pagination: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginHorizontal: 5 },
  nextArrow: { position: 'absolute', right: 30 },
  nextText: { fontSize: 14, fontFamily: 'Cairo-Regular', letterSpacing: 1 },
});

export default OnboardingScreen;
