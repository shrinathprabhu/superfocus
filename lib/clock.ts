/** Align running timers to their next displayed second; idle clocks to a minute. */
export function nextClockDelay(
  endAt: number | null | undefined,
  now: number,
): number {
  return endAt && endAt > now
    ? ((endAt - now - 1) % 1000) + 1
    : 60_000 - (now % 60_000);
}
