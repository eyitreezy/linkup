import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { invokeVerifyEscrowPayment } from '@/lib/escrow/verifyEscrowPayment';

export type EscrowConfirmationStatus = 'idle' | 'polling' | 'verified' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const VERIFY_AFTER_MS = 5000;
const TIMEOUT_MS = 30000;

type Options = {
  enabled?: boolean;
  txRef?: string | null;
  onVerified?: () => void;
  userId?: string | null;
};

export function useEscrowConfirmation(
  client: SupabaseClient,
  escrowId: string | undefined,
  opts?: Options
) {
  const enabled = opts?.enabled ?? false;
  const txRef = opts?.txRef ?? null;
  const onVerified = opts?.onVerified;
  const userId = opts?.userId ?? null;

  const [status, setStatus] = useState<EscrowConfirmationStatus>('idle');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyCalledRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  }, []);

  const checkEscrowFunded = useCallback(async (): Promise<boolean> => {
    if (!escrowId) return false;
    const { data } = await client
      .from('escrow_transactions')
      .select('status, escrow_pattern, host_id, guest_id, host_funded_at, guest_funded_at')
      .eq('id', escrowId)
      .maybeSingle();
    if (!data) return false;
    if (
      data.status === 'funded' ||
      data.status === 'active' ||
      data.status === 'released'
    ) {
      return true;
    }
    if (data.escrow_pattern === 'B' && userId) {
      if (userId === data.host_id && data.host_funded_at) return true;
      if (userId === data.guest_id && data.guest_funded_at) return true;
    }
    return false;
  }, [client, escrowId, userId]);

  const markVerified = useCallback(() => {
    cleanup();
    setStatus('verified');
    onVerifiedRef.current?.();
  }, [cleanup]);

  const callVerifyEndpoint = useCallback(async (): Promise<boolean> => {
    if (!escrowId || verifyCalledRef.current) return false;
    verifyCalledRef.current = true;
    try {
      const result = await invokeVerifyEscrowPayment(client, escrowId, txRef ?? undefined);
      if (result.funded) {
        markVerified();
        return true;
      }
      if (result.partial) {
        markVerified();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[escrow-confirm] verify endpoint error:', err);
      return false;
    }
  }, [client, escrowId, markVerified, txRef]);

  const retryVerify = useCallback(async (): Promise<boolean> => {
    if (!escrowId) return false;
    verifyCalledRef.current = false;
    const funded = await checkEscrowFunded();
    if (funded) {
      markVerified();
      return true;
    }
    return callVerifyEndpoint();
  }, [callVerifyEndpoint, checkEscrowFunded, escrowId, markVerified]);

  useEffect(() => {
    if (!enabled || !escrowId) {
      cleanup();
      setStatus('idle');
      setSecondsElapsed(0);
      verifyCalledRef.current = false;
      return;
    }

    setStatus('polling');
    setSecondsElapsed(0);
    verifyCalledRef.current = false;

    void checkEscrowFunded().then((funded) => {
      if (funded) markVerified();
    });

    pollRef.current = setInterval(() => {
      void checkEscrowFunded().then((funded) => {
        if (funded) markVerified();
      });
    }, POLL_INTERVAL_MS);

    verifyTimerRef.current = setTimeout(() => {
      void callVerifyEndpoint();
    }, VERIFY_AFTER_MS);

    timeoutRef.current = setTimeout(() => {
      cleanup();
      setStatus((current) => (current === 'verified' ? 'verified' : 'timeout'));
    }, TIMEOUT_MS);

    const ticker = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);

    return () => {
      cleanup();
      clearInterval(ticker);
    };
  }, [callVerifyEndpoint, checkEscrowFunded, cleanup, enabled, escrowId, markVerified]);

  return { status, secondsElapsed, retryVerify, callVerifyEndpoint };
}
