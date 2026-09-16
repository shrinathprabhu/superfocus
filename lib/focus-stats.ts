import {
  addDays,
  isOpen,
  localDay,
  type Session,
  type Task,
} from './domain.ts';

/** Aggregate history once, instead of scanning it for every goal and chart bar. */
export function focusStats(sessions: Session[], tasks: Task[], today: string) {
  const week = Array.from({ length: 7 }, (_, i) => ({
    day: addDays(today, i - 6),
    minutes: 0,
  }));
  const days = new Map(week.map((day) => [day.day, day]));
  const minutesByGoal = new Map<string, number>();
  const tasksByGoal = new Map<string, number>();
  let focusCount = 0;
  let todayCount = 0;
  let dailyMinutes = 0;
  let todayDone = 0;
  for (const session of sessions) {
    if (session.mode !== 'focus') continue;
    focusCount++;
    const day = localDay(session.completedAt);
    if (day === today) {
      todayCount++;
      dailyMinutes += session.minutes;
    }
    const bar = days.get(day);
    if (bar) bar.minutes += session.minutes;
    if (session.goalId)
      minutesByGoal.set(
        session.goalId,
        (minutesByGoal.get(session.goalId) ?? 0) + session.minutes,
      );
  }
  for (const task of tasks) {
    if (task.completedAt && localDay(task.completedAt) === today) todayDone++;
    if (task.goalId && isOpen(task))
      tasksByGoal.set(task.goalId, (tasksByGoal.get(task.goalId) ?? 0) + 1);
  }
  return {
    focusCount,
    todayCount,
    dailyMinutes,
    todayDone,
    minutesByGoal,
    tasksByGoal,
    week,
    weekMax: Math.max(60, ...week.map((day) => day.minutes)),
  };
}
