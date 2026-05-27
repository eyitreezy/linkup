import { formatGeocodedAddress } from '@/lib/location/locationGeocode';
import type { DbPlan, DbProfile } from '@/types/database';
import * as Location from 'expo-location';

type CreatorProfilePick = Pick<DbProfile, 'location_label' | 'latitude' | 'longitude'>;

/** Plan meetup label, then creator profile label, then reverse-geocoded pin. */
export async function resolveCreatorMeetLocation(
  plan: Pick<DbPlan, 'location_label' | 'creator_id'>,
  creatorProfile: CreatorProfilePick | undefined
): Promise<string | null> {
  const fromPlan = plan.location_label?.trim();
  if (fromPlan) return fromPlan;

  const fromProfile = creatorProfile?.location_label?.trim();
  if (fromProfile) return fromProfile;

  const lat = creatorProfile?.latitude;
  const lng = creatorProfile?.longitude;
  if (lat == null || lng == null) return null;

  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const label = formatGeocodedAddress(addr);
    return label.trim() || null;
  } catch {
    return null;
  }
}
