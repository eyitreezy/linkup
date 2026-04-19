/** Compact relative time for inbox rows (English, mobile-friendly). */
export function formatRelativeShort(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
