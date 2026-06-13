/**
 * Chat message delete confirmation — inbox-grade AppConfirmModal shell.
 */
import { AppConfirmModal } from '@/components/ui/AppConfirmModal';

export type MessageDeleteKind = 'for_me' | 'for_everyone';

type Props = {
  visible: boolean;
  kind: MessageDeleteKind;
  /** Group chats use "other members" copy instead of "the other person". */
  isGroupChat?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

function copyFor(kind: MessageDeleteKind, isGroupChat: boolean): { title: string; message: string } {
  if (kind === 'for_me') {
    return {
      title: 'Delete for me?',
      message: isGroupChat
        ? 'This message will be removed from your chat. Other members can still see it.'
        : 'This message will be removed from your chat. The other person can still see it.',
    };
  }
  return {
    title: 'Delete for everyone?',
    message: isGroupChat
      ? 'This removes the message for everyone in the group.'
      : 'This removes the message for you and the other person.',
  };
}

export function MessageDeleteConfirmModal({
  visible,
  kind,
  isGroupChat = false,
  onClose,
  onConfirm,
}: Props) {
  const { title, message } = copyFor(kind, isGroupChat);

  return (
    <AppConfirmModal
      visible={visible}
      onClose={onClose}
      kicker="Messages"
      title={title}
      message={message}
      iconVariant="danger"
      primaryLabel="Cancel"
      onPrimary={onClose}
      secondaryLabel="Delete"
      onSecondary={async () => {
        await Promise.resolve(onConfirm());
        onClose();
      }}
      secondaryTone="danger"
      busyOn="secondary"
    />
  );
}
