import React, { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, useTheme } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { useQuotaStore } from '@stores/quotaStore';
import { usePurchase } from '@hooks/usePurchase';
import type { RootStackParamList } from '@navigation/types';
import StarfieldBackground from '@components/StarfieldBackground';
import Button from '@components/ui/Button';
import BrandFooter from '@components/ui/BrandFooter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The plans as sold from 2026-10-14 (owner decision). Only features that
 * exist are listed. The price is shown as text; Google Play shows the
 * charged price at checkout.
 */
const PREMIUM_FEATURES = [
  'Unlimited questions (fair use: 10 a day)',
  'Both premium themes: Qamar al-Fiḍḍa and Zumurrud al-Malakūt',
  'Discussion after a verdict, paid with coins (1 coin per 10,000 tokens)',
];

const FREE_FEATURES = [
  '1 free question every 7 days (verdict)',
  'Extra question: 3 coins (₹30)',
  'Discussion after a verdict, paid with coins',
];

const PremiumScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const colors = useColors();
  const typography = useTypography();

  const plan = useQuotaStore(s => s.plan);
  const { purchase, restore, purchasing } = usePurchase();

  const handleCta = useCallback(async () => {
    const result = await purchase('premium_monthly');
    if (result.success) {
      navigation.goBack();
    } else if (result.reason === 'already_active') {
      navigation.goBack();
    } else if (result.reason !== 'user_cancelled') {
      Alert.alert('Error', 'Payment verification failed. Please try again.');
    }
  }, [purchase, navigation]);

  const handleRestore = useCallback(async () => {
    const result = await restore();
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Restore', 'No active purchases found on this account.');
    }
  }, [restore, navigation]);

  const isPremium = plan !== 'free';
  const featureRow = (feat: string, tick: string): React.JSX.Element => (
    <View key={feat} style={styles.featureRow}>
      <Text style={[typography('caption'), { color: tick, marginRight: 8 }]}>✓</Text>
      <Text style={[typography('caption'), { color: colors.text, flex: 1, fontSize: 13 }]}>
        {feat}
      </Text>
    </View>
  );

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
          accessibilityLabel="Go back"
        >
          <Text style={[typography('body'), { color: colors.accent }]}>{'←'}</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text
            style={[typography('subheading'), { color: colors.goldBright, textAlign: 'center' }]}
          >
            {'The sanctum opens its doors.'}
          </Text>
          <Text
            style={[
              typography('caption'),
              { color: colors.textMuted, textAlign: 'center', marginTop: 4 },
            ]}
          >
            {'Unlimited questions, both premium themes.'}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Premium */}
        <View
          testID="premium-plan"
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderAccent,
              shadowColor: colors.gold,
            },
          ]}
        >
          <Text style={[typography('heading'), { color: colors.goldBright }]}>PREMIUM ★</Text>
          <Text style={[typography('title'), styles.price, { color: colors.goldBright }]}>
            ₹299/month
          </Text>
          <View style={styles.features}>
            {PREMIUM_FEATURES.map(f => featureRow(f, colors.goldBright))}
          </View>
        </View>

        {/* Free, for comparison */}
        <View
          testID="free-plan"
          style={[
            styles.card,
            styles.freeCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[typography('subheading'), { color: colors.text }]}>FREE</Text>
          <View style={styles.features}>
            {FREE_FEATURES.map(f => featureRow(f, colors.textMuted))}
          </View>
        </View>

        {/* CTA */}
        <Button
          label={isPremium ? 'You are Premium' : 'Get Premium — ₹299/month'}
          onPress={handleCta}
          loading={purchasing}
          disabled={isPremium}
          accessibilityLabel="Get Premium"
        />

        {/* Restore */}
        <Pressable
          onPress={handleRestore}
          style={styles.restoreBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Restore previous purchase"
        >
          <Text style={[typography('caption'), { color: colors.textFaint, textAlign: 'center' }]}>
            Restore previous purchase
          </Text>
        </Pressable>
      </ScrollView>
      <BrandFooter />
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
  // Sized as a real touch target (was `{ width: 40 }` with no height, sitting
  // in a `flex-start` row — the tappable area collapsed to the `←` glyph's
  // own text line pinned to the header's top edge, well under the ~44pt
  // minimum, so taps at a natural finger position on the icon often missed.
  backBtn: {
    width: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, paddingHorizontal: 8 },
  scroll: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
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
  price: { marginTop: 4 },
  freeCard: { marginTop: 12 },
  features: {
    gap: 6,
    marginTop: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  restoreBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default PremiumScreen;
