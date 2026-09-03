/**
 * DeepDiveProofCard — Astrological proof expansion showing the judgment reasoning
 *
 * DISPLAYS:
 * - Critical Path: CSL → Star Lord → Sub Lord significations
 * - Veto Logic: Sub-Lord confirmation or reversal of Star-Lord promise
 * - Factors: Complete list from finalVerdict.factors
 * - Confidence Score: With breakdown by vector
 * - Advanced: Full vectorAnalysis breakdown (collapsed by default)
 *
 * LAYOUT:
 * - Header with close button
 * - CSL Chain visualization (cards connected by arrows)
 * - Veto result indicator (CONFIRMED / REVERSED)
 * - Factors list
 * - Confidence meter
 * - Advanced toggle (shows primary/secondary/negating vectors)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import type { UnifiedShamsJudgment } from '../astrology/rkp/unifiedShamsEngine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeepDiveProofCardProps {
  visible: boolean;
  payload: UnifiedShamsJudgment | null;
  onClose: () => void;
}

interface CSLChainItem {
  title: string;
  planet: string;
  significations: number[];
  role: 'CSL' | 'Star' | 'Sub';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DeepDiveProofCard: React.FC<DeepDiveProofCardProps> = ({
  visible,
  payload,
  onClose,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { width } = useWindowDimensions();

  if (!payload) return null;

  const judgment = payload.promiseGateway.judgment;
  const verdict = payload.finalVerdict;
  const cslData = judgment.cslDataset[0]; // Primary CSL

  // Extract CSL chain
  const cslChain: CSLChainItem[] = [
    {
      title: '6th House CSL',
      planet: cslData?.cslPlanet?.name || 'Unknown',
      significations: cslData?.starSignifications || [],
      role: 'CSL',
    },
    {
      title: 'Star Lord',
      planet: cslData?.starLord?.name || 'Unknown',
      significations: cslData?.starSignifications || [],
      role: 'Star',
    },
    {
      title: 'Sub Lord',
      planet: cslData?.subLord?.name || 'Unknown',
      significations: cslData?.subSignifications || [],
      role: 'Sub',
    },
  ];

  // Determine veto result
  const isVetoApplied = verdict.status.includes('DENIED') || verdict.status.includes('REVERSED');
  const vetoResult = isVetoApplied ? 'REVERSED ⚔️' : 'CONFIRMED ✅';

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
              <Text style={styles.verdictStatus}>{verdict.status}</Text>
              <Text style={styles.verdictConfidence}>
                Confidence: {(payload.promiseGateway.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* ─── CSL Chain Visualization ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔗 Judgment Chain</Text>

            {cslChain.map((item, index) => (
              <View key={index}>
                <CSLChainCard item={item} />

                {index < cslChain.length - 1 && (
                  <View style={styles.chainArrow}>
                    <Text style={styles.arrowText}>↓</Text>
                  </View>
                )}
              </View>
            ))}

            {/* ─── Veto Result ─── */}
            <View style={[styles.vetoResultBox, isVetoApplied && styles.vetoReversed]}>
              <Text style={styles.vetoResultLabel}>Sub-Lord Verdict:</Text>
              <Text style={styles.vetoResultValue}>{vetoResult}</Text>
              <Text style={styles.vetoResultExplanation}>
                {isVetoApplied
                  ? "Sub-Lord's significations override Star-Lord's promise"
                  : "Sub-Lord's significations align with Star-Lord's promise"}
              </Text>
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

          {/* ─── Confidence Breakdown ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Confidence Analysis</Text>
            <ConfidenceMeter confidence={payload.promiseGateway.confidence} />
          </View>

          {/* ─── Advanced Vector Analysis ─── */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? '▼' : '▶'} Advanced Vector Analysis
              </Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedContent}>
                {/* Primary Vector */}
                {judgment.vectorAnalysis?.primary && (
                  <VectorBreakdown
                    vector={judgment.vectorAnalysis.primary}
                    title="Primary Vector (6th House)"
                    color="#FF6B6B"
                  />
                )}

                {/* Secondary Vectors */}
                {judgment.vectorAnalysis?.secondary.length > 0 && (
                  <View>
                    <Text style={styles.advancedSubtitle}>Secondary Vectors</Text>
                    {judgment.vectorAnalysis.secondary.map((vec, idx) => (
                      <VectorBreakdown key={idx} vector={vec} color="#4ECDC4" />
                    ))}
                  </View>
                )}

                {/* Negating Vectors */}
                {judgment.vectorAnalysis?.negating.length > 0 && (
                  <View>
                    <Text style={styles.advancedSubtitle}>Negating Vectors</Text>
                    {judgment.vectorAnalysis.negating.map((vec, idx) => (
                      <VectorBreakdown key={idx} vector={vec} color="#FFD93D" />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ─── Audit Trail (if available) ─── */}
          {verdict.auditTrail && verdict.auditTrail.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔍 Audit Trail</Text>
              {verdict.auditTrail.slice(0, 5).map((event, index) => (
                <View key={index} style={styles.auditItem}>
                  <Text style={styles.auditPhase}>{event.phase}</Text>
                  <Text style={styles.auditDetail}>{event.detail}</Text>
                </View>
              ))}
            </View>
          )}

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

/**
 * CSL Chain Card
 */
const CSLChainCard: React.FC<{ item: CSLChainItem }> = ({ item }) => {
  const roleColors = {
    CSL: '#007AFF',
    Star: '#FF6B6B',
    Sub: '#FFD93D',
  };

  return (
    <View style={[styles.chainCard, { borderLeftColor: roleColors[item.role] }]}>
      <Text style={styles.chainCardTitle}>{item.title}</Text>
      <Text style={styles.chainCardPlanet}>{item.planet}</Text>
      <Text style={styles.chainCardSignifications}>
        Signifies: {item.significations.join(', ')}
      </Text>
    </View>
  );
};

/**
 * Confidence Meter
 */
const ConfidenceMeter: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percentage = confidence * 100;
  const confidenceColor =
    percentage >= 85 ? '#4CAF50' : percentage >= 70 ? '#FFC107' : '#FF6B6B';

  return (
    <View style={styles.confidenceMeterContainer}>
      <View style={styles.meterBackground}>
        <View
          style={[
            styles.meterFill,
            { width: `${percentage}%`, backgroundColor: confidenceColor },
          ]}
        />
      </View>
      <Text style={styles.meterLabel}>{percentage.toFixed(1)}%</Text>

      {/* Interpretation */}
      <Text style={styles.confidenceInterpretation}>
        {percentage >= 85
          ? '✅ Very High Confidence'
          : percentage >= 70
            ? '⚠️ Moderate Confidence'
            : '⚠️ Low Confidence'}
      </Text>
    </View>
  );
};

/**
 * Vector Breakdown (for advanced analysis)
 */
interface VectorBreakdownProps {
  vector: any;
  title?: string;
  color: string;
}

const VectorBreakdown: React.FC<VectorBreakdownProps> = ({ vector, title, color }) => {
  return (
    <View style={[styles.vectorCard, { borderLeftColor: color }]}>
      {title && <Text style={styles.vectorTitle}>{title}</Text>}
      <Text style={styles.vectorType}>{vector.vectorType || 'Vector'}</Text>
      <Text style={styles.vectorAlignment}>
        Expected: {vector.expectedHouses?.join(', ') || 'N/A'}
      </Text>
      <Text style={styles.vectorAlignment}>
        Actual: {vector.actualHouses?.join(', ') || 'N/A'}
      </Text>
      <View style={styles.alignmentBar}>
        <View
          style={[
            styles.alignmentFill,
            { width: `${(vector.alignmentScore || 0) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.alignmentScore}>
        Alignment: {((vector.alignmentScore || 0) * 100).toFixed(0)}%
      </Text>
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

  // ─── CSL Chain ───
  chainCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
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

  // ─── Veto Result ───
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

  // ─── Confidence ───
  confidenceMeterContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },

  meterBackground: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },

  meterFill: {
    height: '100%',
    borderRadius: 4,
  },

  meterLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  confidenceInterpretation: {
    fontSize: 13,
    color: '#666',
  },

  // ─── Advanced ───
  advancedToggle: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  advancedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  advancedContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },

  advancedSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },

  vectorCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
  },

  vectorTitle: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },

  vectorType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  vectorAlignment: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },

  alignmentBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginVertical: 8,
  },

  alignmentFill: {
    height: '100%',
    borderRadius: 2,
  },

  alignmentScore: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // ─── Audit Trail ───
  auditItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },

  auditPhase: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  auditDetail: {
    fontSize: 13,
    color: '#333',
  },
});

export default DeepDiveProofCard;
