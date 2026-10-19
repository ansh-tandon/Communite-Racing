import { useEffect, useState } from 'react';

/**
 * Milliseconds until `target`, ticking every second.
 * `serverTime` (from the API) corrects for a wrong device clock: the server decides deadlines.
 */
export function useCountdown(target: string | undefined, serverTime?: string): number | null {
  const [offset] = useState(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  return Math.max(0, Date.parse(target) - (now + offset));
}

export function splitMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
