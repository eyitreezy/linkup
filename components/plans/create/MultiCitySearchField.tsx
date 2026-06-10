/**
 * Searchable multi-city picker — app-standard field chrome, pills, and suggestion list.
 */
import { onboardingInputShadow, planCreateTouchableFieldStyle } from '@/components/Input';
import { APP_CHIP_GRADIENT } from '@/constants/gradients';
import { colors, radius, spacing } from '@/constants/theme';
import {
  cityLabelById,
  filterCitiesForPicker,
  MULTI_CITY_MAX,
  MULTI_CITY_MIN,
  NIGERIAN_CITIES,
} from '@/lib/plans/nigerianCities';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  selected: string[];
  onChange: (cityIds: string[]) => void;
  showHint?: boolean;
};

function CityOptionRow({
  label,
  state,
  onPress,
}: {
  label: string;
  state: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
    >
      <View style={styles.optionIcon}>
        <Ionicons name="location-outline" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionState}>{state}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
    </Pressable>
  );
}

export function MultiCitySearchField({ selected, onChange, showHint = true }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const atMax = selected.length >= MULTI_CITY_MAX;
  const isValid = selected.length >= MULTI_CITY_MIN;
  const remaining = Math.max(0, MULTI_CITY_MIN - selected.length);

  const suggestions = useMemo(
    () => filterCitiesForPicker(query, selected),
    [query, selected]
  );

  const showDropdown =
    focused &&
    !atMax &&
    (suggestions.length > 0 || (query.length === 0 && selected.length < MULTI_CITY_MAX));

  const dropdownCities = useMemo(() => {
    if (query.trim().length > 0) return suggestions;
    return NIGERIAN_CITIES.filter((c) => !selected.includes(c.id)).slice(0, 6);
  }, [query, suggestions, selected]);

  function addCity(id: string) {
    if (selected.includes(id) || selected.length >= MULTI_CITY_MAX) return;
    onChange([...selected, id]);
    setQuery('');
  }

  function removeCity(id: string) {
    onChange(selected.filter((c) => c !== id));
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelHeaderLeft}>
          <View style={styles.panelIcon}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>Target cities</Text>
            <Text style={styles.panelSub}>Choose {MULTI_CITY_MIN}–{MULTI_CITY_MAX} cities</Text>
          </View>
        </View>
        <View style={[styles.countBadge, isValid && styles.countBadgeReady]}>
          <Text style={[styles.countBadgeTxt, isValid && styles.countBadgeTxtReady]}>
            {selected.length}/{MULTI_CITY_MAX}
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: MULTI_CITY_MAX }, (_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i < selected.length && styles.progressDotFilled]}
          />
        ))}
      </View>

      <View style={styles.selectedZone}>
        {selected.length === 0 ? (
          <View style={styles.emptySelected}>
            <Ionicons name="earth-outline" size={20} color={colors.textMuted} />
            <Text style={styles.emptySelectedTxt}>Search below to add cities</Text>
          </View>
        ) : (
          <View style={styles.pillsRow}>
            {selected.map((id) => (
              <Pressable
                key={id}
                onPress={() => removeCity(id)}
                style={({ pressed }) => [styles.pillOuter, pressed && styles.pillPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${cityLabelById(id)}`}
              >
                <LinearGradient
                  colors={[...APP_CHIP_GRADIENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.pill}
                >
                  <Text style={styles.pillTxt}>{cityLabelById(id)}</Text>
                  <View style={styles.pillRemove}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.searchWrap, focused && styles.searchWrapFocused]}>
        <Ionicons
          name="search"
          size={18}
          color={focused ? colors.primary : colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          placeholder={atMax ? 'Maximum cities selected' : 'Search by city or state…'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!atMax}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          <Text style={styles.dropdownKicker}>
            {query.trim() ? 'Search results' : 'Popular cities'}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.dropdownScroll}
            showsVerticalScrollIndicator={false}
          >
            {dropdownCities.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsTxt}>No cities match your search</Text>
              </View>
            ) : (
              dropdownCities.map((city) => (
                <CityOptionRow
                  key={city.id}
                  label={city.label}
                  state={city.state}
                  onPress={() => addCity(city.id)}
                />
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {showHint ? (
        <View style={[styles.statusRow, isValid && styles.statusRowReady]}>
          <Ionicons
            name={isValid ? 'checkmark-circle' : atMax ? 'information-circle-outline' : 'ellipse-outline'}
            size={16}
            color={isValid || atMax ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.statusTxt, isValid && styles.statusTxtReady]}>
            {isValid
              ? `${selected.length} cities selected — ready to continue`
              : atMax
                ? `Maximum of ${MULTI_CITY_MAX} cities reached`
                : remaining > 0
                  ? `Add ${remaining} more city${remaining === 1 ? '' : 'ies'} to continue`
                  : 'Search and tap a city to add it'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const FIELD_BORDER = '#D8DCE6';

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    padding: spacing.md,
    gap: spacing.sm,
    ...onboardingInputShadow,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  panelIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeaderText: { flex: 1, minWidth: 0 },
  panelTitle: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  panelSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.button,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
  },
  countBadgeReady: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  countBadgeTxt: { fontSize: 12, fontWeight: '900', color: colors.textMuted },
  countBadgeTxtReady: { color: colors.primary },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotFilled: {
    backgroundColor: colors.secondary,
  },
  selectedZone: {
    minHeight: 44,
    justifyContent: 'center',
  },
  emptySelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.authInputBg,
  },
  emptySelectedTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillOuter: { borderRadius: radius.button, overflow: 'hidden' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 7,
    borderRadius: radius.button,
  },
  pillPressed: { opacity: 0.9 },
  pillTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  pillRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    ...planCreateTouchableFieldStyle(),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    minHeight: 48,
  },
  searchWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  searchIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
  },
  clearBtn: { padding: 2, marginLeft: spacing.xs },
  dropdown: {
    borderRadius: radius.md,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dropdownKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  dropdownScroll: { maxHeight: 200 },
  noResults: { padding: spacing.md, alignItems: 'center' },
  noResultsTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionPressed: { backgroundColor: colors.authInputBg },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.authInputBg,
    borderWidth: 1,
    borderColor: FIELD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionState: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  statusRowReady: {},
  statusTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 17,
  },
  statusTxtReady: { color: colors.primary, fontWeight: '700' },
});
