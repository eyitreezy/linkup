/**

 * Search input with debounced location suggestions (Google Places or device geocode).

 */

import { authSoftLabelStyle, ONBOARDING_FIELD_MIN_HEIGHT } from '@/components/Input';

import { colors, radius, spacing } from '@/constants/theme';

import { resolveGooglePlaceSuggestion } from '@/lib/location/placesAutocomplete';

import { searchLocationSuggestions, type LocationSuggestion } from '@/lib/location/locationGeocode';

import { Ionicons } from '@expo/vector-icons';

import { useCallback, useEffect, useRef, useState } from 'react';

import {

  ActivityIndicator,

  Keyboard,

  Platform,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  View,

} from 'react-native';



type Props = {

  value: string;

  onChangeText: (text: string) => void;

  onSelectSuggestion: (suggestion: LocationSuggestion) => void;

  placeholder?: string;

  label?: string;

  debounceMs?: number;

  minQueryLength?: number;

  onSuggestionsOpenChange?: (open: boolean) => void;

};



export function LocationSearchField({

  value,

  onChangeText,

  onSelectSuggestion,

  placeholder = 'City, neighborhood, or area',

  label = 'Search location',

  debounceMs = 380,

  minQueryLength = 3,

  onSuggestionsOpenChange,

}: Props) {

  const [query, setQuery] = useState(value);

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);

  const [suggestLoading, setSuggestLoading] = useState(false);

  const [searchError, setSearchError] = useState<string | null>(null);

  const [resolving, setResolving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocodeGen = useRef(0);



  useEffect(() => {

    setQuery(value);

  }, [value]);



  useEffect(() => {

    onSuggestionsOpenChange?.(suggestions.length > 0);

  }, [suggestions.length, onSuggestionsOpenChange]);



  const clearDebounce = useCallback(() => {

    if (debounceRef.current) {

      clearTimeout(debounceRef.current);

      debounceRef.current = null;

    }

  }, []);



  useEffect(() => () => clearDebounce(), [clearDebounce]);



  const runGeocode = useCallback(

    async (text: string) => {

      const trimmed = text.trim();

      if (trimmed.length < minQueryLength) {

        setSuggestions([]);

        setSuggestLoading(false);

        setSearchError(null);

        return;

      }

      const gen = ++geocodeGen.current;

      setSuggestLoading(true);

      setSearchError(null);

      try {

        const labeled = await searchLocationSuggestions(trimmed);

        if (gen !== geocodeGen.current) return;

        setSuggestions(labeled);

        if (labeled.length === 0) {

          setSearchError(null);

        }

      } catch (e) {

        if (gen !== geocodeGen.current) return;

        setSuggestions([]);

        setSearchError(e instanceof Error ? e.message : 'Location search failed');

      } finally {

        if (gen === geocodeGen.current) setSuggestLoading(false);

      }

    },

    [minQueryLength]

  );



  const handleChangeText = useCallback(

    (t: string) => {

      setQuery(t);

      onChangeText(t);

      clearDebounce();

      if (t.trim().length < minQueryLength) {

        setSuggestions([]);

        setSuggestLoading(false);

        setSearchError(null);

        return;

      }

      debounceRef.current = setTimeout(() => {

        void runGeocode(t);

      }, debounceMs);

    },

    [onChangeText, clearDebounce, runGeocode, debounceMs, minQueryLength]

  );



  const pickSuggestion = useCallback(

    async (s: LocationSuggestion) => {

      Keyboard.dismiss();

      setSuggestions([]);

      setSuggestLoading(false);

      setSearchError(null);

      clearDebounce();

      setResolving(true);

      try {

        let resolved = s;

        if (s.placeId || (s.latitude === 0 && s.longitude === 0)) {

          resolved = await resolveGooglePlaceSuggestion(s);

        }

        setQuery(resolved.label);

        onSelectSuggestion(resolved);

      } catch (e) {

        setSearchError(e instanceof Error ? e.message : 'Could not load place details');

      } finally {

        setResolving(false);

      }

    },

    [onSelectSuggestion, clearDebounce]

  );



  const showDropdown = suggestions.length > 0;



  return (

    <View style={[styles.wrap, showDropdown && styles.wrapElevated]}>

      <Text style={authSoftLabelStyle}>{label}</Text>

      <View style={styles.fieldShell}>

        <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />

        <TextInput

          placeholderTextColor={colors.textMuted}

          placeholder={placeholder}

          value={query}

          onChangeText={handleChangeText}

          style={styles.input}

          autoCorrect={false}

          autoCapitalize="words"

          returnKeyType="search"

          accessibilityLabel={label}

        />

        {suggestLoading || resolving ? (

          <View style={styles.inlineLoader}>

            <ActivityIndicator size="small" color={colors.primary} />

          </View>

        ) : null}

      </View>



      {showDropdown ? (

        <ScrollView

          style={styles.dropdown}

          nestedScrollEnabled

          keyboardShouldPersistTaps="always"

          accessibilityRole="list"

        >

          {suggestions.map((s, i) => (

            <Pressable

              key={`${s.placeId ?? ''}-${s.latitude}-${s.longitude}-${i}`}

              onPress={() => void pickSuggestion(s)}

              style={({ pressed }) => [

                styles.suggestRow,

                i < suggestions.length - 1 && styles.suggestRowBorder,

                pressed && styles.suggestRowPressed,

              ]}

              accessibilityRole="button"

              accessibilityLabel={`Select ${s.label}`}

            >

              <Ionicons name="location-outline" size={18} color={colors.primary} style={styles.suggestIcon} />

              <Text style={styles.suggestText} numberOfLines={2}>

                {s.label}

              </Text>

            </Pressable>

          ))}

        </ScrollView>

      ) : null}



      {query.trim().length >= minQueryLength && !suggestLoading && !resolving && suggestions.length === 0 && !searchError ? (

        <Text style={styles.hint}>No matches — try a city name, neighborhood, or venue.</Text>

      ) : null}

      {searchError ? <Text style={styles.errorHint}>{searchError}</Text> : null}

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    marginBottom: spacing.md,

    zIndex: 1,

  },

  wrapElevated: {

    zIndex: 1000,

    elevation: Platform.OS === 'android' ? 16 : 0,

  },

  fieldShell: {

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: 'rgba(108, 99, 255, 0.18)',

    borderRadius: radius.lg,

    minHeight: ONBOARDING_FIELD_MIN_HEIGHT,

    flexDirection: 'row',

    alignItems: 'center',

    paddingRight: spacing.sm,

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

  searchIcon: {

    marginLeft: spacing.md,

  },

  input: {

    flex: 1,

    paddingVertical: 14,

    paddingHorizontal: spacing.sm,

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

    borderColor: 'rgba(108, 99, 255, 0.18)',

    borderRadius: radius.lg,

    maxHeight: 220,

    ...Platform.select({

      ios: {

        shadowColor: '#2a1f55',

        shadowOffset: { width: 0, height: 6 },

        shadowOpacity: 0.12,

        shadowRadius: 14,

      },

      android: { elevation: 8 },

    }),

  },

  suggestRow: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingVertical: 12,

    paddingHorizontal: spacing.md,

  },

  suggestRowBorder: {

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: 'rgba(108, 99, 255, 0.12)',

  },

  suggestRowPressed: { backgroundColor: 'rgba(108, 99, 255, 0.06)' },

  suggestIcon: { marginRight: spacing.sm },

  suggestText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 20, fontWeight: '600' },

  hint: {

    marginTop: spacing.xs,

    fontSize: 13,

    fontWeight: '600',

    color: colors.textMuted,

    paddingHorizontal: spacing.xs,

  },

  errorHint: {

    marginTop: spacing.xs,

    fontSize: 13,

    fontWeight: '700',

    color: colors.danger,

    paddingHorizontal: spacing.xs,

  },

});


