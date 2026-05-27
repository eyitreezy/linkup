import { useCallback, useEffect, useState } from 'react';

const DEFAULT_COOLDOWN_SEC = 60;

/** Prevents hammering Supabase auth email endpoints (signup resend, password reset). */
export function useEmailSendCooldown(seconds = DEFAULT_COOLDOWN_SEC) {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) setUntil(0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  const startCooldown = useCallback(() => {
    setUntil(Date.now() + seconds * 1000);
  }, [seconds]);

  const canSend = remaining <= 0;

  return { canSend, remaining, startCooldown };
}
