import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { site, faqs, structuredData } from '../lib/site-content.ts';
import { nextClockDelay } from '../lib/clock.ts';

void test('discovery files expose only the canonical page and consistent public answers', () => {
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((x) => x[1]),
    [site.canonical],
  );
  assert.equal(sitemap, readFileSync('public/superfocus/sitemap.xml', 'utf8'));
  assert.match(
    readFileSync('public/robots.txt', 'utf8'),
    /Sitemap: https:\/\/lowkey\.tools\/superfocus\/sitemap\.xml/,
  );
  const markdown = readFileSync('public/superfocus/index.md', 'utf8');
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
  assert.equal(manifest.id, '/superfocus');
  assert.equal(manifest.start_url, '/superfocus');
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
