import { createVideoPlayer } from 'expo-video';

const PROBE_TIMEOUT_MS = 15_000;

/** Read actual encoded duration from a local or remote video URI (seconds). */
export function probeProfileVideoDurationSeconds(uri: string): Promise<number | null> {
  return new Promise((resolve) => {
    const player = createVideoPlayer(uri);
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      player.release();
      resolve(duration);
    };

    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        const duration = player.duration;
        finish(Number.isFinite(duration) && duration > 0 ? duration : null);
      }
      if (status === 'error') {
        finish(null);
      }
    });

    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);

    if (player.status === 'readyToPlay') {
      const duration = player.duration;
      if (Number.isFinite(duration) && duration > 0) {
        finish(duration);
      }
    }
  });
}
