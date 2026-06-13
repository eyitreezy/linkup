import * as Crypto from 'expo-crypto';
import { CONTACT_HASH_SALT } from '@/lib/contacts/hashContact';

export async function hashContactValue(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value + CONTACT_HASH_SALT);
}
