import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusStats } from '../lib/focus-stats.ts';
import type { Session, Task } from '../lib/domain.ts';

void test('focus totals, goal progress and the last seven days share accurate aggregates', () => {
  const session = (
    id: string,
    date: string,
    minutes: number,
    mode: Session['mode'] = 'focus',
  ): Session => ({
    id,
    mode,
    minutes,
    completedAt: new Date(`${date}T12:00`).getTime(),
    goalId: 'g1',
    taskId: '',
  });
  const sessions = [
    session('old', '2026-08-30', 40),
    session('start', '2026-09-10', 90),
    session('today', '2026-09-16', 25),
    session('break', '2026-09-16', 5, 'short'),
  ];
  const task = (id: string, status: Task['status']): Task => ({
    id,
    status,
    title: id,
    notes: '',
    plannedDate: '2026-09-16',
    startAt: '',
    deadline: '',
    goalId: 'g1',
    createdAt: 1,
    carried: 0,
    completedAt:
      status === 'done' ? new Date('2026-09-16T12:00').getTime() : null,
  });
  const tasks = [
    task('open', 'todo'),
    task('blocked', 'blocked'),
    task('done', 'done'),
    task('archived', 'abandoned'),
  ];
  const before = structuredClone({ sessions, tasks });
  const stats = focusStats(sessions, tasks, '2026-09-16');
  assert.equal(stats.focusCount, 3);
  assert.equal(stats.todayCount, 1);
  assert.equal(stats.dailyMinutes, 25);
  assert.equal(stats.todayDone, 1);
  assert.equal(stats.minutesByGoal.get('g1'), 155);
  assert.equal(stats.tasksByGoal.get('g1'), 2);
  assert.deepEqual(
    stats.week.map((day) => day.minutes),
    [90, 0, 0, 0, 0, 0, 25],
  );
  assert.equal(stats.week[0].day, '2026-09-10');
  assert.equal(stats.week[6].day, '2026-09-16');
  assert.equal(stats.weekMax, 90);
  assert.deepEqual({ sessions, tasks }, before);
});

void test('empty history keeps a stable seven-day chart and a nonzero scale', () => {
  const stats = focusStats([], [], '2026-03-01');
  assert.equal(stats.week[0].day, '2026-02-23');
  assert.equal(stats.week.length, 7);
  assert.equal(stats.weekMax, 60);
  assert.equal(stats.todayCount, 0);
  assert.equal(stats.todayDone, 0);
  assert.equal(
    stats.week.every((day) => day.minutes === 0),
    true,
  );
});
