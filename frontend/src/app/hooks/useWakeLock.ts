import { useEffect, useState } from 'react';

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (type: 'release', cb: () => void) => void };

/**
 * Hält den Bildschirm über die Screen Wake Lock API an, solange die Komponente
 * eingehängt ist. Liefert false, wenn der Browser das nicht kann (dann wird
 * der Hinweis in der Oberfläche ausgeblendet).
 */
export function useWakeLock(): boolean {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wakeLockApi) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        sentinel = await wakeLockApi.request('screen');
        if (disposed) {
          await sentinel.release();
          return;
        }
        setIsActive(true);
        sentinel.addEventListener('release', () => setIsActive(false));
      } catch (error) {
        console.error('Wake lock request failed:', error);
        setIsActive(false);
      }
    };

    // Beim Zurückkehren in den Tab erneut anfordern (der Lock wird beim Verlassen freigegeben)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => undefined);
    };
  }, []);

  return isActive;
}
