export type Cycle = 'day' | 'week' | 'fortnight' | 'month';
export type Status = 'todo' | 'inprogress' | 'blocked' | 'done' | 'abandoned';
export type Mode = 'focus' | 'short' | 'long';
export interface Task {
  id: string;
  title: string;
  notes: string;
  status: Status;
  plannedDate: string;
  startAt: string;
  deadline: string;
  goalId: string;
  createdAt: number;
  completedAt: number | null;
  carried: number;
  abandonedReason?: string;
}
export interface Goal {
  id: string;
  title: string;
  target: number;
  deadline: string;
  createdAt: number;
}
export interface Session {
  id: string;
  mode: Mode;
  minutes: number;
  completedAt: number;
  taskId: string;
  goalId: string;
}
export interface TimerState {
  id: string;
  mode: Mode;
  duration: number;
  remaining: number;
  endAt: number | null;
  taskId: string;
  goalId: string;
}
export interface Settings {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  dailyTarget: number;
  cycle: Cycle;
  anchor: string;
  alarm: boolean;
  notifications: boolean;
  wakeLock: boolean;
  volume: number;
  shuffle: boolean;
  trackId: string;
}
export interface AppState {
  version: 1;
  tasks: Task[];
  goals: Goal[];
  sessions: Session[];
  settings: Settings;
  timer: TimerState;
}
export const statusLabels: Record<Status, string> = {
  todo: 'To do',
  inprogress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  abandoned: 'Abandoned',
};
export const cycles: Record<Cycle, string> = {
  day: '1 day',
  week: '1 week',
  fortnight: '2 weeks',
  month: '1 month',
};
export function localDay(d: Date | number = new Date()): string {
  const v = new Date(d);
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
}
export function parseDay(day: string): Date {
  return new Date(`${day}T12:00:00`);
}
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}
export function dayDistance(a: string, b: string): number {
  const [y, m, d] = a.split('-').map(Number);
  const [yy, mm, dd] = b.split('-').map(Number);
  return (Date.UTC(yy, mm - 1, dd) - Date.UTC(y, m - 1, d)) / 86400000;
}
function monthAt(anchor: string, n: number): string {
  const a = parseDay(anchor),
    d = new Date(a.getFullYear(), a.getMonth() + n, 1, 12);
  d.setDate(
    Math.min(
      a.getDate(),
      new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    ),
  );
  return localDay(d);
}
export function sprintFor(
  settings: Pick<Settings, 'cycle' | 'anchor'>,
  day: string = localDay(),
  offset = 0,
): { start: string; end: string; next: string } {
  const { cycle, anchor } = settings;
  if (cycle === 'month') {
    const a = parseDay(anchor),
      d = parseDay(day);
    let n =
      (d.getFullYear() - a.getFullYear()) * 12 + d.getMonth() - a.getMonth();
    if (monthAt(anchor, n) > day) n--;
    n += offset;
    const next = monthAt(anchor, n + 1);
    return { start: monthAt(anchor, n), end: addDays(next, -1), next };
  }
  const length = { day: 1, week: 7, fortnight: 14 }[cycle];
  const n = Math.floor(dayDistance(anchor, day) / length) + offset;
  const start = addDays(anchor, n * length),
    next = addDays(start, length);
  return { start, end: addDays(next, -1), next };
}
export function freshTimer(
  settings: Settings,
  mode: Mode = 'focus',
): TimerState {
  const duration = settings[mode] * 60;
  return {
    id: crypto.randomUUID(),
    mode,
    duration,
    remaining: duration,
    endAt: null,
    taskId: '',
    goalId: '',
  };
}
export function initialState(day = localDay()): AppState {
  const settings: Settings = {
    focus: 25,
    short: 5,
    long: 15,
    longEvery: 4,
    dailyTarget: 4,
    cycle: 'week',
    anchor: day,
    alarm: true,
    notifications: false,
    wakeLock: false,
    volume: 0.4,
    shuffle: false,
    trackId: 'quiet-orbit',
  };
  return {
    version: 1,
    tasks: [],
    goals: [],
    sessions: [],
    settings,
    timer: freshTimer(settings),
  };
}
export const isOpen = (t: Task) =>
  t.status !== 'done' && t.status !== 'abandoned';
