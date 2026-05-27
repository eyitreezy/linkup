import type { DbPlan } from '@/types/database';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export function getPlanCalendarTimes(plan: DbPlan): { start: Date; end: Date } | null {
  const raw = plan.agreed_scheduled_at ?? plan.scheduled_at;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

export function planCanAddToCalendar(plan: DbPlan): boolean {
  return getPlanCalendarTimes(plan) != null;
}

async function resolveWritableCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      return def.id;
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return (
      calendars.find((c) => c.isPrimary && c.allowsModifications)?.id ??
      calendars.find((c) => c.allowsModifications)?.id ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Opens the system calendar UI when possible; falls back to creating an event silently.
 */
export async function addPlanToDeviceCalendar(
  plan: DbPlan
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      message: 'Calendar reminders are available in the iOS and Android apps.',
    };
  }

  const times = getPlanCalendarTimes(plan);
  if (!times) {
    return { ok: false, message: 'This plan does not have a scheduled time yet.' };
  }

  if (!(await Calendar.isAvailableAsync())) {
    return { ok: false, message: 'Calendar is not available on this device.' };
  }

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    return { ok: false, message: 'Allow calendar access to save a reminder.' };
  }

  const notes = [plan.description?.trim(), plan.location_label?.trim()].filter(Boolean).join('\n\n');
  const location = (plan.agreed_location ?? plan.location_label)?.trim() || undefined;

  const payload = {
    title: plan.title,
    startDate: times.start,
    endDate: times.end,
    notes: notes || undefined,
    location,
  };

  try {
    await Calendar.createEventInCalendarAsync(payload);
    return { ok: true };
  } catch {
    const calendarId = await resolveWritableCalendarId();
    if (!calendarId) {
      return { ok: false, message: 'No calendar available to save this event.' };
    }
    try {
      await Calendar.createEventAsync(calendarId, payload);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Could not create the calendar event.',
      };
    }
  }
}
