/**
 * Read file bytes from a picker/camera URI without `fetch(fileUri)` — on Android that often
 * throws "Network request failed" (not a real network issue).
 *
 * Uses expo-file-system `File` (SDK 54+). The old `readAsStringAsync` API throws at runtime.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/** Images + small videos (see size guard at call sites for video). */
export async function readLocalAssetAsUint8Array(uri: string): Promise<Uint8Array> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      if (!res.ok) {
        throw new Error(`Could not read image (HTTP ${res.status})`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }

    const file = new File(uri);
    if (!file.exists) {
      throw new Error('File does not exist or is not readable');
    }
    return await file.bytes();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not read the file from your device. Try choosing it again. (${detail})`
    );
  }
}

/** @deprecated Use readLocalAssetAsUint8Array — same implementation. */
export const readLocalImageAsUint8Array = readLocalAssetAsUint8Array;
