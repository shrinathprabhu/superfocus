import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assetHeaders,
  assetRules,
  contentSecurityPolicy,
  createNonce,
  documentCacheHeaders,
  securityHeaders,
} from '../lib/http-policy.ts';

void test('production CSP permits required local features and rejects executable inline scripts', () => {
  const nonce = createNonce();
  assert.equal(Buffer.from(nonce, 'base64').length, 16);
  assert.notEqual(nonce, createNonce());
  const policy = contentSecurityPolicy(nonce);
  const script = policy.split('; ').find((x) => x.startsWith('script-src '))!;
  assert.ok(script.includes(`'nonce-${nonce}'`));
  assert.ok(!script.includes('unsafe-inline'));
  assert.ok(!script.includes('unsafe-eval'));
  for (const directive of [
    "script-src-attr 'none'",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
  ]) {
    assert.ok(policy.includes(directive), directive);
  }
  assert.match(
    securityHeaders['Permissions-Policy'],
    /screen-wake-lock=\(self\)/,
  );
  assert.match(securityHeaders['Permissions-Policy'], /autoplay=\(self\)/);
  assert.match(contentSecurityPolicy(nonce, true), /'unsafe-eval'/);
  assert.ok(!policy.includes(' ws:'));
});

void test('HTML cannot enter CDN caches and only versioned assets are immutable', () => {
  assert.equal(documentCacheHeaders['Cache-Control'], 'private, no-store');
  assert.equal(documentCacheHeaders['CDN-Cache-Control'], 'no-store');
  assert.equal(documentCacheHeaders['Vercel-CDN-Cache-Control'], 'no-store');
  for (const path of [
    '/_next/static/chunks/app-123.js',
    '/fonts/geist-sans-v1.7.2.woff2',
  ]) {
    assert.match(assetHeaders(path)!['Cache-Control'], /31536000, immutable/);
  }
  for (const path of [
    '/sw.js',
    '/manifest.webmanifest',
    '/robots.txt',
    '/superfocus/sitemap.xml',
    '/superfocus/index.md',
  ]) {
    assert.equal(
      assetHeaders(path)!['Cache-Control'],
      'public, max-age=0, must-revalidate',
    );
  }
  assert.ok(
    !assetHeaders('/audio/quiet-orbit.mp3')!['Cache-Control'].includes(
      'immutable',
    ),
  );
  assert.equal(assetHeaders('/superfocus'), undefined);
  assert.equal(assetHeaders('/unknown'), undefined);
});

void test('Cloudflare and Vercel publish the same security and asset policies', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const cloudflare = readFileSync('public/_headers', 'utf8');
  const common = vercel.headers.find(
    (rule: { source: string }) => rule.source === '/:path*',
  );
  assert.deepEqual(
    Object.fromEntries(
      common.headers.map(({ key, value }: { key: string; value: string }) => [
        key,
        value,
      ]),
    ),
    securityHeaders,
  );
  for (const { path, headers } of assetRules) {
    const rule = vercel.headers.find(
      (r: { source: string }) => r.source === path.replace('/*', '/:path*'),
    );
    assert.ok(rule, path);
    assert.deepEqual(
      Object.fromEntries(
        rule.headers.map(({ key, value }: { key: string; value: string }) => [
          key,
          value,
        ]),
      ),
      headers,
    );
    for (const [key, value] of Object.entries(headers))
      assert.ok(cloudflare.includes(`  ${key}: ${value}`));
  }
  assert.ok(
    !JSON.stringify(vercel).includes('nonce-'),
    'Never bake a reusable nonce into CDN configuration',
  );
  assert.ok(
    !('rewrites' in vercel),
    'Do not send public traffic to the private preview',
  );
});
