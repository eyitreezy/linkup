/**
 * Platinum multi-city picker sheet — searchable multiselect with pills.
 */
import { MultiCitySearchField } from '@/components/plans/create/MultiCitySearchField';
import { MULTI_CITY_MIN } from '@/lib/plans/nigerianCities';
import { colors, radius, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  selected: string[];
  onClose: () => void;
  onApply: (cityIds: string[]) => void;
};

export function MultiCitySelectorSheet({ visible, selected, onClose, onApply }: Props) {
  const canDone = selected.length >= MULTI_CITY_MIN;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select cities</Text>
          <Text style={styles.sub}>Search and pick {MULTI_CITY_MIN}–5 cities for multi-city visibility.</Text>

          <MultiCitySearchField
            selected={selected}
            onChange={onApply}
            showHint
          />

          <Pressable
            onPress={() => {
              if (canDone) onClose();
            }}
            style={[styles.doneBtn, !canDone && styles.doneDisabled]}
            disabled={!canDone}
          >
            <Text style={styles.doneTxt}>Done ({selected.length} selected)</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  sub: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '600' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  doneDisabled: { opacity: 0.45 },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
