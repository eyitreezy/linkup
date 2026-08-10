import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'linkup_plan_last_viewed_';

export async function markPlanActivityRead(planId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${KEY_PREFIX}${planId}`, new Date().toISOString());
  } catch {
    // Non-critical — fail silently
  }
}

export async function getNewActivityCount(
  planId: string,
  latestEngagementAt: string | null
): Promise<number> {
  if (!latestEngagementAt) return 0;
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${planId}`);
    if (!raw) return 1;
    const lastViewed = new Date(raw).getTime();
    const latest = new Date(latestEngagementAt).getTime();
    return latest > lastViewed ? 1 : 0;
  } catch {
    return 0;
  }
}
