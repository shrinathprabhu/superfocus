export const tracks = [
  {
    id: 'quiet-orbit',
    name: 'Quiet orbit',
    description: 'Warm, weightless ambient',
    color: '#8e70b8',
  },
  {
    id: 'first-light',
    name: 'First light',
    description: 'Soft keys · a gentle beginning',
    color: '#c8a66f',
  },
  {
    id: 'deep-current',
    name: 'Deep current',
    description: 'Low tones · steady concentration',
    color: '#568f9b',
  },
  {
    id: 'moon-room',
    name: 'Moon room',
    description: 'Slow chords · late-night clarity',
    color: '#7b7fac',
  },
  {
    id: 'still-water',
    name: 'Still water',
    description: 'Floating keys · room to think',
    color: '#649d8d',
  },
  {
    id: 'paper-lantern',
    name: 'Paper lantern',
    description: 'Soft plucks · easy momentum',
    color: '#b0858b',
  },
  {
    id: 'blue-hour',
    name: 'Blue hour',
    description: 'Spacious pads · a quieter mind',
    color: '#627eb6',
  },
  {
    id: 'slow-morning',
    name: 'Slow morning',
    description: 'Warm harmonics · unhurried work',
    color: '#b59472',
  },
  {
    id: 'distant-stars',
    name: 'Distant stars',
    description: 'Bell tones · a little perspective',
    color: '#947bba',
  },
  {
    id: 'home-stretch',
    name: 'Home stretch',
    description: 'Gentle pulse · one more small step',
    color: '#8b9b76',
  },
];
let alarmContext: AudioContext | null = null;
export async function primeAlarm() {
  try {
    alarmContext ??= new AudioContext();
    if (alarmContext.state === 'suspended') await alarmContext.resume();
  } catch {
    /* In-app completion still works when audio is unavailable. */
  }
}
export async function ringAlarm() {
  try {
    await primeAlarm();
    if (!alarmContext) return;
    const ctx = alarmContext;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        t = ctx.currentTime + i * 0.35;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {
    /* Notification and visible completion remain available. */
  }
}
let scheduledNodes: OscillatorNode[] = [];
export function cancelScheduledAlarm() {
  for (const node of scheduledNodes) {
    try {
      node.stop();
      node.disconnect();
    } catch {
      /* Already ended. */
    }
  }
  scheduledNodes = [];
}
export function scheduleAlarm(endAt: number): boolean {
  cancelScheduledAlarm();
  if (!alarmContext || alarmContext.state !== 'running' || endAt <= Date.now())
    return false;
  const ctx = alarmContext,
    when = ctx.currentTime + (endAt - Date.now()) / 1000;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      t = when + i * 0.3;
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.85);
    scheduledNodes.push(o);
  });
  return true;
}
