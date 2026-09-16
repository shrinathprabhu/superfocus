'use client';
import { useEffect, useState } from 'react';
import { nextClockDelay } from '@/lib/clock';

/** Only the timer readout subscribes to seconds, not the whole workspace. */
export function useClock(endAt: number | null) {
  // A view switch can mount a readout mid-session; never flash its full duration.
  // The server's initial timer is paused, so this does not change its HTML.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timeout);
      const clock = Date.now();
      setNow(clock);
      if (endAt !== null && endAt > clock && !document.hidden)
        timeout = setTimeout(tick, nextClockDelay(endAt, clock));
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endAt]);
  return now;
}
