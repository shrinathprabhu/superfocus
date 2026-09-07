# SuperFocus

A local-first Pomodoro and sprint planner with original ambient music. Built with React, TypeScript, Vinext/Vite and IndexedDB. No task-data backend, accounts, analytics, API keys or streaming integrations.

## Run

```sh
npm install
npm run dev
```

Open the local address printed by the server. Both `/` and `/superfocus` render the app. Service-worker registration is intentionally disabled during development, so stale offline files do not interfere with edits.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`build` creates the Worker app and generates `dist/client/sw.js` from the final asset hashes. Use the production preview printed by `npm start` to exercise installation and offline mode. Serve the Worker entry and its `dist/client` static assets together over HTTPS. Localhost is also a secure context for development.

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

## Domains and canonical URL

Every app route declares `https://lowkey.tools/superfocus` as its canonical URL, including when served at `https://superfocus.lowkey.tools` or the private Sites preview. This is an SEO declaration, not a redirect and not data synchronization.

This repository is a standalone app; it does not contain the existing `lowkey.tools` site or its DNS configuration. To expose both requested URLs, map `superfocus.lowkey.tools` to this deployment and route `/superfocus` on the main domain to this app. The main-domain integration must also route its static assets, manifest, icons and worker. Do not map the main domain wholesale or overwrite its existing service worker.

For a shared-origin integration, adjust manifest start URL/scope and worker registration scope to `/superfocus/`, serve the app at the trailing-slash path, and namespace assets under that path. A reverse proxy must preserve asset MIME types, range requests, redirects and worker scope headers. These deployment-specific settings depend on the current main-site host. The standalone configuration uses root assets and a root worker scope.

IndexedDB is origin-specific. `lowkey.tools` and `superfocus.lowkey.tools` necessarily have separate stores, even with the same canonical URL. Use a single preferred domain for daily use, or export/restore to move data. Cross-origin synchronization would require a separate explicit design.

## Data and audio

App data is in the `superfocus` IndexedDB database, `state` store, `app` key. Personal audio blobs live in the `music` store. App assets are cached separately through Cache Storage. No browser localStorage is used. The database is versioned for future schema migrations. Clearing browser/site data removes local data; persistent-storage permission does not replace backups.

The ten bundled tracks are synthesized entirely from original oscillators and note patterns. They contain no third-party recordings or samples. They are dedicated to the public domain under CC0; see `public/audio/LICENSE.txt`. The committed 96 kbps mono MP3s total about 5.8 MB, replacing 21.2 MB of PCM WAV files. Regenerate assets with `npm run generate:assets` (requires local `ffmpeg` with `libmp3lame`; ordinary builds do not need it).

## Search, answer engines and public launch

Metadata includes a descriptive title, canonical URL, robots directives, Open Graph and Twitter summaries, author/publisher identity and PWA metadata. The server-rendered product guide, quick start and FAQ are visible without JavaScript. `lib/site-content.ts` is the common source for the visible answers, JSON-LD graph and Markdown guide. The graph describes the WebApplication, WebPage, FAQPage, creator and publisher; there are no invented ratings, reviews or claims of rich-result eligibility.

`scripts/generate-discovery.mjs` runs before development and production builds. It generates `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/superfocus/sitemap.xml`, `/superfocus/llms.txt` and `/superfocus/index.md`. Sitemaps include only the canonical app URL, not duplicate entry points, anchors or client-only views. The path-scoped discovery files can be integrated without replacing other lowkey.tools discovery content. The robots sitemap directive names the canonical host's path-scoped sitemap.

The current Sites URL is owner-private. Search engines cannot index an authenticated preview. Before public launch, route the canonical app and its discovery files on lowkey.tools, complete the shared-origin asset/worker setup described above, and merge the SuperFocus entry into the existing domain sitemap and llms.txt. Preserve the main site's root robots.txt, add the SuperFocus sitemap declaration, and ensure its rules allow the app and assets. Cross-host sitemap submission requires ownership verification. Verify the public canonical URL in Google Search Console and Bing Webmaster Tools and submit its sitemap using the domain owner's accounts. Those accounts and DNS configuration are outside this checkout.

