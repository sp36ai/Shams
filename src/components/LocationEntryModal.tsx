/**
 * Location Entry Modal/Dialog
 * 
 * Allows manual entry of latitude/longitude or auto-fill from GPS.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@theme/ThemeProvider';
import { useLocationForShamsi } from '@hooks/useLocationForShamsi';
import type { LocationCoordinates } from '@hooks/useLocationForShamsi';

interface LocationEntryModalProps {
  visible: boolean;
  onLocationSelected: (location: LocationCoordinates) => void;
  onDismiss: () => void;
}

export const LocationEntryModal: React.FC<LocationEntryModalProps> = ({
  visible,
  onLocationSelected,
  onDismiss,
}) => {
  const { colors, typography } = useTheme();
  const styles = createStyles(colors, typography);
  const { location, loading, error, requestLocationWithFallback } = useLocationForShamsi();

  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const handleAutoDetect = async () => {
    const loc = await requestLocationWithFallback();
    if (loc) {
      onLocationSelected(loc);
      onDismiss();
    }
  };

  const handleManualSubmit = () => {
    setManualError(null);

    if (!manualLat || !manualLon) {
      setManualError('Both latitude and longitude are required.');
      return;
    }

    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);

    if (isNaN(lat) || isNaN(lon)) {
      setManualError('Latitude and longitude must be valid numbers.');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setManualError('Latitude must be -90 to 90; longitude must be -180 to 180.');
      return;
    }

    onLocationSelected({ latitude: lat, longitude: lon });
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Set Your Location</Text>
          <Text style={styles.subtitle}>
            Shamsi Logic requires your exact coordinates for precise horary calculations.
          </Text>

          {/* Auto-Detect Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleAutoDetect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📍 Auto-Detect Location</Text>
              )}
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {location && (
              <Text style={styles.successText}>
                ✓ Location set: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            )}
          </View>

          {/* Manual Entry Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Or Enter Manually</Text>
            <TextInput
              style={styles.input}
              placeholder="Latitude (-90 to 90)"
              placeholderTextColor={colors.textSecondary}
              value={manualLat}
              onChangeText={setManualLat}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Longitude (-180 to 180)"
              placeholderTextColor={colors.textSecondary}
              value={manualLon}
              onChangeText={setManualLon}
              keyboardType="decimal-pad"
            />
            {manualError && <Text style={styles.errorText}>{manualError}</Text>}
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleManualSubmit}
            >
              <Text style={styles.buttonTextSecondary}>Submit</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: any, typography: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 40,
    },
    title: {
      ...typography.headingMedium,
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      ...typography.labelMedium,
      color: colors.text,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      color: colors.text,
      ...typography.bodySmall,
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonPrimary: {
      backgroundColor: colors.accent,
    },
    buttonSecondary: {
      backgroundColor: colors.accentLight,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonText: {
      ...typography.labelMedium,
      color: '#fff',
      fontWeight: '600',
    },
    buttonTextSecondary: {
      ...typography.labelMedium,
      color: colors.accent,
      fontWeight: '600',
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.error,
      marginTop: 8,
    },
    successText: {
      ...typography.bodySmall,
      color: colors.success,
      marginTop: 8,
    },
    cancelButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelText: {
      ...typography.labelMedium,
      color: colors.textSecondary,
    },
  });
}
