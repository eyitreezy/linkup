/**
 * Chat composer — WhatsApp-style + toggle reveals Plan / Offer / Place / Media.
 */
import { ChatQuickActionsBar } from '@/components/messages/ChatQuickActionsBar';
import { MessageInput, type MessageInputThreadLook } from '@/components/messages/MessageInput';
import type { ChatAppearancePreset } from '@/lib/messaging/chatAppearance';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  preset: ChatAppearancePreset;
  threadLook: MessageInputThreadLook | null;
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAttach: () => void;
  sending: boolean;
  attachDisabled?: boolean;
  placeholder?: string;
  onPlan: () => void;
  onOffer: () => void;
  onPlace: () => void;
  placeBusy?: boolean;
};

export function ChatComposer({
  preset,
  threadLook,
  value,
  onChangeText,
  onSend,
  onAttach,
  sending,
  attachDisabled,
  placeholder,
  onPlan,
  onOffer,
  onPlace,
  placeBusy,
}: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const iconColor = threadLook?.attachIcon ?? preset.composerAttachIcon;

  const closeTools = () => setToolsOpen(false);

  return (
    <View>
      {toolsOpen ? (
        <ChatQuickActionsBar
          preset={preset}
          onPlan={() => {
            onPlan();
            closeTools();
          }}
          onOffer={() => {
            onOffer();
            closeTools();
          }}
          onPlace={() => {
            onPlace();
            closeTools();
          }}
          onMedia={() => {
            onAttach();
            closeTools();
          }}
          placeBusy={placeBusy}
        />
      ) : null}
      <View style={styles.inputRow}>
        <Pressable
          onPress={() => setToolsOpen((o) => !o)}
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.togglePressed, toolsOpen && styles.toggleActive]}
          accessibilityRole="button"
          accessibilityLabel={toolsOpen ? 'Hide actions' : 'Show plan, offer, and place actions'}
          accessibilityState={{ expanded: toolsOpen }}
        >
          <Ionicons name={toolsOpen ? 'close' : 'add'} size={26} color={toolsOpen ? colors.primary : iconColor} />
        </Pressable>
        <View style={styles.inputFlex}>
          <MessageInput
            embeddedInSheet
            threadLook={threadLook}
            value={value}
            onChangeText={onChangeText}
            onSend={onSend}
            onAttach={onAttach}
            sending={sending}
            attachDisabled={attachDisabled}
            placeholder={placeholder}
            hideLeadingAttach
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  toggleBtn: {
    padding: 8,
    marginBottom: 6,
    borderRadius: 22,
  },
  togglePressed: { opacity: 0.85 },
  toggleActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  inputFlex: { flex: 1, minWidth: 0 },
});
