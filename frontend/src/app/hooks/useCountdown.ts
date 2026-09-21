import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

interface CountdownState {
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
}

/**
 * Sekündlicher Countdown, der über Zeitstempel rechnet – so bleibt er auch in
 * gedrosselten Hintergrund-Tabs korrekt. `onFinish` feuert genau einmal.
 */
export function useCountdown(initialSeconds: number, onFinish: () => void) {
  const [state, setState] = useState<CountdownState>({
    remainingSeconds: initialSeconds,
    isRunning: false,
    isFinished: false,
  });
  const endAtRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const reset = useCallback((seconds: number) => {
    endAtRef.current = null;
    setState({ remainingSeconds: seconds, isRunning: false, isFinished: false });
  }, []);

  const start = useCallback(() => {
    setState((prev) => {
      if (prev.remainingSeconds <= 0) return prev;
      endAtRef.current = Date.now() + prev.remainingSeconds * 1000;
      return { ...prev, isRunning: true, isFinished: false };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning || endAtRef.current === null) return prev;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      endAtRef.current = null;
      return { ...prev, remainingSeconds: remaining, isRunning: false };
    });
  }, []);

  const toggle = useCallback(() => {
    if (state.isRunning) pause();
    else start();
  }, [state.isRunning, pause, start]);

  useEffect(() => {
    if (!state.isRunning) return;
    const interval = setInterval(() => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      if (remaining <= 0) {
        endAtRef.current = null;
        setState({ remainingSeconds: 0, isRunning: false, isFinished: true });
        onFinishRef.current();
        return;
      }
      setState((prev) => (prev.remainingSeconds === remaining ? prev : { ...prev, remainingSeconds: remaining }));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [state.isRunning]);

  return { ...state, start, pause, toggle, reset };
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
