import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'linkup_pending_signup_privacy_consent';

export async function markPendingSignupPrivacyConsent(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}

export async function consumePendingSignupPrivacyConsent(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  if (value === '1') {
    await AsyncStorage.removeItem(KEY);
    return true;
  }
  return false;
}
