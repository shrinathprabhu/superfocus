'use client';
import { memo, useEffect } from 'react';
import { Timer } from 'lucide-react';
import { useClock } from '@/hooks/use-clock';
import { displayTime, remaining, type TimerState } from '@/lib/domain';
import { site } from '@/lib/site-content';

export const TimerDisplay = memo(function TimerDisplay({
  timer,
  compact = false,
  onOpen,
}: {
  timer: TimerState;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const now = useClock(timer.endAt);
  const time = remaining(timer, now);
  const running = timer.endAt !== null;
  const [minutes, seconds] = displayTime(time).split(':');
  useEffect(() => {
    document.title = running
      ? `${displayTime(time)} · ${timer.mode === 'focus' ? 'Focus' : 'Break'} — SuperFocus`
      : site.title;
  }, [running, time, timer.mode]);

  if (compact)
    return (
      <button
        className="mini-timer"
        onClick={onOpen}
        style={{ visibility: running ? 'visible' : 'hidden' }}
        aria-label={`Return to timer: ${minutes} minutes ${seconds} seconds`}
      >
        <Timer size={14} />
        {displayTime(time)}
      </button>
    );

  return (
    <div className={`timer-dial ${running ? 'running' : ''}`}>
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="138" />
        <circle
          className="timer-progress"
          cx="150"
          cy="150"
          r="126"
          strokeDasharray="791.68"
          strokeDashoffset={791.68 * (time / timer.duration)}
        />
      </svg>
      <div>
        <span
          className="timer-digits"
          aria-label={`${Math.floor(time / 60)} minutes ${time % 60} seconds`}
        >
          {minutes}
          <span>:</span>
          {seconds}
        </span>
        <p>
          {timer.mode === 'focus'
            ? running
              ? 'Just you and the next small step'
              : 'A little focus goes a long way'
            : 'Breathe. Stretch. Look away.'}
        </p>
      </div>
    </div>
  );
});
