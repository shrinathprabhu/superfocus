# SuperFocus

A local-first Pomodoro and sprint planner with original ambient music. Built with React, TypeScript, Vinext/Vite, Nitro and IndexedDB. Production target: `https://superfocus.lowkey.tools/`. No task-data backend, accounts, analytics, API keys or streaming integrations.

## Run

Use Node.js 24 (`.node-version` and `package.json` specify the supported build version).

```sh
npm ci
npm run dev
```

Open `http://localhost:4317/`. The app, manifest, service worker and all assets are served from the domain root. Service-worker registration is intentionally disabled during development, so stale offline files do not interfere with edits.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run build:preview
PORT=4173 npm start
```

`npm run build` produces a Cloudflare Worker in `dist/server` and public assets in `dist/client`. `npm run build:cloudflare` is an alias for that build. `npm run build:preview` creates the same app with Nitro's Node preset in `.output`; `PORT=4173 npm start` serves it for local production verification. All targets generate the service worker from the final client assets before Nitro records their metadata. HTTPS is required in production; localhost is a secure context for testing.

## Included behavior

- Configurable Pomodoro, short and long breaks; long break after a configurable number of completed focus sessions; daily session target.
- Timestamp-based countdown, pause/resume/reset, task-linked sessions, and restoration after reload. Expired sessions are recorded once at their actual scheduled end; time while the app is closed never creates fictitious extra sessions. Breaks and subsequent focus sessions start explicitly.
- Task creation/editing, notes, planned day, optional start date/time and deadline, and goal links.
- To do, in progress, blocked, done and abandoned states. “Won’t do” immediately abandons with the reason retained. “Carry to next sprint” moves to the following sprint and shifts optional start/deadline by the same number of calendar days.
- Daily unfinished-task review when returning on a later date or crossing midnight in the app. Carry to today or abandon individually, or decide later. Blocked tasks stay blocked when carried. Future tasks are not included in the review.
- Daily, weekly, fortnightly and calendar-month sprint cycles, a configurable anchor, previous/future sprint navigation and status views. Monthly anchors clamp at month-end without permanently losing the original day.
- Custom focus-time goals, optional target dates, progress from completed sessions on linked tasks, and the last seven days of focus time.
- Ten original 48-second ambient compositions with continuous playback, random shuffle without immediately repeating the same selection, next track, volume and supported lock-screen media controls.
- Personal audio import (up to 30 MB per file) into IndexedDB, persistence after reload and removal. Playback format availability is browser dependent.
- PWA manifest and maskable icons. Offline app-shell/assets caching, all ten built-in tracks installed for offline use, and cached audio byte-range handling. Updates activate after existing app tabs close.
- Optional system notifications, scheduled Web Audio alarm and a visible-page screen wake lock. Each is feature detected and fails visibly or gracefully.
- IndexedDB transactions preserve concurrent changes from different tabs. BroadcastChannel refreshes other tabs, including hidden tabs. A transaction claims timer completion once, avoiding duplicate session records/notifications.
- Storage protection request, error reporting, validated JSON backup and confirmed restore. Backups include task/goal/session/settings data; user audio must be imported separately. Restores reset the active timer.

## Background operation: actual platform limits

A browser PWA cannot promise an on-time alarm after its process is suspended or killed. The countdown uses a wall-clock deadline and reconciles on return. While available, Web Audio schedules the chime ahead on the audio clock; a page interval handles completion and system notifications. Screen wake lock applies only while the document is visible and can be rejected by device power settings. Notifications require permission, HTTPS and a supported browser. iOS/iPadOS notification support requires installation on the Home Screen.

There is deliberately no fake service-worker timer, perpetual silent audio, or claim that a service worker keeps the app alive. Guaranteed closed-app alerts need a server/push scheduler or a native application, which conflicts with this version's all-local/no-keys scope. Real-device checks remain necessary to characterize background sound behavior on each OS/browser.

References: [MDN background throttling](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), [WebKit Home Screen push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Production domain and canonical URL

The only production app URL is `https://superfocus.lowkey.tools/`. Canonical and Open Graph URLs, JSON-LD, sitemap, discovery resources and PWA launch URLs use this root. There is no base path or main-domain proxy integration. The framework uses `trailingSlash: true` to keep rendered root metadata consistent with the sitemap and guides. The former path route and its scoped discovery files have been removed and return 404. Vinext may first normalize a trailing slash on a missing URL.

`wrangler.json` declares `superfocus.lowkey.tools` as a Custom Domain. A production `wrangler deploy` applies that declaration; local builds and dry runs do not attach the domain. The old private Sites preview remains a separate deployment, and its metadata is retained only as historical project context.

The `proxy.ts` filename is Vinext's request middleware convention. It creates security headers and CSP nonces; it does not proxy or rewrite URLs. Nitro handles static files and server responses through one shared policy, and emits Workers static-asset header rules.

