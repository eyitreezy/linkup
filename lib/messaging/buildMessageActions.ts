import type { MessageActionItem } from '@/components/messages/MessageActionsSheet';
import {
  messageCopyText,
  messageDisplayText,
  parseLegacyImageBody,
  mimeToMediaKind,
  type ChatMessageRow,
} from '@/lib/messaging/chatQueries';
import {
  canDeleteMessageForEveryone,
  canDeleteMessageForMe,
  canEditMessage,
  canReplyToMessage,
} from '@/lib/messaging/messageEditRules';
import type { SubscriptionTier } from '@/types/database';

export type MessageActionHandlers = {
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onEdit: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onToggleReceipt?: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

export type BuildMessageActionsInput = {
  message: ChatMessageRow;
  viewerId: string;
  viewerTier: SubscriptionTier;
  pinnedMessageId: string | null;
  hiddenForViewer: boolean;
  hasMedia: boolean;
  mediaKind: 'image' | 'video' | null;
  isGroupChat?: boolean;
  handlers: MessageActionHandlers;
};

/**
 * Reply (received) → Copy → Forward → Edit → Pin → Hide receipt (Platinum) → Delete for me → Delete for everyone.
 */
export function buildMessageActions(input: BuildMessageActionsInput): MessageActionItem[] {
  const {
    message: m,
    viewerId,
    viewerTier,
    pinnedMessageId,
    hiddenForViewer,
    hasMedia,
    mediaKind,
    isGroupChat,
    handlers,
  } = input;

  if (m.is_system) return [];

  const isDel = !!m.deleted_at;
  const isMine = m.sender_id === viewerId;
  const copyText = messageCopyText(m, { hasMedia, mediaKind });
  const canCopy = !isDel && copyText.length > 0;
  const canReply = !isGroupChat && canReplyToMessage(m, viewerId);
  const canForward = !isDel;
  const canEdit = isMine && canEditMessage(m, viewerId);
  const isPinned = pinnedMessageId === m.id;
  const canDeleteMe = canDeleteMessageForMe(m, hiddenForViewer);
  const canDeleteEveryone =
    isMine && canDeleteMessageForEveryone(m, viewerId, viewerTier);

  const items: MessageActionItem[] = [];

  if (canReply) {
    items.push({ key: 'reply', label: 'Reply', icon: 'arrow-undo-outline', onPress: handlers.onReply });
  }
  if (canCopy) {
    items.push({ key: 'copy', label: 'Copy', icon: 'copy-outline', onPress: handlers.onCopy });
  }
  if (canForward) {
    items.push({ key: 'forward', label: 'Forward', icon: 'arrow-redo-outline', onPress: handlers.onForward });
  }
  if (canEdit) {
    items.push({ key: 'edit', label: 'Edit', icon: 'create-outline', onPress: handlers.onEdit });
  }
  if (isPinned) {
    items.push({ key: 'unpin', label: 'Unpin', icon: 'pin-outline', onPress: handlers.onUnpin });
  } else if (!isDel) {
    items.push({ key: 'pin', label: 'Pin', icon: 'pin', onPress: handlers.onPin });
  }
  if (
    viewerTier === 'PLATINUM' &&
    isMine &&
    !isDel &&
    !isGroupChat &&
    handlers.onToggleReceipt
  ) {
    items.push({
      key: 'toggle-receipt',
      label: m.receipt_hidden ? 'Show receipt' : 'Hide receipt',
      icon: m.receipt_hidden ? 'eye-outline' : 'eye-off-outline',
      onPress: handlers.onToggleReceipt,
    });
  }
  if (canDeleteMe) {
    items.push({
      key: 'delete-me',
      label: 'Delete for me',
      icon: 'trash-outline',
      destructive: true,
      onPress: handlers.onDeleteForMe,
    });
  }
  if (canDeleteEveryone) {
    items.push({
      key: 'delete-everyone',
      label: 'Delete for everyone',
      icon: 'trash-outline',
      destructive: true,
      onPress: handlers.onDeleteForEveryone,
    });
  }

  return items;
}

/** Media + legacy body helpers for action sheet construction. */
export function messageActionMediaMeta(
  m: ChatMessageRow,
  rowMedia: { mime_type: string | null } | undefined
): { hasMedia: boolean; mediaKind: 'image' | 'video' | null } {
  const display = messageDisplayText(m);
  const legacy = parseLegacyImageBody(display);
  const hasMedia = !!(rowMedia || (legacy && !rowMedia));
  const mediaKind = rowMedia ? mimeToMediaKind(rowMedia.mime_type) : legacy ? 'image' : null;
  return { hasMedia, mediaKind };
}
