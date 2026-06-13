import type { ConversationReadRow } from '@/lib/messaging/conversationReads';
import { isOutgoingMessageRead } from '@/lib/messaging/conversationReads';

type MsgOrder = { id: string; created_at: string };

/** True when peer read cursor covers this outgoing message. */
export function isMessageReadByPeerCursor(
  messageId: string,
  messageCreatedAt: string,
  chronologicalMessages: MsgOrder[],
  peerRead: ConversationReadRow | null | undefined
): boolean {
  if (!peerRead) return false;

  if (peerRead.last_read_message_id) {
    const readIdx = chronologicalMessages.findIndex((m) => m.id === peerRead.last_read_message_id);
    const msgIdx = chronologicalMessages.findIndex((m) => m.id === messageId);
    if (readIdx >= 0 && msgIdx >= 0) return readIdx >= msgIdx;
  }

  return isOutgoingMessageRead(messageCreatedAt, peerRead);
}

/** Heuristic: peer sent a message after this one. */
export function isMessageReadByPeerReplyHeuristic(
  messageCreatedAt: string,
  latestPeerMessageMs: number
): boolean {
  if (latestPeerMessageMs <= 0) return false;
  return latestPeerMessageMs > new Date(messageCreatedAt).getTime();
}