IndexedDB is origin-specific. If moving an existing workspace from another domain, export its backup in Settings and restore it on the new domain; personal audio needs to be imported again. The database name and schema remain unchanged.

## Cloudflare Workers deployment

Create a **Worker** connected to this repository and use these Workers Builds settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | Repository root |
| Node.js | `24`, selected by `.node-version`; `NODE_VERSION=24` can also be set in the build environment |

`wrangler.json` defines the Worker name `superfocus`, entrypoint `dist/server/index.mjs`, static assets in `dist/client`, compatibility date and `nodejs_compat`. Update `name` if your Worker has a different name. Nitro reads the same compatibility date and builds with the `cloudflare-module` preset. The app needs no API keys, database bindings or external storage; `ASSETS` only serves the bundled public files.

Static files use Workers Static Assets and the generated `dist/client/_headers`. The root HTML and RSC render in the Worker with a fresh CSP nonce; missing routes and assets return uncached 404s. Asset HTML normalization and SPA fallbacks are disabled, leaving URL behavior to the app. Only the client directory is uploaded as public assets, keeping server code and build records private. The service worker still caches the root and client assets, including all ten music tracks.

Build and verify locally with the pinned Wrangler CLI:

```sh
npm ci
npm run build:cloudflare
npm run preview:cloudflare
# In another terminal, while the preview is running on http://localhost:4319:
npm run check:cloudflare
```

`check:cloudflare` validates the emitted Worker, asset configuration and shared headers, then checks actual HTTP responses for CSP nonces, canonical/OG metadata, HTML/RSC/errors, offline resources and audio responses to range requests. For a deployed copy of the same build, pass its URL: `npm run check:cloudflare -- https://superfocus.lowkey.tools`.

The local Workers asset runtime returned complete HTTP 200 audio responses during verification. The check validates the bytes for either a full 200 or partial 206 response. SuperFocus's service worker supplies cached audio ranges, including offline; the existing service-worker tests cover this behavior.

For a manual deployment, authenticate with `npx wrangler login`, then run `npm run deploy:cloudflare`. That command builds and deploys. In Workers Builds, use the separate build and deploy commands from the table to avoid rebuilding twice. To validate the upload without publishing, run `npx wrangler deploy --dry-run` after building.

The custom domain is declared directly in `wrangler.json`:

```json
"routes": [{ "pattern": "superfocus.lowkey.tools", "custom_domain": true }]
```

