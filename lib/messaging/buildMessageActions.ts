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

export type MessageActionHandlers = {
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onEdit: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

export type BuildMessageActionsInput = {
  message: ChatMessageRow;
  viewerId: string;
  pinnedMessageId: string | null;
  hiddenForViewer: boolean;
  hasMedia: boolean;
  mediaKind: 'image' | 'video' | null;
  handlers: MessageActionHandlers;
};

/**
 * WhatsApp-style sheet:
 * Reply (received) → Copy → Forward → Edit (own) → Pin → Delete for me → Delete for everyone (own, in window).
 */
export function buildMessageActions(input: BuildMessageActionsInput): MessageActionItem[] {
  const { message: m, viewerId, pinnedMessageId, hiddenForViewer, hasMedia, mediaKind, handlers } =
    input;
  const isDel = !!m.deleted_at;
  const copyText = messageCopyText(m, { hasMedia, mediaKind });
  const canCopy = !isDel && copyText.length > 0;
  const canReply = canReplyToMessage(m, viewerId);
  const canForward = !isDel;
  const canEdit = canEditMessage(m, viewerId);
  const isPinned = pinnedMessageId === m.id;
  const canDeleteMe = canDeleteMessageForMe(m, hiddenForViewer);
  const canDeleteEveryone = canDeleteMessageForEveryone(m, viewerId);

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
