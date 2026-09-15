import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostingRules } from '../lib/http-policy.ts';
import { site } from '../lib/site-content.ts';

const config = JSON.parse(readFileSync('wrangler.json', 'utf8'));
const output = config.assets.directory;
assert.equal(output, './dist/client');
assert.equal(config.main, './dist/server/index.mjs');
assert.equal(config.assets.binding, 'ASSETS');
assert.equal(config.assets.html_handling, 'none');
assert.equal(config.assets.not_found_handling, 'none');
assert.ok(!('pages_build_output_dir' in config));
assert.equal(config.no_bundle, true);
assert.ok(config.name);
assert.deepEqual(config.routes, [
  { pattern: new URL(site.canonical).hostname, custom_domain: true },
]);
assert.ok(config.compatibility_flags.includes('nodejs_compat'));
assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(
  JSON.parse(readFileSync('dist/nitro.json', 'utf8')).preset,
  'cloudflare-module',
);
assert.ok(existsSync(config.main));
assert.ok(!existsSync('dist/_worker.js'));
assert.ok(!existsSync('dist/_routes.json'));
assert.ok(
  !existsSync(`${output}/index.html`),
  'The root must render with a fresh nonce',
);

const headers = new Map();
let path;
for (const line of readFileSync(`${output}/_headers`, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!line.startsWith(' ')) {
    path = line;
    headers.set(path, new Headers());
  } else {
    const separator = line.indexOf(':');
    headers
      .get(path)
      .set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
}
for (const { path, headers: expected } of hostingRules) {
  const actual = headers.get(path.replace('/**', '/*'));
  assert.ok(actual, `Missing Workers header rule: ${path}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual.get(key), value, `${path}: ${key}`);
  }
}
assert.ok(!readFileSync(`${output}/_headers`, 'utf8').includes('nonce-'));

const assets = JSON.parse(
  readFileSync(`${output}/sw.js`, 'utf8').match(
    /const ASSETS = (\[[\s\S]*?\]);/,
  )[1],
);
assert.ok(assets.includes('/'));
assert.ok(assets.includes(site.socialImage.url));
assert.equal(assets.filter((path) => path.endsWith('.mp3')).length, 10);
for (const path of [...assets.filter((path) => path !== '/'), '/sw.js']) {
  assert.ok(existsSync(output + path), path);
  assert.ok(
    statSync(output + path).size < 25 * 1024 * 1024,
    `Workers asset limit: ${path}`,
  );
}
for (const path of assets.filter((path) => path !== '/')) {
  assert.ok(
    !/^\/(?:\.|server\/|_worker\.js|_headers|_redirects|_routes\.json|nitro\.json|superfocus(?:\/|$))/.test(
      path,
    ),
    `Do not publish/precache build internals: ${path}`,
  );
}
console.log(
  `Verified Workers entrypoint, static assets, shared header policies and ${assets.length} offline resources.`,
);

// Start preview:cloudflare first, or pass a deployed URL for this exact build.
const base = (process.argv[2] ?? 'http://localhost:4319').replace(/\/$/, '');
const http = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    'scripts/check-http.mjs',
    base,
    `${output}/sw.js`,
  ],
  { stdio: 'inherit' },
);
if (http.error) throw http.error;
assert.equal(
  http.status,
  0,
  'Workers HTTP checks failed; start npm run preview:cloudflare first',
);
for (const path of [
  '/_worker.js/index.js',
  '/.vite/manifest.json',
  '/server/BUILD_ID',
  '/server/RSC_BUILD_ID',
  '/server/index.mjs',
  '/nitro.json',
]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 404, path);
  assert.equal(
    response.headers.get('cache-control'),
    'private, no-store',
    path,
  );
  await response.body?.cancel();
}
const audio = assets.find((path) => path.endsWith('.mp3'));
const range = await fetch(base + audio, { headers: { Range: 'bytes=0-15' } });
const audioBytes = readFileSync(output + audio);
// A server may ignore Range and return the complete representation. Verify both
// valid responses; cached partial playback is handled by our service worker.
assert.ok([200, 206].includes(range.status));
if (range.status === 206) {
  assert.equal(
    range.headers.get('content-range'),
    `bytes 0-15/${audioBytes.length}`,
  );
}
assert.deepEqual(
  Buffer.from(await range.arrayBuffer()),
  range.status === 206 ? audioBytes.subarray(0, 16) : audioBytes,
);
assert.match(range.headers.get('content-type'), /audio\/mpeg/);
console.log(
  `Verified Workers HTTP behavior, private server modules and audio bytes (origin Range status: ${range.status}).`,
);
