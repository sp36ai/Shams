import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import functions, { type FirebaseFunctionsTypes } from '@react-native-firebase/functions';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useI18n, type TranslationKey } from '@i18n/I18nProvider';
import StarfieldBackground from '@components/StarfieldBackground';
import { useSettingsStore, type SeekerProfile } from '@stores/settingsStore';

type FunctionsWithRegion = FirebaseFunctionsTypes.Module & {
  region(r: string): FirebaseFunctionsTypes.Module;
};

// ── Question definitions ──────────────────────────────────────────────────────

interface Choice {
  /** Display label key — resolved through t() at render. */
  labelKey: TranslationKey;
  /**
   * Canonical English answer text sent to inferProfile. Language-independent
   * on purpose: the seeker's classification must not depend on UI language.
   */
  answerEn: string;
  signal: SeekerProfile;
}

interface Question {
  eyebrowKey: TranslationKey;
  textKey: TranslationKey;
  choices: Choice[];
}

const QUESTIONS: Question[] = [
  {
    eyebrowKey: 'onboarding.q1Eyebrow',
    textKey: 'onboarding.q1Text',
    choices: [
      {
        labelKey: 'onboarding.q1c1',
        answerEn: 'I face a decision and need clarity',
        signal: 'clarity',
      },
      {
        labelKey: 'onboarding.q1c2',
        answerEn: 'I carry something heavy and need guidance',
        signal: 'comfort',
      },
      {
        labelKey: 'onboarding.q1c3',
        answerEn: 'I am planning something and need direction',
        signal: 'action',
      },
      {
        labelKey: 'onboarding.q1c4',
        answerEn: 'I seek to understand what Allah wills',
        signal: 'surrender',
      },
    ],
  },
  {
    eyebrowKey: 'onboarding.q2Eyebrow',
    textKey: 'onboarding.q2Text',
    choices: [
      {
        labelKey: 'onboarding.q2c1',
        answerEn: 'Directly — I want clear answers',
        signal: 'clarity',
      },
      {
        labelKey: 'onboarding.q2c2',
        answerEn: 'Gently — I am in a tender place',
        signal: 'comfort',
      },
      {
        labelKey: 'onboarding.q2c3',
        answerEn: 'Practically — I need actionable guidance',
        signal: 'action',
      },
      {
        labelKey: 'onboarding.q2c4',
        answerEn: 'Spiritually — I want depth over direction',
        signal: 'surrender',
      },
    ],
  },
  {
    eyebrowKey: 'onboarding.q3Eyebrow',
    textKey: 'onboarding.q3Text',
    choices: [
      { labelKey: 'onboarding.q3c1', answerEn: 'Before important choices', signal: 'clarity' },
      {
        labelKey: 'onboarding.q3c2',
        answerEn: 'In moments of uncertainty or pain',
        signal: 'comfort',
      },
      { labelKey: 'onboarding.q3c3', answerEn: 'When I am planning or building', signal: 'action' },
      {
        labelKey: 'onboarding.q3c4',
        answerEn: 'In quiet moments of reflection',
        signal: 'surrender',
      },
    ],
  },
];

// ── Profile inference (via Cloud Function) ───────────────────────────────────

const VALID_PROFILES = new Set<SeekerProfile>(['clarity', 'comfort', 'action', 'surrender']);

