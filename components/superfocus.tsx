'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Timer,
  ListTodo,
  Target,
  Headphones,
  Settings2,
  Play,
  Pause,
  RotateCcw,
  ArrowUpRight,
  Plus,
  Zap,
  ShieldCheck,
  CalendarDays,
  SkipForward,
  Shuffle,
  Volume2,
  Upload,
  Download,
  Check,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Bell,
  WifiOff,
  Monitor,
  CheckCircle2,
  Clock,
  Leaf,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useSuperfocus } from '@/hooks/use-superfocus';
import { useMusic } from '@/hooks/use-music';
import { Picker, TaskEditor, GoalEditor } from '@/components/controls';
import {
  initialState,
  localDay,
  remaining,
  displayTime,
  sprintFor,
  isOpen,
  pendingReview,
  shortDate,
  minutesLabel,
  shiftTask,
  setStatus,
  freshTimer,
  statusLabels,
  cycles,
  validateBackup,
  addDays,
  type Task,
  type Goal,
  type Mode,
  type Cycle,
  type AppState,
  type Settings,
} from '@/lib/domain';
import { primeAlarm, ringAlarm } from '@/lib/audio';
import { site } from '@/lib/site-content';
type View = 'focus' | 'planner' | 'goals' | 'music' | 'settings';
const navigation = [
  { icon: Timer, label: 'Focus', id: 'focus' },
  { icon: ListTodo, label: 'Sprint planner', id: 'planner' },
  { icon: Target, label: 'Goals', id: 'goals' },
  { icon: Headphones, label: 'Sound library', id: 'music' },
] as const;
const titles: Record<
  View,
  { title: string; eyebrow: string; description: string }
