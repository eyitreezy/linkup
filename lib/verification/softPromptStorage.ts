import AsyncStorage from '@react-native-async-storage/async-storage';

const SOFT_KYC_KEY = '@linkup/soft_kyc_prompt_pending';

/** Call after onboarding completes (publish, draft complete, or skip) — show one friendly prompt on Home. */
export async function markSoftKycPromptPending(): Promise<void> {
  await AsyncStorage.setItem(SOFT_KYC_KEY, '1');
}

export async function clearSoftKycPromptPending(): Promise<void> {
  await AsyncStorage.removeItem(SOFT_KYC_KEY);
}

export async function consumeSoftKycPromptPending(): Promise<boolean> {
  const v = await AsyncStorage.getItem(SOFT_KYC_KEY);
  if (v !== '1') return false;
  await AsyncStorage.removeItem(SOFT_KYC_KEY);
  return true;
}

export async function peekSoftKycPromptPending(): Promise<boolean> {
  const v = await AsyncStorage.getItem(SOFT_KYC_KEY);
  return v === '1';
}
