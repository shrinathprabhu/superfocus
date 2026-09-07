import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const { securityHeaders, documentCacheHeaders, assetRules } =
  await import('../lib/http-policy.ts');
const nonces = new Set();
for (const path of ['/', '/superfocus', '/superfocus']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  for (const [key, value] of Object.entries({
    ...securityHeaders,
    ...documentCacheHeaders,
  })) {
    assert.equal(response.headers.get(key), value, `${path}: ${key}`);
  }
  assert.equal(response.headers.get('x-superfocus-shell'), '1');
  assert.equal(response.headers.get('x-powered-by'), null);
  const csp = response.headers.get('content-security-policy');
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce && nonce !== 'untrusted-client-nonce');
  assert.ok(!nonces.has(nonce), 'A network response must get a fresh nonce');
  nonces.add(nonce);
  const scriptPolicy = csp.split('; ').find((x) => x.startsWith('script-src '));
  assert.ok(
    !scriptPolicy.includes('unsafe-inline') &&
      !scriptPolicy.includes('unsafe-eval'),
  );
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const [, attributes] of scripts) {
    assert.equal(
      attributes.match(/nonce="([^"]+)"/)?.[1],
      nonce,
      `Script has no matching nonce: ${attributes}`,
    );
  }
}
for (const key of [
  'x-nonce',
  'content-security-policy',
  'content-security-policy-report-only',
]) {
  const response = await fetch(base + '/superfocus', {
    headers: { [key]: "script-src 'nonce-untrusted-client-nonce'" },
  });
  assert.equal(response.status, 400, `Server-owned ${key} must be rejected`);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-superfocus-shell'), null);
}
const rsc = await fetch(base + '/superfocus?_rsc=security-check', {
  headers: { RSC: '1' },
});
assert.equal(rsc.status, 200);
assert.match(rsc.headers.get('content-type'), /text\/x-component/);
assert.equal(rsc.headers.get('cache-control'), 'private, no-store');
assert.match(rsc.headers.get('vary'), /RSC/);
const missing = await fetch(base + '/missing-page-security-check');
assert.equal(missing.status, 404);
assert.equal(missing.headers.get('x-content-type-options'), 'nosniff');
assert.equal(missing.headers.get('cache-control'), 'private, no-store');

const worker = await fetch(base + '/sw.js');
const source = await worker.text();
const paths = JSON.parse(source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
await Promise.all(
  paths.map(async (path) => {
    const response = await fetch(base + path, { method: 'HEAD' });
    assert.equal(response.status, 200, path);
    for (const [key, value] of Object.entries(securityHeaders)) {
      assert.equal(response.headers.get(key), value, `${path}: ${key}`);
    }
  }),
);
for (const rule of assetRules) {
  const path = rule.path.endsWith('*')
    ? paths.find((path) => path.startsWith(rule.path.slice(0, -1)))
    : rule.path;
  assert.ok(path, rule.path);
  const response = await fetch(base + path, { method: 'HEAD' });
  assert.equal(response.status, 200, path);
  for (const [key, value] of Object.entries(rule.headers))
    assert.equal(response.headers.get(key), value, `${path}: ${key}`);
}
assert.deepEqual(
  paths,
  JSON.parse(
    readFileSync('dist/client/sw.js', 'utf8').match(
      /const ASSETS = (\[[\s\S]*?\]);/,
    )[1],
  ),
);
console.log(
  `Verified fresh script nonces, client nonce rejection, HTML/RSC/404 headers, and ${paths.length} offline resources with security/cache rules.`,
);
