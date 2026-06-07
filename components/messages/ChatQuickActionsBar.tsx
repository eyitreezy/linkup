/**
 * Plan / Offer / Place / Media — shown when composer + toggle is open (WhatsApp-style).
 */
import { colors, radius, spacing } from '@/constants/theme';
import type { ChatAppearancePreset } from '@/lib/messaging/chatAppearance';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  preset: ChatAppearancePreset;
  onPlan: () => void;
  onOffer: () => void;
  onPlace: () => void;
  onMedia: () => void;
  placeBusy?: boolean;
};

export function ChatQuickActionsBar({ preset, onPlan, onOffer, onPlace, onMedia, placeBusy }: Props) {
  const iconColor = preset.composerAttachIcon;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      <Pressable style={styles.item} onPress={onPlan} accessibilityRole="button" accessibilityLabel="Suggest a plan">
        <View style={styles.iconWrap}>
          <Ionicons name="calendar-outline" size={20} color={iconColor} />
        </View>
        <Text style={styles.label}>Plan</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={onOffer} accessibilityRole="button" accessibilityLabel="Send or open offer">
        <View style={[styles.iconWrap, styles.iconWrapAccent]}>
          <Ionicons name="flash-outline" size={20} color={iconColor} />
        </View>
        <Text style={styles.label}>Offer</Text>
      </Pressable>
      <Pressable
        style={styles.item}
        onPress={onPlace}
        disabled={placeBusy}
        accessibilityRole="button"
        accessibilityLabel="Share your area"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="location-outline" size={20} color={iconColor} />
        </View>
        <Text style={styles.label}>{placeBusy ? '…' : 'Place'}</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={onMedia} accessibilityRole="button" accessibilityLabel="Attach photo or video">
        <View style={styles.iconWrap}>
          <Ionicons name="image-outline" size={20} color={iconColor} />
        </View>
        <Text style={styles.label}>Media</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    gap: spacing.md,
  },
  item: { alignItems: 'center', minWidth: 56 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(108, 99, 255, 0.22)',
  },
  iconWrapAccent: {
    backgroundColor: 'rgba(255, 101, 132, 0.18)',
    borderColor: 'rgba(255, 101, 132, 0.38)',
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.2,
  },
});
