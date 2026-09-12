export function getMeetupCountdown(meetupIso: string | null | undefined): string | null {
  if (!meetupIso) return null;
  const diff = new Date(meetupIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0 && hours > 0) return `${days}d ${hours}h to meetup`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} to meetup`;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m to meetup`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} to meetup`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} to meetup`;
  return 'Meetup is starting now';
}

export function isArrivalWindowActive(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime() - 30 * 60 * 1000;
  const end = new Date(scheduledAt).getTime() + 4 * 60 * 60 * 1000;
  const now = Date.now();
  return now >= start && now <= end;
}
