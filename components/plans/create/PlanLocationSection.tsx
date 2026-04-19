/**
 * Location field for plan create — white field + suggestions after3+ chars (geocode), current-location row.
 */
import { authSoftLabelStyle, ONBOARDING_FIELD_MIN_HEIGHT } from '@/components/Input';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Suggestion = { label: string; latitude: number; longitude: number };

function formatAddress(a: Location.LocationGeocodedAddress | null | undefined): string {
  if (!a) return '';
  const street =
    a.streetNumber && a.street ? `${a.streetNumber} ${a.street}` : a.street || a.name || '';
  const parts = [street, a.district, a.city, a.region, a.country].filter(
    (x): x is string => Boolean(x && String(x).trim())
  );
  const uniq = [...new Set(parts)];
  return uniq.slice(0, 3).join(', ');
}

type Props = {
  locationLabel: string;
  onApply: (patch: { locationLabel: string; latitude: number | null; longitude: number | null }) => void;
};

export function PlanLocationSection({ locationLabel, onApply }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeGen = useRef(0);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => () => clearDebounce(), [clearDebounce]);

  const runGeocode = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length <= 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const gen = ++geocodeGen.current;
    setSuggestLoading(true);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (gen !== geocodeGen.current) return;
      const top = results.slice(0, 8);
      const labeled: Suggestion[] = [];
      for (const r of top) {
        let label = '';
        try {
          const [addr] = await Location.reverseGeocodeAsync({
            latitude: r.latitude,
            longitude: r.longitude,
          });
          label = formatAddress(addr);
        } catch {
          label = '';
        }
        if (!label) {
          label = `${r.latitude.toFixed(2)}°, ${r.longitude.toFixed(2)}°`;
        }
        labeled.push({ label, latitude: r.latitude, longitude: r.longitude });
      }
      if (gen !== geocodeGen.current) return;
      setSuggestions(labeled);
    } catch {
      if (gen !== geocodeGen.current) return;
      setSuggestions([]);
    } finally {
      if (gen === geocodeGen.current) setSuggestLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (t: string) => {
      onApply({ locationLabel: t, latitude: null, longitude: null });
      clearDebounce();
      if (t.trim().length <= 2) {
        setSuggestions([]);
        setSuggestLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        void runGeocode(t);
      }, 420);
    },
    [onApply, clearDebounce, runGeocode]
  );

  const pickSuggestion = useCallback(
    (s: Suggestion) => {
      Keyboard.dismiss();
      setSuggestions([]);
      setSuggestLoading(false);
      clearDebounce();
      onApply({ locationLabel: s.label, latitude: s.latitude, longitude: s.longitude });
    },
    [onApply, clearDebounce]
  );

  const useCurrentLocation = useCallback(async () => {
    Keyboard.dismiss();
    setSuggestions([]);
    clearDebounce();
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const label = formatAddress(place) || [place?.name, place?.city].filter(Boolean).join(', ') || 'Near you';
      onApply({
        locationLabel: label,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      /* ignore */
    } finally {
      setLocating(false);
    }
  }, [onApply, clearDebounce]);

  return (
    <View style={[styles.wrap, suggestions.length > 0 && styles.wrapElevated]}>
      <Text style={authSoftLabelStyle}>Location</Text>
      <View style={styles.fieldShell}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          placeholder="Neighborhood, venue, or area"
          value={locationLabel}
          onChangeText={onChangeText}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {suggestLoading ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.latitude}-${s.longitude}-${i}`}
              onPress={() => pickSuggestion(s)}
              style={({ pressed }) => [styles.suggestRow, pressed && styles.suggestRowPressed]}
            >
              <Ionicons name="location-outline" size={18} color={colors.primary} style={styles.suggestIcon} />
              <Text style={styles.suggestText} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => void useCurrentLocation()}
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
  wrapElevated: {
    zIndex: 50,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  fieldShell: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,
    ...(Platform.OS === 'android' ? { paddingVertical: 12 } : null),
  },
  inlineLoader: { paddingRight: spacing.sm },
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D8DCE6',
    borderRadius: radius.lg,
    overflow: 'hidden',
    maxHeight: 220,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestRowPressed: { backgroundColor: 'rgba(108, 99, 255, 0.06)' },
  suggestIcon: { marginRight: spacing.sm },
  suggestText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 20 },
  currentLocRow: {
    marginTop: spacing.sm,
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
