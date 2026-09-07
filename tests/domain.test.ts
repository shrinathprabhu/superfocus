import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dayDistance,
  sprintFor,
  initialState,
  shiftTask,
  pendingReview,
  setStatus,
  remaining,
  completeTimer,
  validateBackup,
  freshTimer,
  type Task,
} from '../lib/domain.ts';
const task = (patch: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Read a chapter',
  notes: '',
  status: 'todo',
  plannedDate: '2026-09-06',
  startAt: '2026-09-06T10:30',
  deadline: '2026-09-06T12:00',
  goalId: '',
  createdAt: 1,
  completedAt: null,
  carried: 0,
  ...patch,
});
void test('calendar day arithmetic crosses months and leap days', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dayDistance('2026-03-07', '2026-03-09'), 2);
});
void test('daily, weekly and fortnightly sprint boundaries are inclusive', () => {
  assert.deepEqual(
    sprintFor({ cycle: 'day', anchor: '2026-09-01' }, '2026-09-07'),
    { start: '2026-09-07', end: '2026-09-07', next: '2026-09-08' },
  );
  assert.deepEqual(
    sprintFor({ cycle: 'week', anchor: '2026-09-01' }, '2026-09-07'),
    { start: '2026-09-01', end: '2026-09-07', next: '2026-09-08' },
  );
  assert.equal(
    sprintFor({ cycle: 'fortnight', anchor: '2026-09-01' }, '2026-09-15').start,
    '2026-09-15',
  );
});
void test('dates before the anchor and negative offsets select past sprints', () => {
  assert.equal(
    sprintFor({ cycle: 'week', anchor: '2026-09-07' }, '2026-09-06').start,
    '2026-08-31',
  );
  assert.equal(
    sprintFor({ cycle: 'week', anchor: '2026-09-07' }, '2026-09-07', -1).end,
    '2026-09-06',
  );
});
void test('monthly sprints clamp short months without losing original anchor', () => {
  const settings = { cycle: 'month' as const, anchor: '2024-01-31' };
  assert.deepEqual(sprintFor(settings, '2024-02-29'), {
    start: '2024-02-29',
    end: '2024-03-30',
    next: '2024-03-31',
  });
  assert.equal(sprintFor(settings, '2024-04-30').next, '2024-05-31');
  assert.equal(sprintFor(settings, '2024-02-28').start, '2024-01-31');
});
void test('daily review excludes future, today, done and abandoned tasks', () => {
  const all = [
    task(),
    task({ id: '2', plannedDate: '2026-09-07' }),
    task({ id: '3', plannedDate: '2026-09-08' }),
    task({ id: '4', status: 'done' }),
    task({ id: '5', status: 'abandoned' }),
    task({ id: '6', status: 'blocked' }),
  ];
  assert.deepEqual(
    pendingReview(all, '2026-09-07').map((t) => t.id),
    ['t1', '6'],
  );
});
void test('carryover preserves local clock times and duration across calendar days', () => {
  const moved = shiftTask(task(), '2026-09-13');
  assert.equal(moved.startAt, '2026-09-13T10:30');
  assert.equal(moved.deadline, '2026-09-13T12:00');
  assert.equal(moved.carried, 1);
  assert.equal(moved.plannedDate, '2026-09-13');
  assert.equal(moved.status, 'todo');
});
void test('carryover preserves blocked state and empty optional dates', () => {
  const moved = shiftTask(
    task({ status: 'blocked', startAt: '', deadline: '' }),
    '2026-09-07',
  );
  assert.equal(moved.status, 'blocked');
  assert.equal(moved.startAt, '');
  assert.equal(moved.deadline, '');
});
void test('won’t do immediately abandons and completing/reopening clears completion timestamps', () => {
  assert.equal(setStatus(task(), 'wontdo').status, 'abandoned');
  assert.equal(setStatus(task(), 'wontdo').abandonedReason, 'Won’t do');
  const done = setStatus(task(), 'done', 123);
  assert.equal(done.completedAt, 123);
  assert.equal(setStatus(done, 'todo').completedAt, null);
});
void test('timestamp timer survives long background gaps and never goes negative', () => {
  const state = initialState('2026-09-07'),
    t = { ...state.timer, endAt: 100000 };
  assert.equal(remaining(t, 91000), 9);
  assert.equal(remaining(t, 100001), 0);
  assert.equal(remaining({ ...t, endAt: null, remaining: 45 }, 9999999), 45);
});
void test('session completes once, at its real end, without inventing unattended sessions', () => {
  const state = initialState('2026-09-07');
  state.timer = {
    ...state.timer,
    endAt: 100000,
    taskId: 'task',
    goalId: 'goal',
  };
  const finished = completeTimer(state, 999999999);
  assert.equal(finished.sessions.length, 1);
  assert.equal(finished.sessions[0].completedAt, 100000);
  assert.equal(finished.sessions[0].minutes, 25);
  assert.equal(finished.sessions[0].goalId, 'goal');
  assert.equal(finished.timer.mode, 'short');
  assert.equal(finished.timer.endAt, null);
  assert.deepEqual(completeTimer(finished, 999999999), finished);
});
void test('long break follows configured number of completed focus sessions', () => {
  let s = initialState('2026-09-07');
  s.settings.longEvery = 2;
  s.timer.endAt = 100;
  s = completeTimer(s, 100);
  assert.equal(s.timer.mode, 'short');
  s.timer = freshTimer(s.settings);
  s.timer.endAt = 200;
  s = completeTimer(s, 200);
  assert.equal(s.timer.mode, 'long');
  s.timer.endAt = 300;
  s = completeTimer(s, 300);
  assert.equal(s.timer.mode, 'focus');
  assert.equal(s.sessions.filter((x) => x.mode === 'focus').length, 2);
});
void test('a paused or incomplete timer cannot be counted', () => {
  const s = initialState();
  assert.equal(completeTimer(s, 99999), s);
  s.timer.endAt = 100000;
  assert.equal(completeTimer(s, 99999), s);
});
void test('valid backup roundtrips business data but resets the timer', () => {
  const s = initialState('2026-09-07');
  s.tasks = [task()];
  s.timer.endAt = 99999;
  const restored = validateBackup(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.tasks, s.tasks);
  assert.equal(restored.timer.endAt, null);
  assert.equal(restored.timer.remaining, 1500);
  assert.notEqual(restored.timer.id, s.timer.id);
});
void test('invalid backup versions and structures fail without partial restoration', () => {
  assert.throws(() => validateBackup({ version: 2 }));
  assert.throws(() => validateBackup(null));
  const s = initialState();
  assert.throws(() =>
    validateBackup({ ...s, settings: { ...s.settings, focus: 0 } }),
  );
  assert.throws(() =>
    validateBackup({ ...s, settings: { ...s.settings, longEvery: 1.5 } }),
  );
  assert.throws(() =>
    validateBackup({ ...s, settings: { ...s.settings, anchor: '2026-02-31' } }),
  );
});
void test('backups reject invalid tasks, reversed deadlines, duplicate IDs and invalid sessions', () => {
  const s = initialState();
  assert.throws(() => validateBackup({ ...s, tasks: [task({ title: '' })] }));
  assert.throws(() =>
    validateBackup({ ...s, tasks: [task({ deadline: '2026-09-05T09:00' })] }),
  );
  assert.throws(() => validateBackup({ ...s, tasks: [task(), task()] }));
  assert.throws(() =>
    validateBackup({
      ...s,
      sessions: [
        {
          id: 'x',
          mode: 'focus',
          minutes: Infinity,
          completedAt: 1,
          taskId: '',
          goalId: '',
        },
      ],
    }),
  );
});
