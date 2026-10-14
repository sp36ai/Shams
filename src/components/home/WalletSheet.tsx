/**
 * WalletSheet — what the gold coin opens: the balance, when the next free
 * question comes, and how coins are spent. Values come from the server
 * (walletStore); prices are the server's published rules, shown as text.
 * Coin packs are bought through Google Play (useCoinPurchase); the server
 * verifies each purchase and returns the new balance.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { RADIUS } from '@theme/themes';
import { useI18n, useTranslation } from '@i18n/I18nProvider';
import { formatCoins, useWalletStore } from '@stores/walletStore';
import HomeDetailSheet from './HomeDetailSheet';
import { GoldCoin } from './CoinChip';
import { COIN_PACKS } from '../../data/coinPacks';
import { useCoinPurchase, type CoinPurchaseResult } from '../../hooks/useCoinPurchase';

const DATE_LOCALE = { en: 'en-GB', ur: 'ur-PK', hi: 'hi-IN' } as const;

interface WalletSheetProps {
  visible: boolean;
  onClose: () => void;
  onSeePremium: () => void;
}

const WalletSheet: React.FC<WalletSheetProps> = ({ visible, onClose, onSeePremium }) => {
  const colors = useColors();
  const typography = useTypography();
  const t = useTranslation();
  const { lang } = useI18n();
  const { mode, balanceMilli, nextFreeAt, questionCostMilli } = useWalletStore();
  const { prices, buying, buy } = useCoinPurchase(visible);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setNotice(null);
    }
  }, [visible]);

  const noticeFor = (r: CoinPurchaseResult): string | null => {
    switch (r.status) {
      case 'credited':
        return t('wallet.purchaseAdded', { coins: formatCoins(r.creditedMilli) });
      case 'pending':
        return t('wallet.purchasePending');
      case 'failed':
        return t('wallet.purchaseFailed');
      case 'unavailable':
        return t('wallet.packsUnavailable');
      case 'cancelled':
        return null;
    }
  };

  const onBuy = async (sku: string): Promise<void> => {
    setNotice(null);
    setNotice(noticeFor(await buy(sku)));
  };

  const body = [typography('body'), { color: colors.text, lineHeight: 22 }];
  const muted = [typography('caption'), { color: colors.textMuted, lineHeight: 19 }];

  const nextFreeText =
    nextFreeAt === null
      ? t('wallet.freeAvailable')
      : t('wallet.nextFree', {
          date: new Date(nextFreeAt).toLocaleString(DATE_LOCALE[lang], {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          }),
        });

  return (
    <HomeDetailSheet title={visible ? t('wallet.title') : null} onClose={onClose}>
      <View style={styles.balanceRow} testID="wallet-balance">
        <GoldCoin size={40} />
        <Text style={[typography('heading'), { color: colors.goldBright, fontSize: 30 }]}>
          {balanceMilli === null ? '—' : formatCoins(balanceMilli)}
        </Text>
      </View>
      <Text style={[...muted, styles.centre]}>{t('wallet.rate')}</Text>

      {mode !== 'coins' ? (
        <Text style={[...body, styles.gap]}>{t('wallet.unknown')}</Text>
      ) : (
        <View style={styles.gap}>
          <Text style={body}>{nextFreeText}</Text>
          {questionCostMilli !== null && (
            <Text style={[...body, styles.line]}>
              {t('wallet.priceQuestion', { coins: formatCoins(questionCostMilli) })}
            </Text>
          )}
        </View>
      )}

      <Text style={[...muted, styles.gap]}>{t('wallet.priceDiscussion')}</Text>
      <Text style={[...muted, styles.line]}>{t('wallet.premium')}</Text>

      <Text style={[typography('subheading'), styles.gap, { color: colors.text }]}>
        {t('wallet.buyTitle')}
      </Text>
      <View style={styles.packs}>
        {COIN_PACKS.map(pack => (
          <Pressable
            key={pack.sku}
            testID={`wallet-pack-${pack.coins}`}
            disabled={buying !== null}
            onPress={() => {
              onBuy(pack.sku).catch(() => undefined);
            }}
            style={({ pressed }) => [
              styles.pack,
              {
                borderColor: colors.borderAccent,
                backgroundColor: colors.surfaceElevated,
                opacity: buying !== null && buying !== pack.sku ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('wallet.packCoins', { coins: String(pack.coins) })}
          >
            {buying === pack.sku ? (
              <ActivityIndicator color={colors.goldBright} />
            ) : (
              <>
                <GoldCoin size={22} />
                <Text style={[typography('button'), { color: colors.goldBright }]}>
                  {t('wallet.packCoins', { coins: String(pack.coins) })}
                </Text>
                <Text style={muted}>{prices[pack.sku] ?? `₹${pack.coins * 10}`}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
      {notice !== null && (
        <Text testID="wallet-notice" style={[...body, styles.line, styles.centre]}>
          {notice}
        </Text>
      )}

      <Pressable
        testID="wallet-see-premium"
        onPress={onSeePremium}
        style={({ pressed }) => [
          styles.premiumBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityRole="button"
      >
        <Text style={[typography('button'), { color: colors.textOnPrimary }]}>
          {t('wallet.seePremium')}
        </Text>
      </Pressable>
    </HomeDetailSheet>
  );
};

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centre: {
    textAlign: 'center',
    marginTop: 4,
  },
  gap: {
    marginTop: 16,
  },
  line: {
    marginTop: 6,
  },
  packs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pack: {
    flex: 1,
    minHeight: 84,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  premiumBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
});

export default WalletSheet;