> = {
  focus: {
    title: 'SuperFocus: your focus space',
    eyebrow: 'MAKE ROOM FOR WHAT MATTERS',
    description:
      'A free Pomodoro timer, to-do list and focus music. One thing at a time.',
  },
  planner: {
    title: 'A little plan. A clear path',
    eyebrow: 'YOUR SPRINT PLANNER',
    description: 'Put the right things in reach. Leave room to breathe.',
  },
  goals: {
    title: 'Small steps, bigger things',
    eyebrow: 'A DIRECTION FOR YOUR FOCUS',
    description: 'Turn time well spent into meaningful progress.',
  },
  music: {
    title: 'Find your frequency',
    eyebrow: 'YOUR SOUND LIBRARY',
    description: 'Ten original ambient compositions. A little room to think.',
  },
  settings: {
    title: 'Make this space yours',
    eyebrow: 'YOUR PREFERENCES',
    description: 'A rhythm that works for you. All saved on this device.',
  },
};
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
function NavItem({
  id,
  label,
  icon: Icon,
  active,
  onSelect,
}: {
  id: View;
  label: string;
  icon: typeof Timer;
  active: boolean;
  onSelect: (v: View) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => {
          onSelect(id);
          setOpenMobile(false);
        }}
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
export default function SuperFocus({
  children,
}: {
  children: React.ReactNode;
}) {
  const model = useSuperfocus(),
    {
      state,
      change,
      error,
      notice,
      setNotice,
      now,
      today,
      offline,
      offlineReady,
      wakeActive,
      loaded,
    } = model;
  const fallback = useMemo(() => initialState('1970-01-01'), []),
    s = state ?? fallback;
  const [view, setView] = useState<View>('focus'),
    [taskEditor, setTaskEditor] = useState<Task | 'new' | null>(null),
    [goalEditor, setGoalEditor] = useState<Goal | 'new' | null>(null),
    [sprintOffset, setSprintOffset] = useState(0),
    [filter, setFilter] = useState('open'),
    [selectedTask, setSelectedTask] = useState(''),
    [reviewOpen, setReviewOpen] = useState(false),
    [reviewChoices, setReviewChoices] = useState<Record<string, boolean>>({}),
    [reviewBusy, setReviewBusy] = useState(false),
    [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null),
    [installHelp, setInstallHelp] = useState(false),
    [restore, setRestore] = useState<AppState | null>(null),
    [deleteTrack, setDeleteTrack] = useState<string | null>(null),
    [installed, setInstalled] = useState(false),
    [storagePersistent, setStoragePersistent] = useState(false),
    [notificationPermission, setNotificationPermission] = useState('default'),
    [timerBusy, setTimerBusy] = useState(false);
  const music = useMusic(state, change, setNotice),
    reviewedDay = useRef(''),
    uploadRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const sprint = sprintFor(s.settings, today, sprintOffset),
    review = pendingReview(s.tasks, today),
    todaySessions = s.sessions.filter(
      (x) => x.mode === 'focus' && localDay(x.completedAt) === today,
    ),
    dailyMinutes = todaySessions.reduce((n, x) => n + x.minutes, 0),
    todayDone = s.tasks.filter(
      (t) => t.completedAt && localDay(t.completedAt) === today,
    ).length;
  const currentSprint = sprintFor(s.settings, today),
    time = remaining(s.timer, now),
    running = s.timer.endAt !== null,
    focusCount = s.sessions.filter((x) => x.mode === 'focus').length,
    sessionNumber = (focusCount % s.settings.longEvery) + 1;
  const activeTasks = s.tasks.filter(
      (t) =>
        isOpen(t) &&
        t.plannedDate <= today &&
        t.plannedDate >= currentSprint.start,
    ),
    sprintTasks = s.tasks.filter(
      (t) => t.plannedDate >= sprint.start && t.plannedDate <= sprint.end,
    ),
    visibleTasks = (
      view === 'focus'
        ? activeTasks
        : sprintTasks.filter((t) =>
            filter === 'open'
              ? isOpen(t)
              : filter === 'done'
                ? t.status === 'done'
                : filter === 'archived'
                  ? t.status === 'abandoned'
                  : true,
          )
    ).sort(
      (a, b) =>
        a.plannedDate.localeCompare(b.plannedDate) ||
        (a.deadline || 'z').localeCompare(b.deadline || 'z') ||
        a.createdAt - b.createdAt,
    );
  const heading = titles[view];
  useEffect(() => {
    if (state && review.length && reviewedDay.current !== today) {
      reviewedDay.current = today;
      setReviewChoices({});
      setReviewOpen(true);
    }
  }, [state, review.length, today]);
  useEffect(() => {
    const handle = (e: Event) => {
        e.preventDefault();
        setInstallEvent(e as InstallPrompt);
      },
      onInstalled = () => {
        setInstalled(true);
        setInstallEvent(null);
      };
    window.addEventListener('beforeinstallprompt', handle);
    window.addEventListener('appinstalled', onInstalled);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    navigator.storage
      ?.persisted?.()
      .then(setStoragePersistent)
      .catch(() => {});
    if ('Notification' in window)
      setNotificationPermission(Notification.permission);
    return () => {
      window.removeEventListener('beforeinstallprompt', handle);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  useEffect(() => {
    document.title = running
      ? `${displayTime(time)} · ${s.timer.mode === 'focus' ? 'Focus' : 'Break'} — SuperFocus`
      : site.title;
  }, [running, time, s.timer.mode]);
  const settings = (patch: Partial<Settings>) =>
    change((v) => ({ ...v, settings: { ...v.settings, ...patch } }));
  const saveTask = async (t: Task) =>
    !!(await change((v) => ({
      ...v,
      tasks: v.tasks.some((x) => x.id === t.id)
        ? v.tasks.map((x) => (x.id === t.id ? t : x))
        : [...v.tasks, t],
    })));
  async function startPause() {
    if (!state || timerBusy) return;
    setTimerBusy(true);
    try {
      await primeAlarm();
      await change((v) => {
        if (v.timer.endAt !== null)
          return {
            ...v,
            timer: { ...v.timer, remaining: remaining(v.timer), endAt: null },
          };
        const fresh = v.timer.remaining === v.timer.duration;
        const task = v.tasks.find(
          (t) => t.id === (fresh ? selectedTask : v.timer.taskId) && isOpen(t),
        );
        return {
          ...v,
          tasks:
            task && v.timer.mode === 'focus'
              ? v.tasks.map((t) =>
                  t.id === task.id ? { ...t, status: 'inprogress' } : t,
                )
              : v.tasks,
          timer: {
            ...v.timer,
            endAt: Date.now() + v.timer.remaining * 1000,
            taskId: fresh ? (task?.id ?? '') : v.timer.taskId,
            goalId: fresh ? (task?.goalId ?? '') : v.timer.goalId,
          },
        };
      });
    } finally {
      setTimerBusy(false);
    }
  }
  async function switchMode(mode: Mode) {
    await change((v) => ({ ...v, timer: freshTimer(v.settings, mode) }));
  }
  async function taskAction(task: Task, action: string) {
    await change((v) => ({
      ...v,
      tasks: v.tasks.map((t) =>
        t.id !== task.id
          ? t
          : action === 'carryover'
            ? shiftTask(t, sprintFor(v.settings, t.plannedDate).next)
            : setStatus(t, action as Parameters<typeof setStatus>[1]),
      ),
    }));
    if (action === 'carryover')
      setNotice(
        'Task moved to its next sprint. Start time and deadline shifted by the same number of days.',
      );
  }
  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotice(
        'System notifications are unavailable here. On iPhone or iPad, install SuperFocus on your Home Screen first.',
      );
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotificationPermission(p);
      await settings({ notifications: p === 'granted' });
      setNotice(
        p === 'granted'
          ? 'Session notifications are enabled.'
          : p === 'denied'
            ? 'Notifications are blocked. You can enable them in your browser’s site settings.'
            : 'Notification permission was not granted.',
      );
    } catch {
      setNotice(
        'This browser cannot request notifications. Try the installed app.',
      );
    }
  }
  async function install() {
    if (installEvent) {
      try {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
      } catch {
        setInstallHelp(true);
      }
    } else setInstallHelp(true);
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `superfocus-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      'Backup downloaded. Imported audio files are kept separately and are not included.',
    );
  }
  async function readBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024)
        throw Error('Choose a backup smaller than 30 MB.');
      setRestore(validateBackup(JSON.parse(await file.text())));
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'This backup could not be read.',
      );
    }
  }
  function taskRows(list: Task[]) {
    return list.length ? (
      <div className="task-list">
        {list.map((task) => (
          <article
            className={`task-row ${task.status === 'done' ? 'task-done' : ''}`}
            key={task.id}
          >
            <Checkbox
              className="task-checkbox"
              checked={task.status === 'done'}
              disabled={task.status === 'abandoned'}
              onCheckedChange={(v) =>
                void taskAction(task, v ? 'done' : 'todo')
              }
              aria-label={`Mark ${task.title} ${task.status === 'done' ? 'incomplete' : 'complete'}`}
            />
            <div className="task-detail">
              <button className="task-name" onClick={() => setTaskEditor(task)}>
                {task.title}
              </button>
              <div className="task-meta">
                <span>
                  <CalendarDays size={12} />
                  {shortDate(task.plannedDate)}
                </span>
                {task.startAt && (
                  <span>
                    <Clock size={12} />
                    Starts{' '}
                    {new Date(task.startAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {task.deadline && (
                  <span
                    className={
                      isOpen(task) && new Date(task.deadline).getTime() < now
                        ? 'overdue'
                        : ''
                    }
                  >
                    Due{' '}
                    {new Date(task.deadline).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {task.carried > 0 && (
                  <span className="carried">
                    <ArrowRight size={12} />
                    Carried {task.carried}×
                  </span>
                )}
                {task.abandonedReason && <span>{task.abandonedReason}</span>}
                {task.goalId && (
                  <span>
                    <Target size={12} />
                    {s.goals.find((g) => g.id === task.goalId)?.title ?? 'Goal'}
                  </span>
                )}
              </div>
            </div>
            <div className="task-controls">
              <Picker
                value={task.status}
                label={`Status for ${task.title}`}
                className={`status-picker status-${task.status}`}
                onChange={(v) => void taskAction(task, v)}
                options={{
                  ...statusLabels,
                  carryover: 'Carry to next sprint',
                  wontdo: 'Won’t do → abandon',
                }}
              />
              {isOpen(task) && (
                <button
                  className="icon-button"
                  disabled={running}
                  aria-label={`Focus on ${task.title}`}
                  title="Focus on this task"
                  onClick={() => {
                    setSelectedTask(task.id);
                    if (
                      s.timer.remaining < s.timer.duration ||
                      s.timer.mode !== 'focus'
                    )
                      void switchMode('focus');
                    setView('focus');
                  }}
                >
                  <Play size={16} />
                </button>
              )}
              <button
                className="icon-button"
                aria-label={`Edit ${task.title}`}
                onClick={() => setTaskEditor(task)}
              >
                <Pencil size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="task-empty">
        <ListTodo />
        <h3>
          {filter === 'done' && view === 'planner'
            ? 'Progress starts with one small step'
            : filter === 'archived' && view === 'planner'
              ? 'Nothing set aside'
              : sprintTasks.length && view === 'planner'
                ? 'A clear view ahead'
                : 'What deserves your attention?'}
        </h3>
        <p>
          {view === 'focus'
            ? 'Add your first task and give it a little focus.'
            : 'Add a task to this sprint, or explore another sprint.'}
        </p>
        {view === 'focus' &&
          s.tasks.some((t) => isOpen(t) && t.plannedDate > today) && (
            <button className="text-button" onClick={() => setView('planner')}>
              View upcoming tasks <ArrowRight size={14} />
            </button>
          )}
      </div>
    );
  }
  const soundPlayer = (
    <>
      <div className="sound-title">
        <span
          className={`sound-cover ${music.playing ? 'is-playing' : ''}`}
          style={
            { '--cover-color': music.selected.color } as React.CSSProperties
          }
        >
          <Headphones />
        </span>
        <div>
          <h2>{music.selected.name}</h2>
          <p>{music.selected.description}</p>
        </div>
        <button
          className="icon-button"
          aria-label="Open sound library"
          onClick={() => setView('music')}
        >
          <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="music-actions">
        <button
          className="secondary"
          disabled={!state}
          onClick={() => void music.toggle()}
        >
          {music.playing ? <Pause size={16} /> : <Play size={16} />}{' '}
          {music.playing ? 'Pause music' : 'Play focus music'}
        </button>
        <button
          className={`icon-button ${s.settings.shuffle ? 'active-icon' : ''}`}
          aria-label="Shuffle tracks"
          aria-pressed={s.settings.shuffle}
          title="Shuffle tracks"
          onClick={() => void settings({ shuffle: !s.settings.shuffle })}
        >
          <Shuffle size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Next track"
          onClick={music.next}
        >
          <SkipForward size={17} />
        </button>
      </div>
      <div className="volume-control">
        <Volume2 size={15} />
        <Slider
          value={[s.settings.volume * 100]}
          onValueChange={(v) =>
            void settings({ volume: (Array.isArray(v) ? v[0] : v) / 100 })
          }
          max={100}
          step={1}
          aria-label="Music volume"
        />
        <span>{Math.round(s.settings.volume * 100)}%</span>
      </div>
    </>
  );
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '224px' } as React.CSSProperties}
    >
      <a href="#main" className="skip-link">
        Skip to workspace
      </a>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <button
            className="brand"
            onClick={() => setView('focus')}
            aria-label="SuperFocus home"
          >
            <span className="brand-icon">
              <Zap fill="currentColor" />
            </span>
            superfocus<span className="brand-dot">.</span>
          </button>
          <span className="byline">A PLACE FOR YOUR FOCUS</span>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Workspace views">
            <span className="nav-label">WORKSPACE</span>
            <SidebarMenu>
              {navigation.map((n) => (
                <NavItem
                  key={n.id}
                  {...n}
                  active={view === n.id}
                  onSelect={setView}
                />
              ))}
            </SidebarMenu>
          </nav>
          <div className="sidebar-sprint">
            <span className="eyebrow">THIS SPRINT</span>
            <p>
              {state
                ? `${shortDate(currentSprint.start)} — ${shortDate(currentSprint.end)}`
                : 'Your next small steps'}
            </p>
            <Progress
              value={
                (s.tasks.filter(
                  (t) =>
                    t.plannedDate >= currentSprint.start &&
                    t.plannedDate <= currentSprint.end &&
                    t.status === 'done',
                ).length /
                  Math.max(
                    1,
                    s.tasks.filter(
                      (t) =>
                        t.plannedDate >= currentSprint.start &&
                        t.plannedDate <= currentSprint.end &&
                        t.status !== 'abandoned',
                    ).length,
                  )) *
                100
              }
              aria-label="Current sprint completion"
            />
            <button
              className="text-button"
              onClick={() => {
                setSprintOffset(0);
                setView('planner');
              }}
            >
              A little progress, every day <ArrowRight size={13} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="local-note">
            <ShieldCheck />
            <div>
              Yours. And only yours.
              <small>
                {offline ? 'Working offline' : 'Saved on this device'}
              </small>
            </div>
          </div>
          <SidebarMenu>
            <NavItem
              id="settings"
              label="Settings"
              icon={Settings2}
              active={view === 'settings'}
              onSelect={setView}
            />
          </SidebarMenu>
          {!installed && (
            <button className="install-sidebar" onClick={() => void install()}>
              <Download size={15} /> Install SuperFocus
            </button>
          )}
          <a
            className="lowkey"
            href="https://lowkey.tools"
            target="_blank"
            rel="noreferrer"
          >
            a lowkey.tools creation <ArrowUpRight size={14} />
          </a>
          <div className="sidebar-makers">
            <a href="https://owleye.dev">By OwlEye Analytics ↗</a>
            <a href="https://shrinath.me" rel="author">
              Built by Shrinath ↗
            </a>
            <a href="#about">About SuperFocus & FAQ</a>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <span>
            <SidebarTrigger className="mobile-trigger" />
            <Timer size={17} />{' '}
            {view === 'focus'
              ? 'Your focus space'
              : (navigation.find((n) => n.id === view)?.label ?? 'Settings')}
          </span>
          <span className="topbar-right">
            {running && view !== 'focus' && (
              <button className="mini-timer" onClick={() => setView('focus')}>
                <Timer size={14} />
                {displayTime(time)}
              </button>
            )}
            <span className="local-badge">
              {offline ? <WifiOff size={13} /> : <i />}
              {offline ? 'Offline' : 'Local & private'}
            </span>
          </span>
        </header>
        <main className="main-content" id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{heading.eyebrow}</div>
              <h1>
                {heading.title}
                <span>.</span>
              </h1>
              <p>{heading.description}</p>
            </div>
            <span className="date-label" suppressHydrationWarning>
              <CalendarDays size={16} />
              {now
                ? new Date(now).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })
                : 'Your daily workspace'}
            </span>
          </div>
          {error && (
            <div className="notice error-notice" role="alert">
              <span>{error}</span>
              <button
                className="secondary"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <output className="notice">
              <CheckCircle2 size={17} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </output>
          )}
          {review.length > 0 && !reviewOpen && (
            <button
              className="review-banner"
              onClick={() => setReviewOpen(true)}
            >
              <ArrowRight size={17} />
              <span>
                {review.length} unfinished{' '}
                {review.length === 1 ? 'task needs' : 'tasks need'} a fresh
                plan.
              </span>{' '}
              Review <ArrowUpRight size={15} />
            </button>
          )}
          {view === 'focus' && (
            <>
              <div className="focus-grid">
                <section className="timer-card" aria-label="Pomodoro timer">
                  <div className="timer-top">
                    <span className="eyebrow">
                      {running
                        ? 'YOU’RE IN YOUR FOCUS SPACE'
                        : s.timer.mode === 'focus'
                          ? 'TIME TO FOCUS'
                          : 'ROOM TO RECHARGE'}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Timer settings"
                      onClick={() => setView('settings')}
                    >
                      <Settings2 size={18} />
                    </button>
                  </div>
                  <Tabs
                    value={s.timer.mode}
                    onValueChange={(v) => void switchMode(String(v) as Mode)}
                  >
                    <TabsList className="timer-tabs">
                      <TabsTrigger value="focus" disabled={running}>
                        Pomodoro
                      </TabsTrigger>
                      <TabsTrigger value="short" disabled={running}>
                        Short break
                      </TabsTrigger>
                      <TabsTrigger value="long" disabled={running}>
                        Long break
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value={s.timer.mode} className="sr-only">
                      {s.timer.mode === 'focus' ? 'Focus' : 'Break'} timer
                    </TabsContent>
                  </Tabs>
                  <div className={`timer-dial ${running ? 'running' : ''}`}>
                    <svg viewBox="0 0 300 300" aria-hidden="true">
                      <circle cx="150" cy="150" r="138" />
                      <circle
                        className="timer-progress"
                        cx="150"
                        cy="150"
                        r="126"
                        strokeDasharray="791.68"
                        strokeDashoffset={791.68 * (time / s.timer.duration)}
                      />
                    </svg>
                    <div>
                      <span
                        className="timer-digits"
                        aria-label={`${Math.floor(time / 60)} minutes ${time % 60} seconds`}
                      >
                        {displayTime(time).split(':')[0]}
                        <span>:</span>
                        {displayTime(time).split(':')[1]}
                      </span>
                      <p>
                        {s.timer.mode === 'focus'
                          ? running
                            ? 'Just you and the next small step'
                            : 'A little focus goes a long way'
                          : 'Breathe. Stretch. Look away.'}
                      </p>
                    </div>
                  </div>
                  <div className="timer-actions">
                    <button
                      className="primary"
                      onClick={() => void startPause()}
                      disabled={!state || timerBusy}
                    >
                      {running ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" />
                      )}
                      {running
                        ? 'Pause session'
                        : s.timer.remaining < s.timer.duration
                          ? 'Resume session'
                          : s.timer.mode === 'focus'
                            ? 'Start focusing'
                            : 'Start break'}
                    </button>
                    <button
                      className="icon-button"
                      disabled={!state}
                      aria-label="Reset current timer"
                      title="Reset current timer"
                      onClick={() => void switchMode(s.timer.mode)}
                    >
                      <RotateCcw />
                    </button>
                  </div>
                  <div className="session-dots">
                    {Array.from({ length: s.settings.longEvery }, (_, i) => (
                      <i
                        key={i}
                        className={i < sessionNumber ? 'filled' : ''}
                      />
                    ))}
                    <span>
                      Session {sessionNumber} of {s.settings.longEvery}
                    </span>
                  </div>
                  <div className="focus-task-select">
                    <Target size={14} />
                    <Picker
                      label="Task to focus on"
                      value={
                        running || s.timer.remaining < s.timer.duration
                          ? s.timer.taskId
                          : selectedTask
                      }
                      disabled={
                        running ||
                        s.timer.remaining < s.timer.duration ||
                        !state
                      }
                      onChange={setSelectedTask}
                      options={{
                        '': 'Focus without a task',
                        ...Object.fromEntries(
                          s.tasks.filter(isOpen).map((t) => [t.id, t.title]),
                        ),
                      }}
                    />
                  </div>
                  {wakeActive && (
                    <span className="awake-label">
                      <Monitor size={12} /> Screen staying awake
                    </span>
                  )}
                </section>
                <div className="right-stack">
                  <section className="panel">
                    <div className="section-title">
                      <h2>Your daily rhythm</h2>
                      <Zap size={18} />
                    </div>
                    <div className="rhythm-number">
                      {todaySessions.length}{' '}
                      <span>/ {s.settings.dailyTarget} sessions</span>
                    </div>
                    <Progress
                      className="daily-progress"
                      value={Math.min(
                        100,
                        (todaySessions.length / s.settings.dailyTarget) * 100,
                      )}
                      aria-label="Daily focus session goal"
                    />
                    <p className="muted rhythm-caption">
                      {todaySessions.length >= s.settings.dailyTarget
                        ? 'Your daily goal, reached. Nicely done.'
                        : 'Every focused minute is a step forward.'}
                    </p>
                    <div className="stats-pair">
                      <div>
                        <strong>{minutesLabel(dailyMinutes)}</strong>
                        <span>Focus time</span>
                      </div>
                      <div>
                        <strong>{todayDone}</strong>
                        <span>Tasks completed</span>
                      </div>
                    </div>
                  </section>
                  <section className="panel sound-card">
                    <span className="eyebrow">SET THE MOOD</span>
                    {soundPlayer}
                  </section>
                </div>
              </div>
              <section className="panel task-panel">
                <div className="section-title">
                  <div>
                    <h2>
                      On your radar{' '}
                      <span className="count">{visibleTasks.length}</span>
                    </h2>
                    <p className="muted">
                      A little intention for your next session.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    disabled={!state}
                    onClick={() => setTaskEditor('new')}
                  >
                    <Plus size={16} /> Add task
                  </button>
                </div>
                {taskRows(visibleTasks)}
                {s.tasks.length > 0 && (
                  <button
                    className="text-button planner-link"
                    onClick={() => setView('planner')}
                  >
                    Open sprint planner <ArrowRight size={14} />
                  </button>
                )}
              </section>
            </>
          )}
          {view === 'planner' && (
            <>
              <section className="panel sprint-toolbar">
                <div className="sprint-navigation">
                  <button
                    className="icon-button"
                    aria-label="Previous sprint"
                    onClick={() => setSprintOffset((v) => v - 1)}
                  >
                    <ChevronLeft />
                  </button>
                  <div>
                    <span className="eyebrow">
                      {sprintOffset === 0
                        ? 'CURRENT SPRINT'
                        : sprintOffset < 0
                          ? 'PAST SPRINT'
                          : 'UPCOMING SPRINT'}
                    </span>
                    <h2>
                      {shortDate(sprint.start)} — {shortDate(sprint.end)},{' '}
                      {sprint.end.slice(0, 4)}
                    </h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Next sprint"
                    onClick={() => setSprintOffset((v) => v + 1)}
                  >
                    <ChevronRight />
                  </button>
                  {sprintOffset !== 0 && (
                    <button
                      className="text-button"
                      onClick={() => setSprintOffset(0)}
                    >
                      Today
                    </button>
                  )}
                </div>
                <div className="inline-actions">
                  <Picker
                    label="Sprint cycle"
                    value={s.settings.cycle}
                    options={cycles}
                    onChange={(v) => {
                      setSprintOffset(0);
                      void settings({ cycle: v as Cycle });
                    }}
                  />
                  <button
                    className="primary"
                    disabled={!state}
                    onClick={() => setTaskEditor('new')}
                  >
                    <Plus size={16} /> Add task
                  </button>
                </div>
              </section>
              <section className="panel planner-panel">
                <Tabs
                  value={filter}
                  onValueChange={(v) => setFilter(String(v))}
                >
                  <div className="planner-filter-row">
                    <TabsList className="planner-tabs" variant="line">
                      <TabsTrigger value="open">
                        Active <span>{sprintTasks.filter(isOpen).length}</span>
                      </TabsTrigger>
                      <TabsTrigger value="done">Done</TabsTrigger>
                      <TabsTrigger value="archived">Abandoned</TabsTrigger>
                      <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>
                    <span className="muted">
                      {sprintTasks.filter((t) => t.status === 'done').length}{' '}
                      completed
                    </span>
                  </div>
                  <TabsContent value={filter}>
                    {taskRows(visibleTasks)}
                  </TabsContent>
                </Tabs>
              </section>
              <p className="help-line">
                <ArrowRight size={14} /> Carryover moves a task to its next
                sprint and shifts its start time and deadline. “Won’t do”
                abandons it.
              </p>
            </>
          )}
          {view === 'goals' && (
            <>
              <div className="section-title goals-heading">
                <h2>
                  Your intentions{' '}
                  <span className="count">{s.goals.length}</span>
                </h2>
                <button
                  className="primary"
                  disabled={!state}
                  onClick={() => setGoalEditor('new')}
                >
                  <Plus size={16} /> New goal
                </button>
              </div>
              <div className="goals-grid">
                {s.goals.map((g) => {
                  const minutes = s.sessions
                      .filter((x) => x.mode === 'focus' && x.goalId === g.id)
                      .reduce((n, x) => n + x.minutes, 0),
                    pct = Math.min(100, (minutes / g.target) * 100);
                  return (
                    <section className="panel goal-card" key={g.id}>
                      <div className="section-title">
                        <span className="goal-icon">
                          {pct === 100 ? <CheckCircle2 /> : <Target />}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${g.title}`}
                          onClick={() => setGoalEditor(g)}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <h2>{g.title}</h2>
                      <div className="goal-progress-label">
                        <span>
                          {minutesLabel(minutes)}{' '}
                          <span className="muted">
                            of {minutesLabel(g.target)}
                          </span>
                        </span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <Progress
                        value={pct}
                        aria-label={`Progress toward ${g.title}`}
                      />
                      <p className="muted">
                        {g.deadline
                          ? `${g.deadline < today && pct < 100 ? 'Past target · ' : ''}Target ${shortDate(g.deadline)}`
                          : 'At your own pace'}{' '}
                        ·{' '}
                        {
                          s.tasks.filter((t) => t.goalId === g.id && isOpen(t))
                            .length
                        }{' '}
                        active tasks
                      </p>
                    </section>
                  );
                })}
              </div>
              {!s.goals.length && (
                <section className="panel goal-empty">
                  <Target size={40} />
                  <h2>What would you like to make time for?</h2>
                  <p>
                    Set a focus-time goal, link a few tasks, and watch the small
                    sessions add up.
                  </p>
                  <button
                    className="secondary"
                    disabled={!state}
                    onClick={() => setGoalEditor('new')}
                  >
                    <Plus size={16} /> Create your first goal
                  </button>
                </section>
              )}
              <section className="panel weekly-panel">
                <div className="section-title">
                  <div>
                    <h2>A week of showing up</h2>
                    <p className="muted">
                      Your completed focus time, one day at a time.
                    </p>
                  </div>
                  <span className="goal-icon">
                    <Zap />
                  </span>
                </div>
                <div className="week-chart">
                  {Array.from({ length: 7 }, (_, i) => {
                    const day = addDays(today, i - 6),
                      minutes = s.sessions
                        .filter(
                          (x) =>
                            x.mode === 'focus' &&
                            localDay(x.completedAt) === day,
                        )
                        .reduce((n, x) => n + x.minutes, 0),
                      max = Math.max(
                        60,
                        ...Array.from({ length: 7 }, (_, j) =>
                          s.sessions
                            .filter(
                              (x) =>
                                x.mode === 'focus' &&
                                localDay(x.completedAt) ===
                                  addDays(today, j - 6),
                            )
                            .reduce((n, x) => n + x.minutes, 0),
                        ),
                      );
                    return (
                      <div className="chart-column" key={day}>
                        <span>{minutesLabel(minutes)}</span>
                        <div className="chart-track">
                          <div
                            style={{ height: `${(minutes / max) * 100}%` }}
                          />
                        </div>
                        <span>
                          {day === today
                            ? 'Today'
                            : new Date(`${day}T12:00`).toLocaleDateString(
                                undefined,
                                { weekday: 'short' },
                              )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
          {view === 'music' && (
            <>
              <section className="panel library-player">
                <div>
                  <span className="eyebrow">
                    {music.playing ? 'NOW PLAYING' : 'YOUR FOCUS COMPANION'}
                  </span>
                  {soundPlayer}
                </div>
                <div className="library-caption">
                  <ShieldCheck size={22} />
                  <p>Original music. Zero subscriptions.</p>
                  <span>
                    Royalty-free ambient loops, included for offline listening.
                    No accounts or keys.
                  </span>
                </div>
              </section>
              <div className="section-title library-heading">
                <h2>
                  Pick a little atmosphere <span className="count">10</span>
                </h2>
                <span className="muted">
                  48-second compositions · continuous play
                </span>
              </div>
              <div className="tracks-grid">
                {music.all.map((t) => (
                  <article
                    className={`track-card ${s.settings.trackId === t.id ? 'selected-track' : ''}`}
                    key={t.id}
                  >
                    <button
                      className="track-play"
                      style={
                        { '--cover-color': t.color } as React.CSSProperties
                      }
                      onClick={() =>
                        void (s.settings.trackId === t.id && music.playing
                          ? music.toggle()
                          : music.choose(t.id))
                      }
                      aria-label={`${s.settings.trackId === t.id && music.playing ? 'Pause' : 'Play'} ${t.name}`}
                    >
                      <span className="track-art">
                        <span />
                        <span />
                        <span />
                      </span>
                      {s.settings.trackId === t.id && music.playing ? (
                        <Pause size={24} fill="currentColor" />
                      ) : (
                        <Play size={24} fill="currentColor" />
                      )}
                    </button>
                    <div className="track-info">
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      {t.local && (
                        <button
                          className="icon-button remove-track"
                          onClick={() => setDeleteTrack(t.id)}
                          aria-label={`Remove ${t.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <section className="panel upload-panel">
                <div>
                  <h2>Your sound, your space</h2>
                  <p className="muted">
                    Add MP3, WAV, M4A or OGG files. Up to 30 MB each, saved
                    locally.
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={music.busy || !state}
                  onClick={() => uploadRef.current?.click()}
                >
                  <Upload size={16} />
                  {music.busy ? 'Saving audio…' : 'Add your audio'}
                </button>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
                  multiple
                  hidden
                  onChange={(e) => {
                    void music.upload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </section>
              <p className="help-line">
                The ten included compositions are dedicated to the public domain
                under CC0. Your uploads stay on your device.
              </p>
            </>
          )}
          {view === 'settings' && (
            <div className="settings-layout">
              <section className="panel">
                <div className="settings-section-title">
                  <Timer />
                  <div>
                    <h2>Your focus rhythm</h2>
                    <p className="muted">
                      New durations apply to your next timer.
                    </p>
                  </div>
                </div>
                <div className="form-grid settings-numbers">
                  {(
                    [
                      { key: 'focus', label: 'Pomodoro', max: 180 },
                      { key: 'short', label: 'Short break', max: 60 },
                      { key: 'long', label: 'Long break', max: 120 },
                      { key: 'longEvery', label: 'Long break every', max: 12 },
                      {
                        key: 'dailyTarget',
                        label: 'Daily session goal',
                        max: 24,
                      },
                    ] as const
                  ).map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <div className="number-field">
                        <Input
                          key={`${field.key}-${s.settings[field.key]}`}
                          type="number"
                          min={1}
                          max={field.max}
                          step={1}
                          defaultValue={s.settings[field.key]}
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isInteger(n) && n >= 1 && n <= field.max)
                              void settings({ [field.key]: n });
                            else {
                              e.target.value = String(s.settings[field.key]);
                              setNotice(
                                `Use a whole number from 1 to ${field.max}.`,
                              );
                            }
                          }}
                        />
                        <span>
                          {field.key === 'longEvery' ||
                          field.key === 'dailyTarget'
                            ? 'sessions'
                            : 'minutes'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Session alarm</h3>
                    <p>A gentle chime when your timer ends.</p>
                  </div>
                  <Switch
                    aria-label="Session alarm"
                    checked={s.settings.alarm}
                    onCheckedChange={(v) => void settings({ alarm: v })}
                  />
                </div>
                <button
                  className="text-button"
                  onClick={() => void ringAlarm()}
                >
                  <Volume2 size={14} /> Test alarm
                </button>
              </section>
              <section className="panel">
                <div className="settings-section-title">
                  <CalendarDays />
                  <div>
                    <h2>Plan your sprints</h2>
                    <p className="muted">
                      Tasks are grouped by their planned day.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Sprint length
                    <Picker
                      label="Sprint length"
                      value={s.settings.cycle}
                      options={cycles}
                      onChange={(v) => {
                        setSprintOffset(0);
                        void settings({ cycle: v as Cycle });
                      }}
                    />
                  </label>
                  <label>
                    Cycle starts on
                    <Input
                      type="date"
                      value={s.settings.anchor}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSprintOffset(0);
                          void settings({ anchor: e.target.value });
                        }
                      }}
                    />
                  </label>
                </div>
                <p className="setting-help">
                  At the start of a new day, you’ll be asked whether unfinished
                  tasks should carry forward or be abandoned. Monthly cycles
                  follow calendar months from your chosen start date.
                </p>
              </section>
              <section className="panel">
                <div className="settings-section-title">
                  <Bell />
                  <div>
                    <h2>Stay in the loop</h2>
                    <p className="muted">
                      A nudge when it’s time to take a break.
                    </p>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Session notifications</h3>
                    <p>
                      {notificationPermission === 'granted'
                        ? 'Browser permission granted.'
                        : notificationPermission === 'denied'
                          ? 'Blocked in your browser’s site settings.'
                          : 'Ask this browser to show session alerts.'}
                    </p>
                  </div>
                  <Switch
                    aria-label="Session notifications"
                    checked={
                      s.settings.notifications &&
                      notificationPermission === 'granted'
                    }
                    onCheckedChange={(v) =>
                      v
                        ? void requestNotifications()
                        : void settings({ notifications: false })
                    }
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Keep screen awake</h3>
                    <p>
                      {wakeActive
                        ? 'Active for this session.'
                        : 'While a timer runs and the app is visible.'}
                    </p>
                  </div>
                  <Switch
                    aria-label="Keep screen awake"
                    checked={s.settings.wakeLock}
                    onCheckedChange={(v) => void settings({ wakeLock: v })}
                  />
                </div>
                <div className="browser-note">
                  <Monitor size={18} />
                  <p>
                    Background alarms are best effort. Browsers can pause or
                    close apps, and screen wake lock only works while this app
                    is visible. A closed or suspended app cannot reliably alert
                    you. Your timer catches up when you return.
                  </p>
                </div>
              </section>
              <section className="panel">
                <div className="settings-section-title">
                  <ShieldCheck />
                  <div>
                    <h2>Local by design</h2>
                    <p className="muted">
                      No account. No task data sent to a server.
                    </p>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Offline app</h3>
                    <p>
                      {offlineReady
                        ? 'Ready for offline use.'
                        : process.env.NODE_ENV === 'development'
                          ? 'Offline installation is available in the published app.'
                          : 'Preparing offline files. Keep the app online until ready.'}
                    </p>
                  </div>
                  <button className="secondary" onClick={() => void install()}>
                    <Download size={14} />
                    {installed ? 'Install help' : 'Install'}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Protect device storage</h3>
                    <p>
                      {storagePersistent
                        ? 'Persistent storage granted by this browser.'
                        : 'Ask your browser to retain your local data.'}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    disabled={storagePersistent}
                    onClick={async () => {
                      try {
                        const ok = await navigator.storage?.persist?.();
                        setStoragePersistent(!!ok);
                        setNotice(
                          ok
                            ? 'Persistent storage granted. Keep backups for extra peace of mind.'
                            : 'Your browser did not grant persistent storage. Keep regular backups.',
                        );
                      } catch {
                        setNotice(
                          'Storage protection is unavailable in this browser.',
                        );
                      }
                    }}
                  >
                    {storagePersistent ? <Check size={15} /> : 'Request'}
                  </button>
                </div>
                <div className="backup-actions">
                  <button
                    className="secondary"
                    disabled={!state}
                    onClick={exportBackup}
                  >
                    <Download size={15} /> Export backup
                  </button>
                  <button
                    className="secondary"
                    disabled={!state}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={15} /> Restore backup
                  </button>
                  <input
                    hidden
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      void readBackup(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
                <p className="setting-help">
                  Backups include tasks, goals, sessions and settings. Personal
                  audio is excluded. Clearing browser data removes this device’s
                  data. Each browser and domain has its own local workspace; use
                  a backup to move between them.
                </p>
              </section>
            </div>
          )}
          {children}
          <footer className="page-footer">
            <span>
              <i />
              {loaded && state
                ? 'Everything stays on your device.'
                : loaded
                  ? 'Storage needs your attention.'
                  : 'Opening your local workspace…'}
            </span>
            <div className="maker-credit">
              <p>
                From the makers of{' '}
                <a
                  href="https://owleye.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OwlEye Analytics
                </a>
                .
              </p>
              <p>
                Built by{' '}
                <a
                  href="https://shrinath.me"
                  target="_blank"
                  rel="me author noopener noreferrer"
                >
                  Shrinath
                </a>
                .
              </p>
            </div>
          </footer>
        </main>
      </div>
      <TaskEditor
        task={taskEditor}
        day={
          view === 'planner'
            ? sprintOffset === 0
              ? today
              : sprint.start
            : today
        }
        goals={s.goals}
        onClose={() => setTaskEditor(null)}
        onSave={saveTask}
      />
      <GoalEditor
        goal={goalEditor}
        onClose={() => setGoalEditor(null)}
        onSave={async (g) =>
          !!(await change((v) => ({
            ...v,
            goals: v.goals.some((x) => x.id === g.id)
              ? v.goals.map((x) => (x.id === g.id ? g : x))
              : [...v.goals, g],
          })))
        }
      />
      <Dialog
        open={reviewOpen && review.length > 0}
        onOpenChange={setReviewOpen}
      >
        <DialogContent className="editor-dialog review-dialog">
          <DialogHeader>
            <span className="goal-icon">
              <Leaf />
            </span>
            <DialogTitle>A fresh day. A fresh decision.</DialogTitle>
            <DialogDescription>
              These tasks are still open from earlier days. Keep what matters,
              and let the rest go. Carryover shifts the planned day, start time
              and deadline to today.
            </DialogDescription>
          </DialogHeader>
          <div className="review-list">
            {review.map((t) => (
              <div className="review-row" key={t.id}>
                <div>
                  <strong>{t.title}</strong>
                  <span>
                    {shortDate(t.plannedDate)} · {statusLabels[t.status]}
                  </span>
                </div>
                <Picker
                  label={`Decision for ${t.title}`}
                  value={reviewChoices[t.id] === false ? 'abandon' : 'carry'}
                  options={{ carry: 'Carry to today', abandon: 'Abandon' }}
                  onChange={(v) =>
                    setReviewChoices((c) => ({ ...c, [t.id]: v === 'carry' }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="secondary" onClick={() => setReviewOpen(false)}>
              Decide later
            </button>
            <button
              className="primary"
              disabled={reviewBusy}
              onClick={async () => {
                setReviewBusy(true);
                const ids = new Set(review.map((t) => t.id));
                const result = await change((v) => ({
                  ...v,
                  tasks: v.tasks.map((t) =>
                    ids.has(t.id) && isOpen(t) && t.plannedDate < today
                      ? reviewChoices[t.id] === false
                        ? setStatus(t, 'abandoned')
                        : shiftTask(t, today)
                      : t,
                  ),
                }));
                if (result) {
                  setReviewOpen(false);
                  setNotice(
                    'A fresh plan is ready. Take it one task at a time.',
                  );
                }
                setReviewBusy(false);
              }}
            >
              {reviewBusy ? 'Saving…' : 'Start fresh'}
              <ArrowRight size={15} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={installHelp} onOpenChange={setInstallHelp}>
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Keep a little focus close</DialogTitle>
            <DialogDescription>
              Install SuperFocus to open it like an app.
            </DialogDescription>
          </DialogHeader>
          <div className="install-instructions">
            <p>
              <strong>iPhone / iPad</strong>Open in Safari, tap Share, then Add
              to Home Screen.
            </p>
            <p>
              <strong>Android</strong>Open the browser menu and select Install
              app or Add to Home screen.
            </p>
            <p>
              <strong>Desktop</strong>Use the install icon in the address bar,
              or your browser’s app installation menu.
            </p>
            <p className="muted">
              After offline setup completes, this device can reopen the app and
              play its included audio without internet. Installation does not
              guarantee background alarms.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={restore !== null}
        onOpenChange={(v) => !v && setRestore(null)}
      >
        <AlertDialogContent className="editor-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces tasks, goals, session history and settings on this
              device. The timer will reset. Your personal audio stays in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p>
            {restore?.tasks.length} tasks · {restore?.goals.length} goals ·{' '}
            {restore?.sessions.length} sessions
          </p>
          <div className="form-actions">
            <button className="secondary" onClick={() => setRestore(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={async () => {
                if (restore && (await change(() => restore))) {
                  setRestore(null);
                  setSelectedTask('');
                  setNotice('Your backup has been restored.');
                }
              }}
            >
              Replace and restore
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteTrack !== null}
        onOpenChange={(v) => !v && setDeleteTrack(null)}
      >
        <AlertDialogContent className="editor-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this audio file?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from this device’s SuperFocus library. You can
              add the original file again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="form-actions">
            <button className="secondary" onClick={() => setDeleteTrack(null)}>
              Keep file
            </button>
            <button
              className="primary"
              onClick={async () => {
                if (deleteTrack) await music.remove(deleteTrack);
                setDeleteTrack(null);
              }}
            >
              Remove file
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
