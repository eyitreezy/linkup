import { subscribeMatchMakerTabPulse } from '@/lib/matchmaker/tabNavigation';
import { useEffect, useState } from 'react';

/** Increments when the user re-taps the MatchMaker tab while on the connection screen. */
export function useMatchMakerTabPulse() {
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    return subscribeMatchMakerTabPulse(() => setPulseKey((k) => k + 1));
  }, []);

  return pulseKey;
}
