/**
 * Location field for plan create — white field + suggestions after 3+ chars (geocode), current-location row.
 */
import { ONBOARDING_FIELD_MIN_HEIGHT } from '@/components/Input';
import { LocationSearchField } from '@/components/location/LocationSearchField';
import { colors, radius, spacing } from '@/constants/theme';
import { formatGeocodedAddress } from '@/lib/location/locationGeocode';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
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

function androidLocOptions(): { mayShowUserSettingsDialog?: true } {
  return Platform.OS === 'android' ? { mayShowUserSettingsDialog: true } : {};
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

async function resolvePlanCoordinates(): Promise<Location.LocationObject> {
  const extra = androidLocOptions();

  try {
    const recent = await Location.getLastKnownPositionAsync({
      maxAge: 45 * 60 * 1000,
    });
    if (recent) return recent;
  } catch {
    /* keep trying */
  }

  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        ...extra,
      }),
      22_000,
      'timeout-low'
    );
  } catch {
    /* next */
  }

  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        ...extra,
      }),
      18_000,
      'timeout-lowest'
    );
  } catch {
    /* next */
  }

  try {
    const stale = await Location.getLastKnownPositionAsync();
    if (stale) return stale;
  } catch {
    /* next */
  }

  return await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      ...extra,
    }),
    50_000,
    'timeout-balanced'
  );
}

function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
}

type Props = {
  locationLabel: string;
  onApply: (patch: { locationLabel: string; latitude: number | null; longitude: number | null }) => void;
};

export function PlanLocationSection({ locationLabel, onApply }: Props) {
  const [locating, setLocating] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const applyText = useCallback(
    (t: string) => onApply({ locationLabel: t, latitude: null, longitude: null }),
    [onApply]
  );

  const applySuggestion = useCallback(
    (s: { label: string; latitude: number; longitude: number }) => {
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude) || (s.latitude === 0 && s.longitude === 0)) {
        Alert.alert(
          'Location',
          'Could not resolve map coordinates for that place. Pick another suggestion or use current location.'
        );
        return;
      }
      onApply({ locationLabel: s.label, latitude: s.latitude, longitude: s.longitude });
    },
    [onApply]
  );

  const fillCurrentLocation = useCallback(async () => {
    Keyboard.dismiss();
    setLocating(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        Alert.alert(
          'Location permission',
          'Allow LinkUp to read your location while you use the app so we can fill your meetup spot.'
        );
        return;
      }

      const pos = await resolvePlanCoordinates();

      let label = '';
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const place = places[0];
        label =
          formatGeocodedAddress(place) ||
          [place?.name, place?.city, place?.region].filter(Boolean).join(', ') ||
          '';
      } catch {
        label = '';
      }

      if (!label.trim()) {
        label = formatCoords(pos.coords.latitude, pos.coords.longitude);
      }

      onApply({
        locationLabel: label,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      Alert.alert(
        'Location',
        'Could not get a position. On an emulator, set a mock location in Extended controls > Location. On a phone, turn on Location and use Wi-Fi or a signal, then try again. You can also type an area.'
      );
    } finally {
      setLocating(false);
    }
  }, [onApply]);

  return (
    <View style={styles.wrap}>
      <LocationSearchField
        label="Location"
        placeholder="Neighborhood, venue, or area"
        value={locationLabel}
        onChangeText={(t) => onApply({ locationLabel: t, latitude: null, longitude: null })}
        onSelectSuggestion={(s) =>
          onApply({ locationLabel: s.label, latitude: s.latitude, longitude: s.longitude })
        }
      />

      <Pressable
        onPress={() => void fillCurrentLocation()}
        disabled={locating}
        style={({ pressed }) => [
          styles.currentLocRow,
          (pressed || locating) && styles.currentLocPressed,
        ]}
      >
        <View style={styles.currentLocIcon}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
          )}
        </View>
        <Text style={styles.currentLocText}>{locating ? 'Getting location…' : 'Use current location'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  wrapSuggestionsOpen: {
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 16 : 0,
  },
  currentLocRow: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLocIcon: { width: 28, alignItems: 'center', marginRight: spacing.sm },
  currentLocPressed: { opacity: 0.92 },
  currentLocText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
});
