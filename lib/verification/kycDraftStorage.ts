import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateKycDraft, type KycDraftPersisted } from '@/types/kyc';

const key = (userId: string) => `@linkup/kyc-draft/${userId}`;

export async function loadKycDraft(userId: string): Promise<KycDraftPersisted | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    return migrateKycDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveKycDraft(userId: string, draft: KycDraftPersisted): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(draft));
}

export async function clearKycDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(key(userId));
}
