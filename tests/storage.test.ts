import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readState,
  updateState,
  saveMusic,
  musicList,
  deleteMusic,
} from '../lib/storage.ts';
import { initialState, completeTimer } from '../lib/domain.ts';
void test('IndexedDB persists data, serializes concurrent updates and stores audio blobs', async () => {
  await updateState(() => initialState('2026-09-07'));
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      updateState((s) => ({
        ...s,
        goals: [
          ...s.goals,
          {
            id: String(i),
            title: `Goal ${i}`,
            target: 60,
            deadline: '',
            createdAt: i,
          },
        ],
      })),
    ),
  );
  const saved = await readState();
  assert.equal(saved.goals.length, 25);
  assert.equal(new Set(saved.goals.map((g) => g.id)).size, 25);
  await saveMusic({
    id: 'personal',
    name: 'Personal audio',
    blob: new Blob(['audio bytes'], { type: 'audio/wav' }),
  });
  let list = await musicList();
  assert.equal(list.length, 1);
  assert.equal(await list[0].blob.text(), 'audio bytes');
  await deleteMusic('personal');
  list = await musicList();
  assert.equal(list.length, 0);
});
void test('concurrent tabs can only record one completion of an expired timer', async () => {
  await updateState(() => {
    const s = initialState();
    s.timer.endAt = 100;
    return s;
  });
  await Promise.all([
    updateState((s) => completeTimer(s, 500)),
    updateState((s) => completeTimer(s, 500)),
  ]);
  const result = await readState();
  assert.equal(result.sessions.length, 1);
  assert.equal(result.timer.endAt, null);
});
void test('a failed mutation leaves the previous IndexedDB state intact', async () => {
  const before = await readState();
  await assert.rejects(
    updateState(() => {
      throw Error('invalid mutation');
    }),
  );
  assert.deepEqual(await readState(), before);
});
