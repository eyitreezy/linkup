/**
 * Profile / onboarding location — search suggestions + optional current GPS fill.
 */
import { LocationSearchField } from '@/components/location/LocationSearchField';
import { colors, radius, spacing } from '@/constants/theme';
import { readCurrentProfileLocation } from '@/lib/profile/readCurrentProfileLocation';
import type { ProfileLocationPatch } from '@/lib/profile/profileLocation';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ONBOARDING_FIELD_MIN_HEIGHT } from '@/components/Input';

export type { ProfileLocationPatch };

type Props = {
  locationLabel: string;
  locationLatitude: number | null;
  onApply: (patch: ProfileLocationPatch) => void;
  /** Prefill from GPS when the field is empty (onboarding step mount). */
  autoFillOnMount?: boolean;
  /** Shown when user typed but did not pick a suggestion. */
  showRequiredHint?: boolean;
};

export function ProfileLocationSection({
  locationLabel,
  locationLatitude,
  onApply,
  autoFillOnMount = false,
  showRequiredHint,
}: Props) {
  const [locating, setLocating] = useState(false);
  const autoFillAttempted = useRef(false);

  const fillCurrentLocation = useCallback(async () => {
    Keyboard.dismiss();
    setLocating(true);
    try {
      const patch = await readCurrentProfileLocation();
      if (patch) {
        onApply(patch);
        return;
      }
      Alert.alert(
        'Location permission',
        'Allow LinkUp to use your location so we can set your area for nearby meetups.'
      );
    } catch {
      Alert.alert(
        'Location',
        'Could not read your position. Turn on Location services or search for your city instead.'
      );
    } finally {
      setLocating(false);
    }
  }, [onApply]);

  useEffect(() => {
    if (!autoFillOnMount) return;
    if (autoFillAttempted.current) return;
    if (locationLabel.trim() && locationLatitude != null) return;
    autoFillAttempted.current = true;
    void fillCurrentLocation();
  }, [autoFillOnMount, locationLabel, locationLatitude, fillCurrentLocation]);

  return (
    <View style={styles.wrap}>
      <LocationSearchField
        label="Your location"
        placeholder="City, neighborhood, or area"
        value={locationLabel}
        onChangeText={(t) =>
          onApply({ locationLabel: t, locationLatitude: null, locationLongitude: null })
        }
        onSelectSuggestion={(s) =>
          onApply({
            locationLabel: s.label,
            locationLatitude: s.latitude,
            locationLongitude: s.longitude,
          })
        }
      />

      <Pressable
        onPress={() => void fillCurrentLocation()}
        disabled={locating}
        style={({ pressed }) => [styles.currentLocRow, (pressed || locating) && styles.currentLocPressed]}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
      >
        <View style={styles.currentLocIcon}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
          )}
        </View>
        <Text style={styles.currentLocText}>
          {locating ? 'Getting location…' : 'Use current location'}
        </Text>
      </Pressable>

      {showRequiredHint ? (
        <Text style={styles.requiredHint}>
          Pick a place from the list or use current location — required for nearby plans.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    zIndex: 20,
  },
  currentLocRow: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.18)',
    borderRadius: radius.lg,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1D26',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  currentLocIcon: { width: 28, alignItems: 'center', marginRight: spacing.sm },
  currentLocPressed: { opacity: 0.92 },
  currentLocText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  requiredHint: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
    lineHeight: 18,
  },
});
