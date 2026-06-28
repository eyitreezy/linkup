export type GroupMentionMember = {
  userId: string;
  displayName: string;
};

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Stored in message text — rendered as @Display Name in the UI. */
export const GROUP_MENTION_TOKEN_RE = new RegExp(`<@(${UUID_PATTERN})>`, 'gi');

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string; label: string };

export function getActiveMentionQuery(
  text: string,
  cursor: number
): { start: number; query: string } | null {
  if (cursor < 0) return null;
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/u.test(before[at - 1]!)) return null;
  const query = before.slice(at + 1);
  if (/[\s\n@]/u.test(query)) return null;
  return { start: at, query };
}

export function filterMentionMembers(
  members: GroupMentionMember[],
  query: string,
  options?: { excludeUserId?: string; limit?: number }
): GroupMentionMember[] {
  const limit = options?.limit ?? 8;
  let list = members;
  if (options?.excludeUserId) {
    list = list.filter((m) => m.userId !== options.excludeUserId);
  }
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);
  return list.filter((m) => m.displayName.toLowerCase().includes(q)).slice(0, limit);
}

export function insertMentionLabel(
  text: string,
  start: number,
  cursor: number,
  member: GroupMentionMember
): { text: string; selection: number } {
  const label = `@${member.displayName}`;
  const before = text.slice(0, start);
  const after = text.slice(cursor);
  const next = `${before}${label} ${after}`;
  const selection = before.length + label.length + 1;
  return { text: next, selection };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convert visible @Display Name labels to stable `<@userId>` tokens before send. */
export function encodeGroupMentions(text: string, members: GroupMentionMember[]): string {
  if (!text.includes('@')) return text;
  let out = text;
  const sorted = [...members].sort((a, b) => b.displayName.length - a.displayName.length);
  for (const member of sorted) {
    const escaped = escapeRegExp(member.displayName);
    const re = new RegExp(`@${escaped}(?=\\s|$|[.,!?;:])`, 'gu');
    out = out.replace(re, `<@${member.userId}>`);
  }
  return out;
}

export function parseGroupMentionSegments(
  body: string,
  nameByUserId: Map<string, string>
): MentionSegment[] {
  if (!body) return [];
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(GROUP_MENTION_TOKEN_RE.source, 'gi');
  let match: RegExpExecArray | null = re.exec(body);
  while (match) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, match.index) });
    }
    const userId = match[1]!;
    const name = nameByUserId.get(userId) ?? 'Member';
    segments.push({ type: 'mention', userId, label: `@${name}` });
    lastIndex = match.index + match[0].length;
    match = re.exec(body);
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: 'text', value: body }];
}

export function formatGroupMentionsForDisplay(body: string, nameByUserId: Map<string, string>): string {
  return body.replace(new RegExp(GROUP_MENTION_TOKEN_RE.source, 'gi'), (_full, userId: string) => {
    const name = nameByUserId.get(userId) ?? 'Member';
    return `@${name}`;
  });
}
