import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assetHeaders,
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
    '/sitemap.xml',
    '/index.md',
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
  assert.equal(assetHeaders('/'), undefined);
  assert.equal(assetHeaders('/unknown'), undefined);
});
