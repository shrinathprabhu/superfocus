import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const preset = process.argv[2] ?? 'cloudflare-module';
if (!['node', 'cloudflare-module'].includes(preset))
  throw Error(`Unsupported build preset: ${preset}`);
if (preset === 'cloudflare-module') {
  // Old framework builds may have left a redirect to a generated Wrangler
  // config. Workers uses the committed root config as its source of truth.
  rmSync('.wrangler/deploy/config.json', { force: true });
}
const result = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build'],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', NITRO_PRESET: preset },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
