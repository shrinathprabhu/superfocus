'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeTimer,
  localDay,
  remaining,
  type AppState,
} from '@/lib/domain';
import { readState, updateState } from '@/lib/storage';
import { ringAlarm, scheduleAlarm, cancelScheduledAlarm } from '@/lib/audio';
import { nextClockDelay, scheduleDeadline } from '@/lib/clock';
export function useSuperfocus() {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [now, setNow] = useState(0),
    [offline, setOffline] = useState(false),
    [offlineReady, setOfflineReady] = useState(false),
    [wakeActive, setWakeActive] = useState(false),
    [loaded, setLoaded] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null),
    busy = useRef(false),
    latest = useRef(state),
    scheduled = useRef<string | null>(null);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const change = useCallback(async (f: (s: AppState) => AppState) => {
    try {
      const next = await updateState(f);
      setState(next);
      setError('');
      channel.current?.postMessage('changed');
      return next;
    } catch (e) {
      setError(
        `Could not save your changes. ${e instanceof Error ? e.message : 'Device storage may be full.'}`,
      );
      return null;
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    setNow(Date.now());
    updateState((s) => s)
      .then((s) => {
        if (mounted) {
          setState(s);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(
            `Local storage is unavailable. ${e.message} Try a regular browser window with storage enabled.`,
          );
          setLoaded(true);
        }
      });
    const refresh = () => {
      readState()
        .then((s) => mounted && setState(s))
        .catch((e) => mounted && setError(e.message));
    };
    try {
      channel.current = new BroadcastChannel('superfocus-state');
      channel.current.onmessage = refresh;
    } catch {
      /* Visibility refresh supports browsers without BroadcastChannel. */
    }
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    document.addEventListener('visibilitychange', refresh);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setOfflineReady(!!reg.active);
          const watch = () => {
            const w = reg.installing;
            w?.addEventListener('statechange', () => {
              if (w.state === 'activated') {
                setOfflineReady(true);
                setNotice('SuperFocus is ready to use offline.');
              } else if (w.state === 'redundant' && !reg.active) {
                setOfflineReady(false);
                setNotice(
                  'Offline download did not finish. Keep your connection on and reopen SuperFocus to try again.',
                );
              }
            });
          };
          watch();
          reg.addEventListener('updatefound', watch);
        })
        .catch(() =>
          setNotice(
            'Offline installation could not finish. Reopen while online to try again.',
          ),
        );
    }
    return () => {
      mounted = false;
      channel.current?.close();
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timeout);
      const clock = Date.now();
      setNow(clock);
      // Dates and overdue labels need minute updates. TimerDisplay owns seconds.
      if (!document.hidden)
        timeout = setTimeout(tick, nextClockDelay(null, clock));
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  useEffect(() => {
    const endAt = state?.timer.endAt;
    if (endAt == null) return;
    // Completion stays deadline-driven even with no visible timer readout.
    return scheduleDeadline(endAt, () => setNow(Date.now()));
  }, [state?.timer.endAt]);
  useEffect(() => {
    if (!state?.timer.endAt) return;
    if (state.settings.alarm && scheduleAlarm(state.timer.endAt))
      scheduled.current = state.timer.id;
    const endAt = state.timer.endAt;
    return () => {
      if (Date.now() < endAt) cancelScheduledAlarm();
    };
  }, [state?.timer.endAt, state?.timer.id, state?.settings.alarm]);
  useEffect(() => {
    const s = latest.current;
    if (
      !s ||
      s.timer.endAt === null ||
      remaining(s.timer, now) > 0 ||
      busy.current
    )
      return;
    busy.current = true;
    const finished = s.timer;
    let didComplete = false;
    void change((current) => {
      if (
        current.timer.id !== finished.id ||
        !current.timer.endAt ||
        current.timer.endAt > Date.now()
      )
        return current;
      didComplete = true;
      return completeTimer(current, Date.now());
    })
      .then(async (next) => {
        if (next && didComplete) {
          const title =
            finished.mode === 'focus'
              ? 'Focus session complete'
              : 'Break complete';
          const body =
            finished.mode === 'focus'
              ? 'Nice work. Take a breath and enjoy a break.'
              : 'Ready for another small step? Your next focus session is ready.';
          setNotice(`${title}. ${body}`);
          if (s.settings.alarm && scheduled.current !== finished.id)
            void ringAlarm();
          scheduled.current = null;
          if (
            s.settings.notifications &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              const reg =
                'serviceWorker' in navigator
                  ? await navigator.serviceWorker.getRegistration()
                  : undefined;
              if (reg)
                await reg.showNotification(title, {
                  body,
                  icon: '/icons/icon-192.png',
                  tag: finished.id,
                  data: { url: '/' },
                });
              else new Notification(title, { body, tag: finished.id });
            } catch {
              setNotice(
                `${title}. Your browser could not display a system notification.`,
              );
            }
          }
        }
      })
      .finally(() => {
        busy.current = false;
      });
  }, [now, change, state?.timer.id, state?.timer.endAt]);
  useEffect(() => {
    if (
      !state?.settings.wakeLock ||
      !state.timer.endAt ||
      !('wakeLock' in navigator)
    ) {
      setWakeActive(false);
      return;
    }
    let lock: WakeLockSentinel | null = null,
      disposed = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released))
        return;
      try {
        const result = await navigator.wakeLock.request('screen');
        if (disposed) {
          await result.release();
          return;
        }
        lock = result;
        setWakeActive(true);
        result.addEventListener('release', () => setWakeActive(false));
      } catch {
        setWakeActive(false);
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
      setWakeActive(false);
    };
  }, [state?.settings.wakeLock, state?.timer.endAt]);
  return {
    state,
    change,
    error,
    notice,
    setNotice,
    now,
    today: localDay(now),
    offline,
    offlineReady,
    wakeActive,
    loaded,
  };
}
