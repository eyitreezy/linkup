import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_TRAVEL_KEY = 'linkup_recent_travel_cities';
const MAX_RECENT = 5;

export interface RecentTravelCity {
  label: string;
  latitude: number;
  longitude: number;
  visitedAt: string;
}

export async function getRecentTravelCities(): Promise<RecentTravelCity[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_TRAVEL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentTravelCity[];
  } catch {
    return [];
  }
}

export async function recordTravelCity(city: {
  label: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  try {
    const existing = await getRecentTravelCities();
    const filtered = existing.filter(
      (c) => c.label.toLowerCase() !== city.label.toLowerCase()
    );
    const updated: RecentTravelCity[] = [
      { ...city, visitedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_TRAVEL_KEY, JSON.stringify(updated));
  } catch {
    // Non-critical
  }
}

export async function clearRecentTravelCities(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_TRAVEL_KEY);
  } catch {
    // Non-critical
  }
}
