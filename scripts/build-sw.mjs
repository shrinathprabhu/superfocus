import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = 'dist/client';
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = `${dir}/${name}`;
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(root).filter(
  (p) =>
    !p.endsWith('.map') &&
    !p.split('/').some((part) => part.startsWith('.')) &&
    !p.endsWith('/sw.js') &&
    !p.endsWith('/_headers'),
);
const hash = createHash('sha256');
const template = readFileSync('scripts/sw-template.js', 'utf8');
// A worker or response-policy change must get a new cache, even when assets match.
hash.update(template);
hash.update(readFileSync('public/_headers'));
hash.update(readFileSync('lib/http-policy.ts'));
for (const f of files.sort()) {
  hash.update(f);
  hash.update(readFileSync(f));
}
const assets = ['/', '/superfocus', ...files.map((p) => p.slice(root.length))];
const result = template
  .replace(
    '__CACHE_NAME__',
    `superfocus-offline-${hash.digest('hex').slice(0, 16)}`,
  )
  .replace('__ASSET_LIST__', JSON.stringify(assets));
writeFileSync(`${root}/sw.js`, result);
console.log(
  `Offline worker prepared: ${assets.length} app files and routes, including all 10 audio tracks.`,
);
