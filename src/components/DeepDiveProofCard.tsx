/**
 * DeepDiveProofCard — Astrological proof expansion showing the judgment reasoning
 *
 * Displays the *real* reasoning behind a RKP Watch Engine verdict, exactly as
 * returned by askWatchOracle. Nothing here is invented client-side: every
 * field comes straight from `WatchReading.verdict` (a `DisplayWatchVerdict`).
 *
 * DISPLAYS:
 * - Judgment Chain: target house/ruler → querent's ruler → their relation
 * - Obstruction & Reversal risk
 * - Factors: the engine's own `factors` list, in the order it applied them
 * - Confidence: the engine's qualitative confidence band
 * - Timing: the engine's timing window, when it has one
 *
 * An earlier draft of this card visualized a CSL → Star-Lord → Sub-Lord veto
 * chain and a "vector analysis" breakdown. That data was never real — it
 * came from a fabricated engine that has since been removed. This card now
 * shows only what the real RKP Watch Engine actually computes.
 *
 * LAYOUT:
 * - Header with close button
 * - Verdict summary (state, confidence)
 * - Judgment chain (target house/ruler, querent's ruler, relation)
 * - Obstruction / reversal indicator
 * - Factors list
 * - Timing window
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import type { WatchReading } from '../firebase/watchOracle';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeepDiveProofCardProps {
  visible: boolean;
  payload: WatchReading | null;
  onClose: () => void;
}

interface ChainItem {
  title: string;
  value: string;
  detail: string;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  VERY_HIGH: '#4CAF50',
  HIGH: '#8BC34A',
  MODERATE: '#FFC107',
  LOW: '#FF9800',
  UNCERTAIN: '#FF6B6B',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  VERY_HIGH: '✅ Very High Confidence',
  HIGH: '✅ High Confidence',
  MODERATE: '⚠️ Moderate Confidence',
  LOW: '⚠️ Low Confidence',
  UNCERTAIN: '❓ Uncertain',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DeepDiveProofCard: React.FC<DeepDiveProofCardProps> = ({
  visible,
  payload,
  onClose,
}) => {
  if (!payload) {
    return null;
  }

  const verdict = payload.verdict;
  const hasObstruction = verdict.obstruction !== 'None';
  const hasReversalRisk = verdict.reversal === 'POSSIBLE';

  const chain: ChainItem[] = [
    {
      title: `House ${verdict.targetHouse}`,
      value: verdict.targetSignName,
      detail: `Ruled by ${verdict.targetRulerName}`,
    },
    {
      title: "Querent's Ruler",
      value: payload.lagnaRulerName,
      detail: `Regards ${verdict.targetRulerName} as: ${verdict.rulerRelation}`,
    },
    {
      title: `Fulfilment — House ${verdict.fulfilmentHouse}`,
      value: verdict.state,
      detail: 'Governs whether the desire actually materialises',
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={styles.container}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Astrological Proof</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* ─── Verdict Summary ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Verdict</Text>
            <View style={styles.verdictBox}>
              <Text style={styles.verdictStatus}>{verdict.state}</Text>
              <Text
                style={[
                  styles.verdictConfidence,
                  { color: CONFIDENCE_COLOR[verdict.confidence] ?? '#666' },
                ]}
              >
                {CONFIDENCE_LABEL[verdict.confidence] ?? verdict.confidence}
              </Text>
            </View>
          </View>

          {/* ─── Judgment Chain ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗 Judgment Chain</Text>

            {chain.map((item, index) => (
              <View key={item.title}>
                <ChainCard item={item} />
                {index < chain.length - 1 && (
                  <View style={styles.chainArrow}>
                    <Text style={styles.arrowText}>↓</Text>
                  </View>
                )}
              </View>
            ))}

            {/* ─── Obstruction / Reversal ─── */}
            <View
              style={[
                styles.vetoResultBox,
                (hasObstruction || hasReversalRisk) && styles.vetoReversed,
              ]}
            >
              <Text style={styles.vetoResultLabel}>Obstruction:</Text>
              <Text style={styles.vetoResultValue}>
                {hasObstruction ? `⚔️ ${verdict.obstruction}` : '✅ None'}
              </Text>
              {hasReversalRisk && (
                <Text style={styles.vetoResultExplanation}>
                  A ruling planet is retrograde — expect rework, reversal, or an overturn.
                </Text>
              )}
            </View>
          </View>

          {/* ─── Factors ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Reasoning Factors</Text>
            {verdict.factors.map((factor, index) => (
              <View key={index} style={styles.factorItem}>
                <Text style={styles.factorBullet}>•</Text>
                <Text style={styles.factorText}>{factor}</Text>
              </View>
            ))}
          </View>

          {/* ─── Timing ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏳ Timing</Text>
            <View style={styles.verdictBox}>
              {verdict.timing ? (
                <Text style={styles.verdictConfidence}>
                  Expected within {verdict.timing.minDays}–{verdict.timing.maxDays} days
                </Text>
              ) : (
                <Text style={styles.verdictConfidence}>No usable timing signal in this chart</Text>
              )}
            </View>
          </View>

          {/* ─── Chart Context ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧭 Chart Context</Text>
            <View style={styles.verdictBox}>
              <Text style={styles.factorText}>
                Direction: {verdict.direction}
                {verdict.afflictedDirection ? ` · Afflicted: ${verdict.afflictedDirection}` : ''}
              </Text>
              <Text style={styles.factorText}>Controller profile: {verdict.controllerProfile}</Text>
            </View>
          </View>

          {/* ─── Spacer ─── */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

const ChainCard: React.FC<{ item: ChainItem }> = ({ item }) => {
  return (
    <View style={styles.chainCard}>
      <Text style={styles.chainCardTitle}>{item.title}</Text>
      <Text style={styles.chainCardPlanet}>{item.value}</Text>
      <Text style={styles.chainCardSignifications}>{item.detail}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // ─── Sections ───
  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  // ─── Verdict Box ───
  verdictBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },

  verdictStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },

  verdictConfidence: {
    fontSize: 14,
    color: '#666',
  },

  // ─── Judgment Chain ───
  chainCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },

  chainCardTitle: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },

  chainCardPlanet: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  chainCardSignifications: {
    fontSize: 13,
    color: '#666',
  },

  chainArrow: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  arrowText: {
    fontSize: 20,
    color: '#ddd',
    fontWeight: '300',
  },

  // ─── Obstruction / Reversal ───
  vetoResultBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },

  vetoReversed: {
    backgroundColor: '#fff3e0',
    borderLeftColor: '#FF9800',
  },

  vetoResultLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },

  vetoResultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  vetoResultExplanation: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  // ─── Factors ───
  factorItem: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },

  factorBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 12,
    marginTop: -2,
  },

  factorText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
});

export default DeepDiveProofCard;
