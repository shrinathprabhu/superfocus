import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

await initWasm(
  readFileSync(
    new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url),
  ),
);
const renderer = new Resvg(readFileSync('scripts/social-card.svg', 'utf8'));
const image = renderer.render();
mkdirSync('public/og', { recursive: true });
writeFileSync('public/og/superfocus-v2.png', image.asPng());
image.free();
renderer.free();
console.log('Generated public/og/superfocus-v2.png (1200 × 630).');
