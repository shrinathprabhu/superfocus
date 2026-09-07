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

The ten bundled tracks are synthesized entirely from original oscillators and note patterns. They contain no third-party recordings or samples. They are dedicated to the public domain under CC0; see `public/audio/LICENSE.txt`. Regenerate assets with `npm run generate:assets`.

## Validation

The Node tests cover calendar/month-end boundaries, date shifting, daily review, status transitions, timer recovery and idempotence, backup rejection, IndexedDB persistence and concurrent mutations, and offline navigation/audio ranges. `fake-indexeddb` provides an isolated IndexedDB implementation for these tests. They do not pretend to verify browser-specific installation, permissions, autoplay or process suspension.

Lint covers app-owned code. The generated UI catalog and its `use-mobile` helper are excluded rather than editing vendored components. React Compiler-specific lint is disabled because this project does not enable React Compiler; hooks and dependency rules remain enforced.
