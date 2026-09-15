import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { site, faqs, structuredData } from '../lib/site-content.ts';
import { nextClockDelay } from '../lib/clock.ts';

void test('discovery files expose only the canonical page and consistent public answers', () => {
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((x) => x[1]),
    [site.canonical],
  );
  assert.equal(site.canonical, 'https://superfocus.lowkey.tools/');
  assert.ok(!existsSync('app/superfocus/page.tsx'));
  assert.ok(!existsSync('public/superfocus/sitemap.xml'));
  assert.ok(!existsSync('public/superfocus/llms.txt'));
  assert.ok(!existsSync('public/superfocus/index.md'));
  assert.match(
    readFileSync('public/robots.txt', 'utf8'),
    /Sitemap: https:\/\/superfocus\.lowkey\.tools\/sitemap\.xml/,
  );
  const markdown = readFileSync('public/index.md', 'utf8');
  for (const { question, answer } of faqs) {
    assert.ok(markdown.includes(question));
    assert.ok(markdown.includes(answer));
  }
  const graph = structuredData()['@graph'];
  const ids = new Set(graph.map((node) => node['@id']));
  assert.equal(ids.size, graph.length);
  const validateReferences = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length === 1 && typeof record['@id'] === 'string') {
      assert.ok(
        ids.has(record['@id']),
        `Unresolved structured data reference ${record['@id']}`,
      );
    }
    for (const child of Object.values(record)) validateReferences(child);
  };
  validateReferences(graph);
  assert.ok(markdown.includes(site.publisher.url));
  assert.ok(markdown.includes(site.creator.url));
});

void test('offline music retains ten small tracks and manifest icons exist', () => {
  const audio = readdirSync('public/audio').filter((path) =>
    path.endsWith('.mp3'),
  );
  assert.equal(audio.length, 10);
  assert.ok(
    audio.reduce(
      (bytes, path) => bytes + statSync(`public/audio/${path}`).size,
      0,
    ) < 6_000_000,
  );
  assert.equal(
    readdirSync('public/audio').filter((path) => path.endsWith('.wav')).length,
    0,
  );
  const manifest = JSON.parse(
    readFileSync('public/manifest.webmanifest', 'utf8'),
  );
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons)
    assert.ok(statSync(`public${icon.src}`).size > 0);
});

void test('adaptive clock meets second boundaries and does not busy-loop after expiration', () => {
  assert.equal(nextClockDelay(1500000, 0), 1000);
  assert.equal(nextClockDelay(1500000, 150024), 976);
  assert.equal(nextClockDelay(1500000, 1499999), 1);
  assert.equal(nextClockDelay(1500000, 1500000), 60000);
  assert.equal(nextClockDelay(1500000, 1500001), 59999);
  assert.equal(nextClockDelay(null, 60300), 59700);
});

void test('the shared social card is a 1200 by 630 PNG', () => {
  const png = readFileSync(`public${site.socialImage.url}`);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), site.socialImage.width);
  assert.equal(png.readUInt32BE(20), site.socialImage.height);
  assert.ok(png.length < 250_000);
});
