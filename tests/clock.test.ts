import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextClockDelay, scheduleDeadline } from '../lib/clock.ts';

void test('readouts align to seconds while the workspace clock only wakes each minute', () => {
  assert.equal(nextClockDelay(100_250, 98_000), 250);
  assert.equal(nextClockDelay(100_250, 99_250), 1_000);
  assert.equal(nextClockDelay(null, 98_000), 22_000);
});

void test('completion fires at the deadline, without needing readout ticks', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10_000 });
  let completed = 0;
  scheduleDeadline(11_000, () => completed++);
  t.mock.timers.tick(999);
  assert.equal(completed, 0);
  t.mock.timers.tick(1);
  assert.equal(completed, 1);
  t.mock.timers.tick(60_000);
  assert.equal(completed, 1);
});

void test('pausing or resetting cancels the old completion deadline', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10_000 });
  let completed = false;
  const cancel = scheduleDeadline(11_000, () => {
    completed = true;
  });
  cancel();
  t.mock.timers.tick(60_000);
  assert.equal(completed, false);
});

void test('a delayed wake or restored expired timer completes immediately', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10_000 });
  let completed = 0;
  scheduleDeadline(11_000, () => completed++);
  t.mock.timers.setTime(70_000);
  t.mock.timers.tick(1);
  assert.equal(completed, 1);
  scheduleDeadline(11_000, () => completed++);
  assert.equal(completed, 2);
});

void test('clock changes do not let an early callback finish the timer', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 10_000 });
  let completed = false;
  scheduleDeadline(11_000, () => {
    completed = true;
  });
  t.mock.timers.setTime(9_000);
  t.mock.timers.tick(1_000);
  assert.equal(completed, false);
  t.mock.timers.tick(1_000);
  assert.equal(completed, true);
});