`llms.txt` is a community proposal, not an indexing switch. Search and AI answer inclusion are not guaranteed. The implementation follows [Google's AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) and the [llms.txt proposal](https://llmstxt.org/). OwlEye and Shrinath links are visible contextual credits in navigation, the maker section and footer; no hidden links, keyword stuffing or fabricated endorsements are used.

Mobile improvements include safe-area padding, single-column guide layouts, larger touch controls and 16px form inputs. Idle clocks update once per minute, running clocks at the next displayed-second boundary, and both refresh immediately on visibility changes. Original alarm scheduling and elapsed-time recovery remain intact. Static fingerprinted assets receive long-lived cache headers; HTML and the service worker are not marked immutable.

## Security headers and caching

`lib/http-policy.ts` defines shared policies. `scripts/generate-http-config.mjs` runs before development/build and generates Cloudflare's `public/_headers` and Vercel's `vercel.json`. Both cover static responses. `proxy.ts` applies security headers to server-rendered pages, RSC responses and errors, because Cloudflare's `_headers` file does not cover Worker-generated responses.

Every network-rendered document gets a cryptographically random script nonce; requests supplying server-owned nonce/CSP headers are rejected before rendering. The renderer, JSON-LD and Base UI's CSP provider receive the same nonce. Production blocks unapproved inline scripts, inline event handlers and eval. Local development permits eval and WebSockets for Vite. Inline styles remain allowed for component positioning, progress and slider values. Local audio blobs, fonts, workers, manifests, autoplay and screen wake lock remain allowed; camera, microphone, geolocation, payments and USB are disabled.

Other headers enforce `nosniff`, same-origin framing/resource/opener policies, a restrictive referrer policy, and one-year HSTS. HSTS does not include other subdomains and is not submitted for preload. The framework identification header is disabled. No cross-origin isolation requirement is imposed.

| Response | HTTP caching |
| --- | --- |
| HTML, RSC and server-rendered errors | Private, no-store; no shared CDN cache |
| Fingerprinted JS/CSS and the versioned Geist font | One year, immutable |
| Audio, icons and favicon with stable filenames | One day, then revalidate |
| Service worker, manifest, sitemaps, robots and text guides | Revalidate on every request |

HTTP caching and offline Cache Storage are separate. The PWA deliberately caches the public app shell with its matching CSP header and nonce, plus that build's assets; it does not cache workspace data or RSC payloads. Installation rejects redirected or unmarked sign-in/error HTML. Security-policy and worker-template changes generate a fresh cache version. Older app tabs keep a consistent version until they close. See [MDN Cache behavior](https://developer.mozilla.org/en-US/docs/Web/API/Cache).

The deployed Sites preview runs on Cloudflare, where `_headers` and the server proxy are active. **`vercel.json` contains matching hosting rules, not a Vercel runtime adapter or a Vercel deployment.** This checkout still builds a Cloudflare Worker. Moving it to Vercel requires a compatible runtime adapter (Vinext documents Nitro's Vercel preset) or a separate supported build target, then deployment verification on that platform. No private-preview proxy rewrite, domain redirect, account-level WAF/rate-limit rule or DNS change is configured here. When integrating into the existing lowkey.tools origin, merge the relevant scoped rules and preserve that site's other apps and policies.

After starting the production preview on port 4173, run `npm run check:http` (or append `-- https://your-accessible-host`). It verifies HTML/RSC/404 headers, unique matching script nonces including Base UI, rejection of supplied nonce/CSP headers, and every offline resource's security/cache headers. Hosted access gates can add or override headers; verify the final public origin when it is connected. Browser interaction testing has not been performed in this change.

Configuration references: [Cloudflare static headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Vercel header rules](https://vercel.com/docs/project-configuration/vercel-json#headers).

## Validation

Typography uses the locally bundled Geist Sans variable WOFF2 from Vercel's official `geist@1.7.2` package ([font information](https://vercel.com/font)). The font is preloaded, uses `font-display: swap`, and is included automatically in the offline cache. Its SIL Open Font License is preserved at `public/fonts/geist-OFL.txt`. No third-party font request or font package runtime is needed.

The Node tests cover calendar/month-end boundaries, date shifting, daily review, status transitions, timer recovery and idempotence, backup rejection, IndexedDB persistence and concurrent mutations, and offline navigation/audio ranges. `fake-indexeddb` provides an isolated IndexedDB implementation for these tests. They do not pretend to verify browser-specific installation, permissions, autoplay or process suspension.

Lint covers app-owned code. The generated UI catalog and its `use-mobile` helper are excluded rather than editing vendored components. React Compiler-specific lint is disabled because this project does not enable React Compiler; hooks and dependency rules remain enforced.
