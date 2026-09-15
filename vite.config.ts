import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import type { NitroConfig } from 'nitro/types';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { hostingRules } from './lib/http-policy.ts';
import { buildServiceWorker } from './scripts/build-sw.mjs';
import cloudflareConfig from './wrangler.json' with { type: 'json' };

export default defineConfig(({ command }) => {
  let publicOutput: string;
  const preset =
    process.env.NITRO_PRESET ??
    (command === 'build' ? 'cloudflare-module' : 'node');
  return {
    server: {
      port: 4317,
      strictPort: true,
      ...(process.env.CODEX_SANDBOX === 'seatbelt'
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      tailwindcss(),
      vinext(),
      nitro({
        preset,
        ...(preset === 'cloudflare-module'
          ? {
              output: {
                dir: 'dist',
                serverDir: 'dist/server',
                publicDir: 'dist/client',
              },
            }
          : {}),
        compatibilityDate:
          cloudflareConfig.compatibility_date as NitroConfig['compatibilityDate'],
        cloudflare: {
          nodeCompat: true,
          // The committed wrangler.json is the Workers configuration for both
          // dashboard builds and CLI commands; do not redirect to a generated one.
          deployConfig: false,
        },
        plugins: ['./server/plugins/http-errors.ts'],
        routeRules: Object.fromEntries(
          hostingRules.map(({ path, headers }) => [
            path,
            {
              headers: Object.fromEntries(
                Object.entries(headers).map(([key, value]) => [
                  key.toLowerCase(),
                  value,
                ]),
              ),
            },
          ]),
        ),
      }),
      {
        name: 'superfocus-offline-worker',
        apply: 'build',
        applyToEnvironment: (environment) => environment.name === 'nitro',
        configResolved(config) {
          publicOutput = config.environments.client.build.outDir;
        },
        // Nitro has copied the final client assets at this point. Generate the
        // worker before its server bundle records public-file metadata/ETags.
        buildStart() {
          if (preset === 'cloudflare-module') {
            // The compiled server already contains the client manifest.
            rmSync(join(publicOutput, '.vite/manifest.json'), { force: true });
          }
          buildServiceWorker(publicOutput);
        },
      },
    ],
  };
});
