/** Align running timers to their next displayed second; idle clocks to a minute. */
export function nextClockDelay(
  endAt: number | null | undefined,
  now: number,
): number {
  return endAt && endAt > now
    ? ((endAt - now - 1) % 1000) + 1
    : 60_000 - (now % 60_000);
}

/** Recheck the wall clock so an early timeout cannot complete a session early. */
export function scheduleDeadline(endAt: number, onDeadline: () => void) {
  let timeout: ReturnType<typeof setTimeout>;
  const check = () => {
    const delay = endAt - Date.now();
    if (delay <= 0) onDeadline();
    else timeout = setTimeout(check, Math.min(delay, 2_147_483_647));
  };
  check();
  return () => clearTimeout(timeout);
}
