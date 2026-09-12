/**
 * Composer — frosted row + gradient send control.
 */
import { EmojiPickerPanel } from '@/components/ui/EmojiPickerPanel';
import { colors, spacing, fonts } from '@/constants/theme';
import { useEmojiTextInsert } from '@/hooks/useEmojiTextInsert';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputSelectionChangeEventData,
  type NativeSyntheticEvent,
} from 'react-native';

export type MessageInputThreadLook = {
  sendActive: [string, string];
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  attachIcon: string;
  fontSize: number;
  fontWeight: '400' | '700';
};

export type MessageInputProps = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAttach: () => void;
  sending: boolean;
  attachDisabled?: boolean;
  placeholder?: string;
  /** Use inside a parent composer sheet (no top hairline / opaque bar). */
  embeddedInSheet?: boolean;
  /** Match chat thread theme (optional). */
  threadLook?: MessageInputThreadLook | null;
  /** Parent provides + toggle (ChatComposer); omit default attach button. */
  hideLeadingAttach?: boolean;
  onComposerFocus?: () => void;
  selection?: { start: number; end: number };
  onSelectionChange?: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void;
};

export function MessageInput({
  value,
  onChangeText,
  onSend,
  onAttach,
  sending,
  attachDisabled,
  placeholder = 'Message…',
  embeddedInSheet,
  threadLook,
  hideLeadingAttach,
  onComposerFocus,
  selection,
  onSelectionChange,
}: MessageInputProps) {
  const {
    pickerOpen,
    togglePicker,
    closePicker,
    insertEmoji,
    onInputFocus,
    setSelection,
  } = useEmojiTextInsert({
    value,
    onChangeText,
    selection,
    onSelectionChange: onSelectionChange
      ? (next) =>
          onSelectionChange({
            nativeEvent: { selection: next },
          } as NativeSyntheticEvent<TextInputSelectionChangeEventData>)
      : undefined,
  });

  const canSend = value.trim().length > 0 && !sending;
  const tl = threadLook;

  const handleSend = () => {
    closePicker();
    onSend();
  };

  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(event.nativeEvent.selection);
    onSelectionChange?.(event);
  };

  return (
    <View>
      {pickerOpen ? (
        <EmojiPickerPanel embedded onSelect={insertEmoji} />
      ) : null}
      <View style={[styles.row, embeddedInSheet && styles.rowEmbedded]}>
        {!hideLeadingAttach ? (
          <Pressable
            onPress={onAttach}
            disabled={attachDisabled || sending}
            style={({ pressed }) => [
              styles.iconBtn,
              (attachDisabled || sending) && styles.iconDisabled,
              pressed && styles.iconPressed,
            ]}
            accessibilityLabel="Attach photo or video"
          >
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={attachDisabled ? colors.textMuted : (tl?.attachIcon ?? colors.primary)}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={togglePicker}
          style={({ pressed }) => [
            styles.emojiBtn,
            pickerOpen && styles.emojiBtnActive,
            pressed && styles.iconPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={pickerOpen ? 'Show keyboard' : 'Insert emoji'}
          accessibilityState={{ selected: pickerOpen }}
        >
          <Ionicons
            name={pickerOpen ? 'keypad-outline' : 'happy-outline'}
            size={24}
            color={pickerOpen ? colors.primary : (tl?.attachIcon ?? colors.textMuted)}
          />
        </Pressable>
        <TextInput
          style={[
            styles.input,
            tl && {
              fontSize: tl.fontSize,
              fontWeight: tl.fontWeight,
              color: tl.inputText,
              backgroundColor: tl.inputBg,
              borderColor: tl.inputBorder,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tl?.inputPlaceholder ?? colors.textMuted}
          multiline
          maxLength={4000}
          editable={!sending}
          onFocus={() => {
            onInputFocus();
            onComposerFocus?.();
          }}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          returnKeyType="send"
          returnKeyLabel="Send"
          blurOnSubmit={false}
          submitBehavior="submit"
          onSubmitEditing={() => {
            if (canSend) handleSend();
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [styles.sendWrap, !canSend && styles.sendDisabled, pressed && canSend && styles.sendPressed]}
          accessibilityLabel="Send message"
        >
          <LinearGradient
            colors={canSend ? (tl?.sendActive ?? [colors.primary, colors.secondary]) : [colors.textMuted, colors.textMuted]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendGrad}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={22} color="#fff" />
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  rowEmbedded: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    paddingTop: 4,
  },
  iconBtn: { padding: 6, marginBottom: 4 },
  emojiBtn: {
    padding: 6,
    marginBottom: 4,
    borderRadius: 18,
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(94, 82, 255, 0.12)',
  },
  iconDisabled: { opacity: 0.45 },
  iconPressed: { opacity: 0.8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1.5,
    borderColor: 'rgba(94, 82, 255, 0.18)',
  },
  sendWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendPressed: { opacity: 0.92 },
});
