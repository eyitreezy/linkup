/**
 * Composer — text field, attachment, send (Bumble-structured row).
 */
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

export type MessageInputProps = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAttach: () => void;
  sending: boolean;
  attachDisabled?: boolean;
  placeholder?: string;
};

export function MessageInput({
  value,
  onChangeText,
  onSend,
  onAttach,
  sending,
  attachDisabled,
  placeholder = 'Message…',
}: MessageInputProps) {
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAttach}
        disabled={attachDisabled || sending}
        style={({ pressed }) => [styles.iconBtn, (attachDisabled || sending) && styles.iconDisabled, pressed && styles.iconPressed]}
        accessibilityLabel="Attach photo or video"
      >
        <Ionicons name="add-circle-outline" size={28} color={attachDisabled ? colors.textMuted : colors.primary} />
      </Pressable>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={4000}
        editable={!sending}
        returnKeyType="send"
        returnKeyLabel="Send"
        blurOnSubmit={false}
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (canSend) onSend();
        }}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && canSend && styles.sendPressed]}
        accessibilityLabel="Send message"
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="send" size={20} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  iconBtn: { padding: 6, marginBottom: 4 },
  iconDisabled: { opacity: 0.45 },
  iconPressed: { opacity: 0.8 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendDisabled: { opacity: 0.35 },
  sendPressed: { opacity: 0.9 },
});