export function pendingReview(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => isOpen(t) && t.plannedDate < today);
}
export function remaining(timer: TimerState, now = Date.now()): number {
  // A new deadline can arrive before the display clock's next tick. Cap the
  // countdown at its start/resume balance so a stale tick cannot add time.
  return timer.endAt === null
    ? timer.remaining
    : Math.max(
        0,
        Math.min(timer.remaining, Math.ceil((timer.endAt - now) / 1000)),
      );
}
export function shiftTask(task: Task, to: string): Task {
  const delta = dayDistance(task.plannedDate, to);
  const shift = (s: string) =>
    s ? `${addDays(s.slice(0, 10), delta)}${s.slice(10)}` : '';
  return {
    ...task,
    plannedDate: to,
    startAt: shift(task.startAt),
    deadline: shift(task.deadline),
    status: task.status === 'blocked' ? 'blocked' : 'todo',
    completedAt: null,
    carried: task.carried + 1,
  };
}
export function completeTimer(state: AppState, now: number): AppState {
  const t = state.timer;
  if (t.endAt === null || t.endAt > now) return state;
  if (state.sessions.some((s) => s.id === t.id))
    return { ...state, timer: freshTimer(state.settings) };
  const session: Session = {
    id: t.id,
    mode: t.mode,
    minutes: t.duration / 60,
    completedAt: t.endAt,
    taskId: t.taskId,
    goalId: t.goalId,
  };
  const sessions = [...state.sessions, session];
  const count = sessions.filter((s) => s.mode === 'focus').length;
  const mode =
    t.mode === 'focus'
      ? count % state.settings.longEvery === 0
        ? 'long'
        : 'short'
      : 'focus';
  return { ...state, sessions, timer: freshTimer(state.settings, mode) };
}
export function setStatus(
  task: Task,
  status: Status | 'wontdo',
  now = Date.now(),
): Task {
  return {
    ...task,
    status: status === 'wontdo' ? 'abandoned' : status,
    completedAt: status === 'done' ? now : null,
    abandonedReason:
      status === 'wontdo'
        ? 'Won’t do'
        : status === 'abandoned'
          ? 'Abandoned'
          : undefined,
  };
}
export function displayTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function shortDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
export function minutesLabel(n: number): string {
  return n >= 60
    ? `${Math.floor(n / 60)}h ${Math.round(n % 60)}m`
    : `${Math.round(n)}m`;
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown, max = 1000): v is string =>
  typeof v === 'string' && v.length <= max;
const number = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const date = (v: unknown): v is string =>
  string(v, 10) &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(parseDay(v).getTime()) &&
  localDay(parseDay(v)) === v;
const dateTime = (v: unknown): v is string =>
  v === '' ||
  (string(v, 16) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
    date(v.slice(0, 10)) &&
    !isNaN(new Date(v).getTime()));
export function validateBackup(value: unknown): AppState {
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.settings) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.goals) ||
    !Array.isArray(value.sessions) ||
    value.tasks.length > 20000 ||
    value.goals.length > 1000 ||
    value.sessions.length > 100000
  )
    throw Error('This is not a supported SuperFocus backup.');
  const s = value.settings;
  if (
    !number(s.focus, 1, 180) ||
    !number(s.short, 1, 60) ||
    !number(s.long, 1, 120) ||
    !number(s.longEvery, 1, 12) ||
    !number(s.dailyTarget, 1, 24) ||
    ![s.focus, s.short, s.long, s.longEvery, s.dailyTarget].every(
      Number.isInteger,
    ) ||
    !['day', 'week', 'fortnight', 'month'].includes(String(s.cycle)) ||
    !date(s.anchor) ||
    !number(s.volume, 0, 1) ||
    !string(s.trackId, 100) ||
    ![s.alarm, s.notifications, s.wakeLock, s.shuffle].every(
      (x) => typeof x === 'boolean',
    )
  )
    throw Error('The backup contains invalid settings.');
  for (const t of value.tasks)
    if (
      !object(t) ||
      !string(t.id, 100) ||
      !t.id ||
      !string(t.title, 200) ||
      !t.title.trim() ||
      !string(t.notes, 5000) ||
      !Object.keys(statusLabels).includes(String(t.status)) ||
      !date(t.plannedDate) ||
      !dateTime(t.startAt) ||
      !dateTime(t.deadline) ||
      (t.startAt && t.deadline && t.deadline < t.startAt) ||
      !string(t.goalId, 100) ||
      !number(t.createdAt) ||
      !(t.completedAt === null || number(t.completedAt)) ||
      !number(t.carried, 0, 100000) ||
      !(t.abandonedReason === undefined || string(t.abandonedReason, 100))
    )
      throw Error('The backup contains an invalid task.');
  for (const g of value.goals)
    if (
      !object(g) ||
      !string(g.id, 100) ||
      !g.id ||
      !string(g.title, 200) ||
      !g.title.trim() ||
      !number(g.target, 1, 100000) ||
      !(g.deadline === '' || date(g.deadline)) ||
      !number(g.createdAt)
    )
      throw Error('The backup contains an invalid goal.');
  for (const x of value.sessions)
    if (
      !object(x) ||
      !string(x.id, 100) ||
      !x.id ||
      !['focus', 'short', 'long'].includes(String(x.mode)) ||
      !number(x.minutes, 0, 180) ||
      !number(x.completedAt) ||
      !string(x.taskId, 100) ||
      !string(x.goalId, 100)
    )
      throw Error('The backup contains an invalid session.');
  for (const list of [value.tasks, value.goals, value.sessions])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw Error('The backup contains duplicate IDs.');
  const state = value as unknown as AppState;
  // Never resume a timer from an imported backup or import arbitrary top-level fields.
  return {
    version: 1,
    tasks: state.tasks,
    goals: state.goals,
    sessions: state.sessions,
    settings: state.settings,
    timer: freshTimer(state.settings),
  };
}
