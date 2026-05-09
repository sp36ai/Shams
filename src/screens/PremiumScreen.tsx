import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import functions from '@react-native-firebase/functions';

import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useTranslation } from '@i18n/I18nProvider';
import { useQuotaStore, type PlanTier } from '@stores/quotaStore';
import type { RootStackParamList } from '@navigation/types';
import StarfieldBackground from '@components/StarfieldBackground';
import { GlowView } from '@components/GlowView';
import ShimmerOverlay from '@components/ShimmerOverlay';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* -------------------------------------------------------------------------- */
/*  Tier definitions                                                           */
/* -------------------------------------------------------------------------- */

type Feature =
  | 'unlimited_questions'
  | 'full_history'
  | 'remedies'
  | 'pdf_export'
  | 'priority_windows'
  | 'strategic_sessions';

interface TierDef {
  plan: PlanTier;
  titleKey: 'premium.tierStarter' | 'premium.tierPremium' | 'premium.tierConsultation';
  priceKey: 'premium.starterPrice' | 'premium.premiumPrice' | 'premium.consultationPrice';
  periodKey: 'premium.starterPeriod' | 'premium.premiumPeriod' | 'premium.consultationPeriod';
  descKey:
    | 'premium.starterDescription'
    | 'premium.premiumDescription'
    | 'premium.consultationDescription';
  features: Feature[];
  highlighted: boolean;
}

const TIERS: TierDef[] = [
  {
    plan: 'starter',
    titleKey: 'premium.tierStarter',
    priceKey: 'premium.starterPrice',
    periodKey: 'premium.starterPeriod',
    descKey: 'premium.starterDescription',
    features: ['unlimited_questions'],
    highlighted: false,
  },
  {
    plan: 'premium',
    titleKey: 'premium.tierPremium',
    priceKey: 'premium.premiumPrice',
    periodKey: 'premium.premiumPeriod',
    descKey: 'premium.premiumDescription',
    features: ['unlimited_questions', 'full_history', 'remedies'],
    highlighted: true,
  },
  {
    plan: 'consultation',
    titleKey: 'premium.tierConsultation',
    priceKey: 'premium.consultationPrice',
    periodKey: 'premium.consultationPeriod',
    descKey: 'premium.consultationDescription',
    features: [
      'unlimited_questions',
      'full_history',
      'remedies',
      'pdf_export',
      'priority_windows',
      'strategic_sessions',
    ],
    highlighted: false,
  },
];

const FEATURE_KEYS: Record<Feature, string> = {
  unlimited_questions: 'premium.feature_unlimited_questions',
  full_history: 'premium.feature_full_history',
  remedies: 'premium.feature_remedies',
  pdf_export: 'premium.feature_pdf_export',
  priority_windows: 'premium.feature_priority_windows',
  strategic_sessions: 'premium.feature_strategic_sessions',
};

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

const PremiumScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();

  const currentPlan = useQuotaStore(s => s.plan);
  const setPlan = useQuotaStore(s => s.setPlan);

  const handleSelect = useCallback(
    async (plan: PlanTier) => {
      if (plan === currentPlan) {
        return;
      }
      try {
        const fn = functions().httpsCallable('verifyGooglePlayPurchase');
        const result = await fn({ purchaseToken: 'dummy_token', productId: plan });
        const data = result.data as { success: boolean } | null;
        if (data && data.success) {
          setPlan(plan);
          navigation.goBack();
        }
      } catch (e) {
        Alert.alert(t('common.error') ?? 'Error', 'Payment verification failed');
      }
    },
    [currentPlan, setPlan, navigation, t],
  );

  const handleRestore = useCallback(() => {
    Alert.alert(t('premium.restorePurchase'), '', [{ text: t('common.ok') }]);
  }, [t]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* Deep-space backdrop */}
      <StarfieldBackground
        starColor={colors.starfield}
        nebula1={colors.nebula1}
        nebula2={colors.nebula2}
        nebula3={colors.nebula3}
      />

      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[typography('body'), { color: colors.accent }]}>{'←'}</Text>
        </Pressable>
        <Text
          style={[typography('subheading'), { color: colors.text, flex: 1, textAlign: 'center' }]}
        >
          {t('premium.headerTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, textAlign: 'center', marginBottom: 24, letterSpacing: 0.5 },
          ]}
        >
          {t('premium.subheading')}
        </Text>

        {TIERS.map(tier => (
          <TierCard
            key={tier.plan}
            tier={tier}
            isCurrent={tier.plan === currentPlan}
            onSelect={handleSelect}
            colors={colors}
            typography={typography}
            t={t}
          />
        ))}

        <Text
          style={[
            typography('caption'),
            { color: colors.textFaint, textAlign: 'center', marginTop: 8 },
          ]}
        >
          {t('premium.moneyBackPromise')}
        </Text>

        <Pressable onPress={handleRestore} style={styles.restoreBtn} hitSlop={8}>
          <Text style={[typography('caption'), { color: colors.accent, textAlign: 'center' }]}>
            {t('premium.restorePurchase')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

/* -------------------------------------------------------------------------- */
/*  TierCard                                                                  */
/* -------------------------------------------------------------------------- */

interface TierCardProps {
  tier: TierDef;
  isCurrent: boolean;
  onSelect: (plan: PlanTier) => void;
  colors: ReturnType<typeof useColors>;
  typography: ReturnType<typeof useTypography>;
  t: ReturnType<typeof useTranslation>;
}

const TierCard: React.FC<TierCardProps> = ({
  tier,
  isCurrent,
  onSelect,
  colors,
  typography,
  t,
}) => {
  const [cardWidth, setCardWidth] = useState(0);

  const borderColor = tier.highlighted
    ? colors.accent
    : isCurrent
      ? colors.positive
      : colors.border;

  const ctaLabel = isCurrent ? t('premium.currentPlan') : t('premium.selectPlan');
  const ctaBg = isCurrent
    ? colors.surfaceElevated
    : tier.highlighted
      ? colors.primary
      : colors.surface;
  const ctaTextColor = isCurrent
    ? colors.textMuted
    : tier.highlighted
      ? colors.textOnPrimary
      : colors.accent;

  const cardContent = (
    <View
      onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor,
          borderWidth: tier.highlighted || isCurrent ? 1.5 : StyleSheet.hairlineWidth,
          // iOS colored shadow for all cards
          shadowColor: tier.highlighted ? colors.accent : colors.border,
          shadowRadius: tier.highlighted ? 0 : 4,
          shadowOpacity: tier.highlighted ? 0 : 0.3,
          shadowOffset: { width: 0, height: 2 },
          elevation: tier.highlighted ? 0 : 2,
        },
      ]}
    >
      {/* Recommended badge */}
      {tier.highlighted && (
        <View style={[styles.badge, { backgroundColor: colors.accent + 'EE' }]}>
          <Text style={[typography('caption'), { color: colors.textOnPrimary, letterSpacing: 1 }]}>
            ✦ RECOMMENDED
          </Text>
        </View>
      )}

      {/* Tier name */}
      <Text style={[typography('heading'), { color: colors.text }]}>{t(tier.titleKey)}</Text>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text
          style={[
            typography('title'),
            {
              color: tier.highlighted ? colors.accent : colors.text,
              fontSize: tier.highlighted ? 34 : 28,
            },
          ]}
        >
          {t(tier.priceKey)}
        </Text>
        <Text
          style={[
            typography('caption'),
            { color: colors.textMuted, marginLeft: 6, alignSelf: 'flex-end', marginBottom: 4 },
          ]}
        >
          {t(tier.periodKey)}
        </Text>
      </View>

      {/* Description */}
      <Text style={[typography('body'), { color: colors.textMuted, marginBottom: 16 }]}>
        {t(tier.descKey)}
      </Text>

      {/* Feature list */}
      <View style={styles.features}>
        {tier.features.map(feat => (
          <View key={feat} style={styles.featureRow}>
            <Text
              style={[
                typography('caption'),
                {
                  color: tier.highlighted ? colors.accent : colors.positive,
                  marginRight: 10,
                  fontSize: tier.highlighted ? 13 : 12,
                },
              ]}
            >
              {tier.highlighted ? '✦' : '✓'}
            </Text>
            <Text style={[typography('caption'), { color: colors.text, flex: 1 }]}>
              {t(FEATURE_KEYS[feat] as Parameters<typeof t>[0])}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA — shimmer on highlighted tier */}
      <View style={[styles.ctaWrap, { overflow: 'hidden', borderRadius: 12 }]}>
        <Pressable
          onPress={() => onSelect(tier.plan)}
          disabled={isCurrent}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: ctaBg,
              borderColor,
              borderWidth: isCurrent ? 0 : 1,
              transform: [{ scale: pressed ? 0.975 : 1 }],
              shadowColor: tier.highlighted ? colors.accent : 'transparent',
              shadowRadius: 8,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 3 },
              elevation: tier.highlighted ? 4 : 0,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${ctaLabel} ${t(tier.titleKey)}`}
        >
          <Text style={[typography('button'), { color: ctaTextColor, letterSpacing: 0.5 }]}>
            {ctaLabel}
          </Text>
        </Pressable>
        {tier.highlighted && !isCurrent && (
          <ShimmerOverlay width={cardWidth} periodMs={2800} color="rgba(255,255,255,0.12)" />
        )}
      </View>
    </View>
  );

  if (tier.highlighted) {
    return (
      <GlowView
        glowColor={colors.accent}
        glowRadius={18}
        borderRadius={16}
        pulsing
        style={styles.glowWrap}
      >
        {cardContent}
      </GlowView>
    );
  }

  return cardContent;
};

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  glowWrap: {
    marginHorizontal: 0,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 8,
    overflow: 'hidden',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  features: {
    gap: 8,
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ctaWrap: {
    marginTop: 4,
  },
  cta: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  restoreBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default PremiumScreen;