The route uses a hostname without a protocol, path, wildcard or trailing slash. The canonical page URL remains `https://superfocus.lowkey.tools/`. Wrangler applies the Custom Domain when deploying to the account that owns the active `lowkey.tools` zone; Cloudflare manages the associated DNS and certificate. If the hostname still has a CNAME from the old host, resolve that conflicting record before deployment. See [Cloudflare Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

`workers_dev` and `preview_urls` stay enabled, matching Billbook's deployment setup. Keeping the same HTTPS origin preserves browser storage; preview domains have separate storage. Local builds and `--dry-run` only validate the package and configuration.

References: [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Nitro on Workers](https://nitro.build/deploy/providers/cloudflare).

## Data and audio

App data is in the `superfocus` IndexedDB database, `state` store, `app` key. Personal audio blobs live in the `music` store. App assets are cached separately through Cache Storage. No browser localStorage is used. The database is versioned for future schema migrations. Clearing browser/site data removes local data; persistent-storage permission does not replace backups.

The ten bundled tracks are synthesized entirely from original oscillators and note patterns. They contain no third-party recordings or samples. They are dedicated to the public domain under CC0; see `public/audio/LICENSE.txt`. The committed 96 kbps mono MP3s total about 5.8 MB, replacing 21.2 MB of PCM WAV files. Regenerate assets with `npm run generate:assets` (requires local `ffmpeg` with `libmp3lame`; ordinary builds do not need it).

## Search, answer engines and public launch

Metadata includes a descriptive title, canonical URL, robots directives, Open Graph and Twitter summaries, author/publisher identity and PWA metadata. The server-rendered product guide, quick start and FAQ are visible without JavaScript. `lib/site-content.ts` is the common source for the visible answers, JSON-LD graph and Markdown guide. The graph describes the WebApplication, WebPage, FAQPage, creator and publisher; there are no invented ratings, reviews or claims of rich-result eligibility.

`scripts/generate-discovery.mjs` runs before development and production builds. It generates `/robots.txt`, `/sitemap.xml`, `/llms.txt` and `/index.md`. The sitemap contains only `https://superfocus.lowkey.tools/`; the robots directive points to `https://superfocus.lowkey.tools/sitemap.xml`.

The 1200×630 PNG at `/og/superfocus-v2.png` is referenced with an absolute production URL by Open Graph and X large-image metadata, with dimensions and alt text. The card uses only “by @shrinath_prabhu” as its footer credit. Its type uses the same bundled Geist font, converted to vector outlines in `scripts/social-card.svg`. `npm run generate:og` renders that SVG to the committed PNG, without a network request. To change the card copy/design, install Python `fonttools` and `brotli`, run `python3 scripts/generate-social-image.py`, then `npm run generate:og`. Ordinary builds use the committed PNG and require no Python or image service. Use a new versioned filename if replacing a published card.

Once the production domain is publicly accessible, verify its rendered canonical, social image, crawler files and HTTP headers. Submit the root sitemap through the owner's Google Search Console and Bing Webmaster Tools accounts. The authenticated private preview is not an indexable production URL.

`llms.txt` is a community proposal, not an indexing switch. Search and AI answer inclusion are not guaranteed. The implementation follows [Google's AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) and the [llms.txt proposal](https://llmstxt.org/). OwlEye and Shrinath links are visible contextual credits in navigation, the maker section and footer; no hidden links, keyword stuffing or fabricated endorsements are used.

Mobile improvements include safe-area padding, single-column guide layouts, larger touch controls and 16px form inputs. Idle clocks update once per minute, running clocks at the next displayed-second boundary, and both refresh immediately on visibility changes. Original alarm scheduling and elapsed-time recovery remain intact. Static fingerprinted assets receive long-lived cache headers; HTML and the service worker are not marked immutable.

## Security headers and caching

`lib/http-policy.ts` defines shared policies. `vite.config.ts` passes those policies to Nitro for runtime handling and Cloudflare Workers' generated `dist/client/_headers`. `proxy.ts` additionally applies per-request security headers to server-rendered pages, RSC responses and errors. Workers `_headers` covers static assets; server responses set their own headers because [Workers does not apply that file to responses generated by Worker code](https://developers.cloudflare.com/workers/static-assets/headers/). Edit the shared policy rather than generated build files.

Every network-rendered document gets a cryptographically random script nonce; requests supplying server-owned nonce/CSP headers are rejected before rendering. The renderer, JSON-LD and Base UI's CSP provider receive the same nonce. Production blocks unapproved inline scripts, inline event handlers and eval. Local development permits eval and WebSockets for Vite. Inline styles remain allowed for component positioning, progress and slider values. Local audio blobs, fonts, workers, manifests, autoplay and screen wake lock remain allowed; camera, microphone, geolocation, payments and USB are disabled.

Other headers enforce `nosniff`, same-origin framing/resource/opener policies, a restrictive referrer policy, and one-year HSTS. HSTS does not include other subdomains and is not submitted for preload. The framework identification header is disabled. No cross-origin isolation requirement is imposed.

| Response | HTTP caching |
| --- | --- |
| HTML, RSC and server-rendered errors | Private, no-store; no shared CDN cache |
| Fingerprinted JS/CSS and the versioned Geist font | One year, immutable |
| Audio, icons and favicon with stable filenames | One day, then revalidate |
| Service worker, manifest, sitemaps, robots and text guides | Revalidate on every request |

HTTP caching and offline Cache Storage are separate. The PWA deliberately caches the public app shell with its matching CSP header and nonce, plus that build's assets; it does not cache workspace data or RSC payloads. Installation rejects redirected or unmarked sign-in/error HTML. Security-policy and worker-template changes generate a fresh cache version. Older app tabs keep a consistent version until they close. See [MDN Cache behavior](https://developer.mozilla.org/en-US/docs/Web/API/Cache).

Run `npm run typecheck`, `npm test` and `npm run build` before deployment. Start `npm run preview:cloudflare`, then run `npm run check:cloudflare` to validate the generated custom-domain declaration, asset rules and actual Worker responses. This checks fresh nonces, rejection of supplied CSP/nonce headers, root HTML/RSC/404 responses, removed-path 404s, OG metadata, and every precached resource's security/cache headers. For the same build after deployment, use `npm run check:cloudflare -- https://superfocus.lowkey.tools`. A successful dry run or local HTTP check does not verify production DNS or certificate readiness.

The Node preview remains available through `npm run build:preview`, `PORT=4173 npm start` and `npm run check:http` for local server troubleshooting.

Typography uses the locally bundled Geist Sans variable WOFF2 from Vercel's official `geist@1.7.2` package ([font information](https://vercel.com/font)). The font is preloaded, uses `font-display: swap`, and is included automatically in the offline cache. Its SIL Open Font License is preserved at `public/fonts/geist-OFL.txt`. No third-party font request or font package runtime is needed.

The Node tests cover calendar/month-end boundaries, date shifting, daily review, status transitions, timer recovery and idempotence, backup rejection, IndexedDB persistence and concurrent mutations, and offline navigation/audio ranges. `fake-indexeddb` provides an isolated IndexedDB implementation for these tests. They do not pretend to verify browser-specific installation, permissions, autoplay or process suspension.

Lint covers app-owned code. The generated UI catalog and its `use-mobile` helper are excluded rather than editing vendored components. React Compiler-specific lint is disabled because this project does not enable React Compiler; hooks and dependency rules remain enforced.
