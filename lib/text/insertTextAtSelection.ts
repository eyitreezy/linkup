export type TextSelection = { start: number; end: number };

/** Insert `insert` at the current selection, replacing any selected range. */
export function insertTextAtSelection(
  text: string,
  insert: string,
  selection: TextSelection
): { text: string; selection: TextSelection } {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const nextText = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return { text: nextText, selection: { start: cursor, end: cursor } };
}