async function inferProfile(answers: [string, string, string]): Promise<SeekerProfile> {
  try {
    const fn = (functions() as FunctionsWithRegion)
      .region('asia-south1')
      .httpsCallable<{ answers: string[] }, { profile: string }>('inferProfile');

    const result = await fn({ answers });
    const profile = result.data?.profile as SeekerProfile;

    return VALID_PROFILES.has(profile) ? profile : 'clarity';
  } catch {
    return 'clarity';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  const markOnboardingComplete = useSettingsStore(s => s.markOnboardingComplete);
  const setSeekerProfile = useSettingsStore(s => s.setSeekerProfile);

  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [inferring, setInferring] = useState(false);
  const [profile, setProfile] = useState<SeekerProfile | null>(null);

  const advanceTo = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
      setActiveIndex(index);
    },
    [width],
  );

  const handleChoiceQ1Q2 = useCallback(
    (choice: Choice, qIndex: number) => {
      setAnswers(prev => {
        const next = [...prev];
        next[qIndex] = choice.answerEn;
        return next;
      });
      setTimeout(() => advanceTo(qIndex + 1), 220);
    },
    [advanceTo],
  );

  const handleChoiceQ3 = useCallback(
    async (choice: Choice) => {
      const finalAnswers: [string, string, string] = [
        answers[0] ?? '',
        answers[1] ?? '',
        choice.answerEn,
      ];
      setAnswers(prev => {
        const n = [...prev];
        n[2] = choice.answerEn;
        return n;
      });
      setInferring(true);

      const inferred = await inferProfile(finalAnswers);
      setSeekerProfile(inferred, finalAnswers);
      setProfile(inferred);
      setInferring(false);
    },
    [answers, setSeekerProfile],
  );

  const handleEnter = useCallback(() => {
    markOnboardingComplete();
  }, [markOnboardingComplete]);

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
        scrollEnabled={false}
        scrollEventThrottle={16}
        style={styles.slider}
      >
        {QUESTIONS.map((q, qIndex) => (
          <View key={qIndex} style={[styles.slide, { width }]}>
            {/* Brand header on first question only */}
            {qIndex === 0 && (
              <>
                <Text
                  style={[
                    typography('caption'),
                    { color: colors.textFaint, letterSpacing: 2.5, marginBottom: 4 },
                  ]}
                >
                  {t('onboarding.bismillah')}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Amiri-Regular',
                    fontSize: 38,
                    color: colors.goldBright,
                    textAlign: 'center',
                    lineHeight: 48,
                    marginBottom: 4,
                  }}
                >
                  {'شمس الأسرار'}
                </Text>
                <OrnamentRow colors={colors} />
              </>
            )}

            <Text
              style={[
                typography('caption'),
                {
                  color: colors.textFaint,
                  letterSpacing: 2,
                  marginBottom: 6,
                  marginTop: qIndex === 0 ? 8 : 0,
                },
              ]}
            >
              {t(q.eyebrowKey)}
            </Text>
            <Text
              style={[
                typography('subheading'),
                { color: colors.text, textAlign: 'center', letterSpacing: 0.4, marginBottom: 20 },
              ]}
            >
              {t(q.textKey)}
            </Text>

            {/* Choice cards */}
            <View style={styles.choicesContainer}>
              {q.choices.map((choice, cIndex) => {
                const isLast = qIndex === 2;
                const onPress = isLast
                  ? () => {
                      void handleChoiceQ3(choice);
                    }
                  : () => handleChoiceQ1Q2(choice, qIndex);

                return (
                  <Pressable
                    key={cIndex}
                    onPress={onPress}
                    disabled={inferring || profile !== null}
                    style={({ pressed }) => [
                      styles.choiceCard,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography('body'),
                        { color: colors.text, textAlign: 'center', lineHeight: 22 },
                      ]}
                    >
                      {t(choice.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Q3 completion state */}
            {qIndex === 2 && (
              <View style={styles.completionArea}>
                {inferring && <ActivityIndicator color={colors.goldBright} size="small" />}
                {!inferring && profile !== null && (
                  <Pressable
                    testID="onboarding-enter-btn"
                    onPress={handleEnter}
                    style={({ pressed }) => [
                      styles.cta,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
                      {t('onboarding.enterApp')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map(i => (
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 96,
    gap: 0,
  },
  choicesContainer: {
    width: '100%',
    gap: 10,
  },
  choiceCard: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  completionArea: {
    marginTop: 28,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  cta: {
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
  pagination: {
    position: 'absolute',
    bottom: 36,
    width: '100%',
    alignItems: 'center',
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
});

export default OnboardingScreen;
