'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { tracks } from '@/lib/audio';
import {
  deleteMusic,
  musicList,
  saveMusic,
  type LocalTrack,
} from '@/lib/storage';
import type { AppState } from '@/lib/domain';
export function useMusic(
  state: AppState | null,
  change: (f: (s: AppState) => AppState) => Promise<AppState | null>,
  notify: (s: string) => void,
) {
  const [locals, setLocals] = useState<LocalTrack[]>([]),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null),
    current = useRef(state),
    shouldPlay = useRef(false);
  useEffect(() => {
    current.current = state;
  }, [state]);
  const all = [
    ...tracks.map((t) => ({ ...t, local: false })),
    ...locals.map((t) => ({
      id: t.id,
      name: t.name,
      description: 'Your audio · saved on this device',
      color: '#7c94a8',
      local: true,
    })),
  ];
  const allRef = useRef(all);
  useEffect(() => {
    allRef.current = all;
  });
  const selected = all.find((t) => t.id === state?.settings.trackId) ?? all[0];
  const loadLocal = useCallback(
    () =>
      musicList()
        .then(setLocals)
        .catch(() => notify('Your audio library could not be read.')),
    [notify],
  );
  useEffect(() => {
    void loadLocal();
    const a = new Audio();
    a.preload = 'none';
    audio.current = a;
    const pause = () => setPlaying(false),
      play = () => setPlaying(true),
      error = () => {
        shouldPlay.current = false;
        setPlaying(false);
        notify(
          'This audio could not play. Try another track or a supported MP3, WAV, M4A or OGG file.',
        );
      };
    a.addEventListener('pause', pause);
    a.addEventListener('play', play);
    a.addEventListener('error', error);
    return () => {
      a.pause();
      a.removeEventListener('pause', pause);
      a.removeEventListener('play', play);
      a.removeEventListener('error', error);
      a.removeAttribute('src');
      a.load();
    };
  }, [loadLocal, notify]);
  const next = useCallback(() => {
    const list = allRef.current,
      s = current.current;
    if (!s || list.length < 2) return;
    let n = list.findIndex((t) => t.id === s.settings.trackId);
    n = s.settings.shuffle
      ? (n + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
      : (n + 1) % list.length;
    void change((v) => ({
      ...v,
      settings: { ...v.settings, trackId: list[n].id },
    }));
  }, [change]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const end = () => {
      if (current.current?.settings.shuffle) next();
      else {
        a.currentTime = 0;
        void a.play().catch(() => notify('Press play to continue the music.'));
      }
    };
    a.addEventListener('ended', end);
    return () => a.removeEventListener('ended', end);
  }, [next, notify]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    let url = '';
    const local = locals.find((t) => t.id === selected.id);
    url = local ? URL.createObjectURL(local.blob) : `/audio/${selected.id}.wav`;
    a.src = url;
    a.volume = current.current?.settings.volume ?? 0.4;
    if (shouldPlay.current)
      void a.play().catch(() => {
        setPlaying(false);
        notify('Press play to allow audio in this browser.');
      });
    if ('mediaSession' in navigator)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: selected.name,
        artist: 'SuperFocus',
        album: 'Focus sounds',
      });
    return () => {
      if (local) URL.revokeObjectURL(url);
    };
  }, [selected.id, selected.name, locals, notify]);
  const volume = state?.settings.volume ?? 0.4;
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  const toggle = useCallback(async () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      shouldPlay.current = false;
      a.pause();
      return;
    }
    shouldPlay.current = true;
    try {
      await a.play();
    } catch {
      shouldPlay.current = false;
      setPlaying(false);
      notify('Audio could not start. Tap play again, or try another track.');
    }
  }, [notify]);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: { [key: string]: () => void } = {
      play: () => {
        shouldPlay.current = true;
        void audio.current
          ?.play()
          .catch(() => notify('Open SuperFocus and press play.'));
      },
      pause: () => {
        shouldPlay.current = false;
        audio.current?.pause();
      },
      nexttrack: next,
    };
    for (const [name, fn] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(name as MediaSessionAction, fn);
      } catch {
        /* Action unsupported. */
      }
    }
    return () => {
      for (const name of Object.keys(handlers))
        try {
          navigator.mediaSession.setActionHandler(
            name as MediaSessionAction,
            null,
          );
        } catch {
          /* Action unsupported. */
        }
    };
  }, [next, notify]);
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    let count = 0;
    try {
      for (const file of Array.from(files)) {
        if (
          !file.type.startsWith('audio/') &&
          !/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name)
        ) {
          notify(`${file.name} is not a supported audio file.`);
          continue;
        }
        if (file.size > 30 * 1024 * 1024) {
          notify(`${file.name} is larger than 30 MB.`);
          continue;
        }
        await saveMusic({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
          blob: file,
        });
        count++;
      }
      await loadLocal();
      if (count)
        notify(
          `${count} audio ${count === 1 ? 'file is' : 'files are'} saved on this device.`,
        );
    } catch {
      notify('Audio could not be saved. Device storage may be full.');
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      if (current.current?.settings.trackId === id) {
        shouldPlay.current = false;
        audio.current?.pause();
        await change((s) => ({
          ...s,
          settings: { ...s.settings, trackId: tracks[0].id },
        }));
      }
      await deleteMusic(id);
      await loadLocal();
    } catch {
      notify('The audio file could not be removed.');
    }
  }
  return {
    all,
    selected,
    playing,
    toggle,
    next,
    upload,
    remove,
    busy,
    choose: async (id: string) => {
      shouldPlay.current = true;
      if (id === selected.id) {
        if (audio.current?.paused) await toggle();
      } else
        await change((s) => ({
          ...s,
          settings: { ...s.settings, trackId: id },
        }));
    },
  };
}
