import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useQuotaStore } from '@stores/quotaStore';
import { usePurchase, type PurchasePlan } from '@hooks/usePurchase';
import type { RootStackParamList } from '@navigation/types';
import StarfieldBackground from '@components/StarfieldBackground';

const KHASS_GOLD = '#B8952A';

type PlanKey = 'mureed' | 'khass';
type BillingPeriod = 'monthly' | 'annual';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PlanCard {
  key: PlanKey;
  title: string;
  subtitle: string;
  monthlyPrice: string;
  annualPrice: string;
  annualNote: string;
  features: string[];
  badge?: string;
}

const PLANS: PlanCard[] = [
  {
    key: 'mureed',
    title: 'MUREED',
    subtitle: 'Disciple',
    monthlyPrice: '₹249/month',
    annualPrice: '₹2,490/year',
    annualNote: 'save 2 months',
    features: [
      '3 questions/day',
      'Astronomical mode',
      'Full history',
      'Timing windows',
      'Remedies',
    ],
  },
  {
    key: 'khass',
    title: 'KHASS',
    subtitle: 'The Chosen',
    monthlyPrice: '₹699/month',
    annualPrice: '₹6,990/year',
    annualNote: 'save 2 months',
    features: [
      'Unlimited',
      'Both oracle modes',
      'Confidence detail',
      'PDF reports',
      'Priority synthesis',
    ],
    badge: '★',
  },
];

const PremiumScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();

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
    } else if (result.reason !== 'already_active') {
      Alert.alert('Error', 'Payment verification failed. Please try again.');
    }
  }, [purchase, navigation, selectedPlan, billing]);

  const handleRestore = useCallback(async () => {
    await restore();
    Alert.alert('Restore', 'No active purchases found on this account.');
  }, [restore]);

  const headerTitle = trialExpired
    ? 'Your 7-day journey has ended.'
    : 'Choose Your Path';
  const headerSubtitle = trialExpired
    ? 'The stars are still watching. Continue receiving their guidance.'
    : "Unlock the full depth of the Oracle's wisdom.";

  const ctaLabel =
    selectedPlan === 'mureed' ? 'Begin with Mureed' : 'Begin with Khass';

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
        <View style={styles.headerTextWrap}>
          <Text style={[typography('subheading'), { color: colors.text, textAlign: 'center' }]}>
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
        {/* Plan cards row */}
        <View style={styles.cardsRow}>
          {PLANS.map(plan => {
            const isSelected = selectedPlan === plan.key;
            const isKhass = plan.key === 'khass';
            const borderColor = isKhass ? KHASS_GOLD : isSelected ? colors.accent : colors.border;
            const borderWidth = isSelected || isKhass ? 1.5 : StyleSheet.hairlineWidth;
            const currentBilling = billing[plan.key];
            const priceLabel =
              currentBilling === 'monthly' ? plan.monthlyPrice : plan.annualPrice;

            return (
              <Pressable
                key={plan.key}
                onPress={() => setSelectedPlan(plan.key)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor,
                    borderWidth,
                    shadowColor: isKhass ? KHASS_GOLD : colors.border,
                    shadowOpacity: isKhass ? 0.3 : 0.1,
                    shadowRadius: isKhass ? 8 : 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: isKhass ? 4 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${plan.title} plan`}
              >
                {/* Title row */}
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      typography('heading'),
                      { color: isKhass ? KHASS_GOLD : colors.text },
                    ]}
                  >
                    {plan.title}
                  </Text>
                  {plan.badge !== undefined && (
                    <Text
                      style={[
                        typography('body'),
                        { color: KHASS_GOLD, marginLeft: 6 },
                      ]}
                    >
                      {plan.badge}
                    </Text>
                  )}
                </View>
                <Text style={[typography('caption'), { color: colors.textMuted, marginBottom: 8 }]}>
                  {plan.subtitle}
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
                    style={[
                      typography('caption'),
                      { color: colors.textMuted, marginBottom: 8 },
                    ]}
                  >
                    ({plan.annualNote})
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
                              ? isKhass ? KHASS_GOLD : colors.primary
                              : colors.bg,
                            borderColor: isKhass ? KHASS_GOLD : colors.border,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${period} billing for ${plan.title}`}
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
                          {period === 'monthly' ? 'Monthly' : 'Annual'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Feature list */}
                <View style={styles.features}>
                  {plan.features.map(feat => (
                    <View key={feat} style={styles.featureRow}>
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
                        style={[typography('caption'), { color: colors.text, flex: 1, fontSize: 12 }]}
                      >
                        {feat}
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
            {purchasing ? 'Processing…' : ctaLabel}
          </Text>
        </Pressable>

        {/* Restore */}
        <Pressable onPress={handleRestore} style={styles.restoreBtn} hitSlop={8}>
          <Text style={[typography('caption'), { color: colors.textFaint, textAlign: 'center' }]}>
            Restore previous purchase
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
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 0,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  billingRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  billingPill: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  features: {
    gap: 5,
    marginTop: 4,
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
    borderRadius: 14,
    alignItems: 'center',
  },
  restoreBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default PremiumScreen;
