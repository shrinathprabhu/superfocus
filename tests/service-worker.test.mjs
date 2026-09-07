import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker() {
  const handlers = {},
    cache = new Map(),
    puts = [];
  const store = {
    match: async (p) => cache.get(p)?.clone(),
    put: async (p, r) => {
      cache.set(p, r.clone());
      puts.push(p);
    },
  };
  const context = {
    URL,
    Request,
    Response,
    Headers,
    Set,
    Number,
    Promise,
    Error,
    caches: { open: async () => store, keys: async () => [] },
    fetch: async () => {
      throw Error('offline');
    },
    self: {
      location: { origin: 'https://focus.test' },
      addEventListener: (name, handler) => (handlers[name] = handler),
      clients: { claim: async () => {} },
    },
  };
  vm.runInNewContext(
    readFileSync('scripts/sw-template.js', 'utf8')
      .replace('__CACHE_NAME__', 'superfocus-offline-test')
      .replace(
        '__ASSET_LIST__',
        JSON.stringify([
          '/',
          '/superfocus',
          '/audio/quiet-orbit.mp3',
          '/assets/app.js',
        ]),
      ),
    context,
  );
  return { handlers, cache, puts };
}
async function fetchWorker(w, request) {
  let response;
  w.handlers.fetch({ request, respondWith: (p) => (response = p) });
  return response;
}
void test('offline navigation recovers cached app shell', async () => {
  const w = worker();
  w.cache.set(
    '/superfocus',
    new Response('<html>SuperFocus</html>', {
      headers: { 'content-type': 'text/html' },
    }),
  );
  const r = await fetchWorker(w, {
    method: 'GET',
    url: 'https://focus.test/superfocus/',
    mode: 'navigate',
    headers: new Headers(),
  });
  assert.equal(await r.text(), '<html>SuperFocus</html>');
});
void test('offline audio serves byte ranges with correct content headers', async () => {
  const w = worker();
  w.cache.set(
    '/audio/quiet-orbit.mp3',
    new Response(Uint8Array.from([1, 2, 3, 4, 5, 6]), {
      headers: { 'content-type': 'audio/mpeg' },
    }),
  );
  const r = await fetchWorker(
    w,
    new Request('https://focus.test/audio/quiet-orbit.mp3', {
      headers: { Range: 'bytes=2-4' },
    }),
  );
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('Content-Range'), 'bytes 2-4/6');
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [3, 4, 5]);
});
void test('audio suffix and invalid ranges are handled offline', async () => {
  const w = worker();
  w.cache.set(
    '/audio/quiet-orbit.mp3',
    new Response(Uint8Array.from([1, 2, 3, 4])),
  );
  const suffix = await fetchWorker(
    w,
    new Request('https://focus.test/audio/quiet-orbit.mp3', {
      headers: { Range: 'bytes=-2' },
    }),
  );
  assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [3, 4]);
  const invalid = await fetchWorker(
    w,
    new Request('https://focus.test/audio/quiet-orbit.mp3', {
      headers: { Range: 'bytes=9-20' },
    }),
  );
  assert.equal(invalid.status, 416);
});
void test('RSC, foreign requests and unrelated app paths do not pollute shell cache', async () => {
  const w = worker();
  assert.equal(
    await fetchWorker(
      w,
      new Request('https://focus.test/superfocus', { headers: { rsc: '1' } }),
    ),
    undefined,
  );
  assert.equal(
    await fetchWorker(w, new Request('https://focus.test/superfocus?_rsc=123')),
    undefined,
  );
  assert.equal(
    await fetchWorker(
      w,
      new Request('https://other.test/audio/quiet-orbit.mp3'),
    ),
    undefined,
  );
  assert.equal(
    await fetchWorker(w, {
      method: 'GET',
      url: 'https://focus.test/other-app',
      mode: 'navigate',
      headers: new Headers(),
    }),
    undefined,
  );
  assert.equal(w.puts.length, 0);
});
