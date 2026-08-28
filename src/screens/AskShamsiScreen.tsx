/**
 * Ask Shamsi Question Screen
 * 
 * Collects question, location, and event timeline; calls askShamsiOracle Cloud Function.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@theme/ThemeProvider';
import { useI18n } from '@i18n/I18nProvider';
import { LocationEntryModal } from '@components/LocationEntryModal';
import { askShamsiOracle } from '@firebase/watchOracle'; // Adapt to use askShamsiOracle
import type { LocationCoordinates } from '@hooks/useLocationForShamsi';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  AskShamsi: undefined;
  ShamsiResults: any;
};

type Props = NativeStackScreenProps<RootStackParamList, 'AskShamsi'>;

export const AskShamsiScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const { t } = useI18n();
  const styles = createStyles(colors, typography);

  const [question, setQuestion] = useState('');
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [timeline, setTimeline] = useState<'macro' | 'micro'>('macro');
  const [loading, setLoading] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  useEffect(() => {
    // Auto-open location modal on first load if no location set
    if (!location) {
      // Optionally auto-open or wait for user to tap "Set Location"
    }
  }, [location]);

  const handleLocationSelected = (loc: LocationCoordinates) => {
    setLocation(loc);
    setLocationModalVisible(false);
  };

  const handleAskOracle = async () => {
    if (!question.trim()) {
      Alert.alert('Question Required', 'Please enter your question.');
      return;
    }

    if (!location) {
      Alert.alert('Location Required', 'Please set your location first.');
      setLocationModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const result = await askShamsiOracle({
        question: question.trim(),
        questionLang: 'en', // TODO: get from i18n context
        latitude: location.latitude,
        longitude: location.longitude,
        eventTimeline: timeline,
      });

      navigation.navigate('ShamsiResults', { result });
    } catch (error) {
      console.error('askShamsiOracle error:', error);
      Alert.alert('Oracle Error', (error as Error).message || 'Failed to compute verdict.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shamsi Oracle</Text>
        <Text style={styles.headerSubtitle}>Ask your question. The cosmos will answer.</Text>
      </View>

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Location</Text>
        {location ? (
          <View style={styles.locationBox}>
            <Text style={styles.locationText}>
              ✓ {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
            </Text>
            <TouchableOpacity
              onPress={() => setLocationModalVisible(true)}
              style={styles.changeButton}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setLocationModalVisible(true)}
            style={styles.setLocationButton}
          >
            <Text style={styles.setLocationButtonText}>📍 Set Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Question Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Question</Text>
        <TextInput
          style={styles.questionInput}
          placeholder="What would you ask the oracle?"
          placeholderTextColor={colors.textSecondary}
          value={question}
          onChangeText={setQuestion}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Event Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Timeline</Text>
        <View style={styles.timelineButtons}>
          <TouchableOpacity
            style={[
              styles.timelineButton,
              timeline === 'macro' && styles.timelineButtonActive,
            ]}
            onPress={() => setTimeline('macro')}
          >
            <Text
              style={[
                styles.timelineButtonText,
                timeline === 'macro' && styles.timelineButtonTextActive,
              ]}
            >
              Macro (Months/Years)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timelineButton,
              timeline === 'micro' && styles.timelineButtonActive,
            ]}
            onPress={() => setTimeline('micro')}
          >
            <Text
              style={[
                styles.timelineButtonText,
                timeline === 'micro' && styles.timelineButtonTextActive,
              ]}
            >
              Micro (Days/Weeks)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleAskOracle}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Ask the Oracle</Text>
        )}
      </TouchableOpacity>

      {/* Location Modal */}
      <LocationEntryModal
        visible={locationModalVisible}
        onLocationSelected={handleLocationSelected}
        onDismiss={() => setLocationModalVisible(false)}
      />
    </ScrollView>
  );
};

function createStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    header: {
      marginBottom: 24,
    },
    headerTitle: {
      ...typography.headingLarge,
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.labelMedium,
      color: colors.text,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    locationBox: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    locationText: {
      ...typography.bodySmall,
      color: colors.text,
      fontFamily: 'monospace',
    },
    changeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.accentLight,
    },
    changeButtonText: {
      ...typography.labelSmall,
      color: colors.accent,
      fontWeight: '600',
    },
    setLocationButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    setLocationButtonText: {
      ...typography.labelMedium,
      color: '#fff',
      fontWeight: '600',
    },
    questionInput: {
      backgroundColor: colors.cardBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.text,
      ...typography.bodySmall,
      textAlignVertical: 'top',
    },
    timelineButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    timelineButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
    },
    timelineButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    timelineButtonText: {
      ...typography.labelSmall,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    timelineButtonTextActive: {
      color: '#fff',
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      ...typography.labelLarge,
      color: '#fff',
      fontWeight: '600',
    },
  });
}
