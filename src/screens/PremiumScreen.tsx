import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useI18n, type TranslationKey } from '@i18n/I18nProvider';
import { useQuotaStore } from '@stores/quotaStore';
import { usePurchase, type PurchasePlan } from '@hooks/usePurchase';
import type { RootStackParamList } from '@navigation/types';
import StarfieldBackground from '@components/StarfieldBackground';

const KHASS_GOLD = '#B8952A';

type PlanKey = 'mureed' | 'khass';
type BillingPeriod = 'monthly' | 'annual';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Static plan config. Prices are currency amounts that must match the Play
 * Store billing setup, so they are NOT localized. All plan *text* (title,
 * subtitle, features) is resolved through t() at render time.
 */
interface PlanConfig {
  key: PlanKey;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  monthlyPrice: string;
  annualPrice: string;
  featureKeys: readonly TranslationKey[];
  badge?: string;
}

const PLANS: readonly PlanConfig[] = [
  {
    key: 'mureed',
    titleKey: 'premium.mureedTitle',
    subtitleKey: 'premium.mureedSubtitle',
    monthlyPrice: '₹249',
    annualPrice: '₹2,490',
    featureKeys: [
      'premium.mureedFeature1',
      'premium.mureedFeature2',
      'premium.mureedFeature3',
      'premium.mureedFeature4',
      'premium.mureedFeature5',
    ],
  },
  {
    key: 'khass',
    titleKey: 'premium.khassTitle',
    subtitleKey: 'premium.khassSubtitle',
    monthlyPrice: '₹699',
    annualPrice: '₹6,990',
    featureKeys: [
      'premium.khassFeature1',
      'premium.khassFeature2',
      'premium.khassFeature3',
      'premium.khassFeature4',
      'premium.khassFeature5',
    ],
    badge: '★',
  },
];

const PremiumScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const { t } = useI18n();

  const trialExpired = useQuotaStore(s => s.trialExpired);
  const { purchase, restore, purchasing } = usePurchase();

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('mureed');
  const [billing, setBilling] = useState<Record<PlanKey, BillingPeriod>>({
    mureed: 'monthly',
    khass: 'monthly',
  });

  const handleBillingToggle = useCallback((plan: PlanKey, period: BillingPeriod) => {
    setBilling(prev => ({ ...prev, [plan]: period }));
  }, []);

  const handleCta = useCallback(async () => {
    const planKey: PurchasePlan = `${selectedPlan}_${billing[selectedPlan]}`;
    const result = await purchase(planKey);
    if (result.success) {
      navigation.goBack();
    } else if (result.reason === 'already_active') {
      navigation.goBack();
    } else if (result.reason !== 'user_cancelled') {
      Alert.alert(t('premium.errorTitle'), t('premium.paymentFailed'));
    }
  }, [purchase, navigation, selectedPlan, billing, t]);

  const handleRestore = useCallback(async () => {
    const result = await restore();
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert(t('premium.restoreTitle'), t('premium.noPurchases'));
    }
  }, [restore, navigation, t]);

  const headerTitle = trialExpired
    ? t('premium.headerTitleExpired')
    : t('premium.headerTitleDefault');
  const headerSubtitle = trialExpired
    ? t('premium.headerSubtitleExpired')
    : t('premium.headerSubtitleDefault');

  const ctaLabel = selectedPlan === 'mureed' ? t('premium.ctaMureed') : t('premium.ctaKhass');

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

      {/* Header */}
      <View
        style={[
          styles.header,
          { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={[typography('body'), { color: colors.accent }]}>{'←'}</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text
            style={[typography('subheading'), { color: colors.goldBright, textAlign: 'center' }]}
          >
            {headerTitle}
          </Text>
          <Text
            style={[
              typography('caption'),
              { color: colors.textMuted, textAlign: 'center', marginTop: 4 },
            ]}
          >
            {headerSubtitle}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 7-day trial banner */}
        {!trialExpired && (
          <View
            style={[
              styles.trialBanner,
              {
                backgroundColor: colors.manuscriptFog,
                borderColor: colors.borderAccent,
              },
            ]}
          >
            <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 1 }]}>
              ✦
            </Text>
            <Text
              style={[
                typography('label'),
                { color: colors.goldBright, letterSpacing: 1.2, marginHorizontal: 8 },
              ]}
            >
              {t('premium.trialBanner')}
            </Text>
            <Text style={[typography('caption'), { color: colors.textFaint, letterSpacing: 1 }]}>
              ✦
            </Text>
          </View>
        )}

        {/* Plan cards row */}
        <View style={styles.cardsRow}>
          {PLANS.map(plan => {
            const isSelected = selectedPlan === plan.key;
            const isKhass = plan.key === 'khass';
            const borderColor = isKhass ? KHASS_GOLD : isSelected ? colors.accent : colors.border;
            const borderWidth = isSelected || isKhass ? 1.5 : StyleSheet.hairlineWidth;
            const currentBilling = billing[plan.key];
            const priceAmount = currentBilling === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const pricePeriod =
              currentBilling === 'monthly' ? t('premium.perMonth') : t('premium.perYear');
            const priceLabel = `${priceAmount}${pricePeriod}`;
            const planTitle = t(plan.titleKey);

            return (
              <Pressable
                key={plan.key}
                onPress={() => setSelectedPlan(plan.key)}
                style={[
                  styles.card,
                  isKhass && styles.cardKhass,
                  {
                    backgroundColor: isKhass ? colors.surfaceElevated : colors.surface,
                    borderColor,
                    borderWidth,
                    shadowColor: isKhass ? KHASS_GOLD : colors.border,
                    shadowOpacity: isKhass ? 0.45 : 0.1,
                    shadowRadius: isKhass ? 14 : 4,
                    shadowOffset: { width: 0, height: isKhass ? 6 : 2 },
                    elevation: isKhass ? 8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('premium.selectPlanLabel', { plan: planTitle })}
              >
                {/* Title row */}
                <View style={styles.titleRow}>
                  <Text
                    style={[typography('heading'), { color: isKhass ? KHASS_GOLD : colors.text }]}
                  >
                    {planTitle}
                  </Text>
                  {plan.badge !== undefined && (
                    <Text style={[typography('body'), { color: KHASS_GOLD, marginLeft: 6 }]}>
                      {plan.badge}
                    </Text>
                  )}
                </View>
                <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                  {t(plan.subtitleKey)}
                </Text>

                {/* Price */}
                <Text
                  style={[
                    typography('title'),
                    {
                      color: isKhass ? KHASS_GOLD : colors.text,
                      fontSize: 20,
                      marginBottom: 2,
                    },
                  ]}
                >
                  {priceLabel}
                </Text>
                {currentBilling === 'annual' && (
                  <Text
                    style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}
                  >
                    ({t('premium.annualSaveNote')})
                  </Text>
                )}

                {/* Billing toggle */}
                <View style={styles.billingRow}>
                  {(['monthly', 'annual'] as BillingPeriod[]).map(period => {
                    const active = currentBilling === period;
                    return (
                      <Pressable
                        key={period}
                        onPress={() => handleBillingToggle(plan.key, period)}
                        style={[
                          styles.billingPill,
                          {
                            backgroundColor: active
                              ? isKhass
                                ? KHASS_GOLD
                                : colors.primary
                              : colors.bg,
                            borderColor: isKhass ? KHASS_GOLD : colors.border,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t('premium.billingLabel', {
                          period:
                            period === 'monthly'
                              ? t('premium.billingMonthly')
                              : t('premium.billingAnnual'),
                          plan: planTitle,
                        })}
                      >
                        <Text
                          style={[
                            typography('caption'),
                            {
                              color: active ? colors.textOnPrimary : colors.textMuted,
                              fontSize: 11,
                            },
                          ]}
                        >
                          {period === 'monthly'
                            ? t('premium.billingMonthly')
                            : t('premium.billingAnnual')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Feature list */}
                <View style={styles.features}>
                  {plan.featureKeys.map(featKey => (
                    <View key={featKey} style={styles.featureRow}>
                      <Text
                        style={[
                          typography('caption'),
                          {
                            color: isKhass ? KHASS_GOLD : colors.positive,
                            marginRight: 6,
                            fontSize: 11,
                          },
                        ]}
                      >
                        ✓
                      </Text>
                      <Text
                        style={[
                          typography('caption'),
                          { color: colors.text, flex: 1, fontSize: 12 },
                        ]}
                      >
                        {t(featKey)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Selection indicator */}
                {isSelected && (
                  <View
                    style={[
                      styles.selectedDot,
                      { backgroundColor: isKhass ? KHASS_GOLD : colors.accent },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleCta}
          disabled={purchasing}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: selectedPlan === 'khass' ? KHASS_GOLD : colors.primary,
              opacity: pressed || purchasing ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
            {purchasing ? t('premium.processing') : ctaLabel}
          </Text>
        </Pressable>

        {/* Restore */}
        <Pressable
          onPress={handleRestore}
          style={styles.restoreBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('premium.restorePurchase')}
        >
          <Text style={[typography('caption'), { color: colors.textFaint, textAlign: 'center' }]}>
            {t('premium.restorePurchase')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  backBtn: { width: 40 },
  headerTextWrap: { flex: 1, paddingHorizontal: 8 },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    gap: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardKhass: {
    paddingTop: 24,
    paddingBottom: 22,
    flex: 1.05,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  billingPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF06',
  },
  features: {
    gap: 6,
    marginTop: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
  },
  cta: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  restoreBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default PremiumScreen;
