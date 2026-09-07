import { mkdirSync, writeFileSync } from 'node:fs';
import { site, faqs, quickStart } from '../lib/site-content.ts';

// Also provide path-scoped copies for integration into the existing lowkey.tools site.
mkdirSync('public/superfocus', { recursive: true });
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site.canonical}</loc></url>
</urlset>
`;
const llms = `# ${site.name}

> ${site.description}

SuperFocus is part of lowkey.tools, built by ${site.creator.name}, from the makers of ${site.publisher.name}.
Canonical app URL: ${site.canonical}. The subdomain superfocus.lowkey.tools is an alternate entry point.
Workspace data is device-local, with no account or cloud sync. Background alarms are best effort and cannot run reliably when the app is closed or suspended.

## App guide
- [SuperFocus facts and frequently asked questions](${site.canonical}/index.md): Plain-text features, setup, privacy, music and alarm limitations.
- [SuperFocus workspace](${site.canonical}): The interactive Pomodoro timer and sprint planner.

## Makers
- [OwlEye Analytics](${site.publisher.url}): From the makers of OwlEye Analytics.
- [Shrinath Prabhu](${site.creator.url}): SuperFocus creator and frontend engineer.
- [lowkey.tools](https://lowkey.tools): The tools collection that includes SuperFocus.
`;
const guide = `# ${site.name}

> ${site.description}

Canonical: ${site.canonical}

## Quick start
${quickStart.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Questions and answers
${faqs.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}

## Makers
Part of [lowkey.tools](https://lowkey.tools), from the makers of [OwlEye Analytics](${site.publisher.url}). Designed and built by [Shrinath Prabhu](${site.creator.url}).
`;
for (const prefix of ['public', 'public/superfocus']) {
  writeFileSync(`${prefix}/sitemap.xml`, sitemap);
  writeFileSync(`${prefix}/llms.txt`, llms);
}
writeFileSync('public/superfocus/index.md', guide);
writeFileSync(
  'public/robots.txt',
  `User-agent: *\nAllow: /\n\nSitemap: ${site.canonical}/sitemap.xml\n`,
);
console.log(
  'Generated canonical sitemap, robots.txt, llms.txt and public Markdown guide.',
);
