import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeout = useCallback(async () => {
    if (!user) return;
    toast.info('Sessão expirada por inatividade. Faça login novamente.');
    await signOut();
  }, [user, signOut]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(handleTimeout, TIMEOUT_MS);
    }
  }, [user, handleTimeout]);

  useEffect(() => {
    if (!user) return;

    resetTimer();
    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user, resetTimer]);
}
