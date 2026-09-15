// Shared by server middleware, Nitro runtime and Workers _headers.
export const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(self), autoplay=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export const documentCacheHeaders: Record<string, string> = {
  // Nonced HTML/RSC must not be shared or independently revalidated by a CDN.
  // Cache Storage deliberately retains a complete public shell + its CSP offline.
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
};
const revalidate = 'public, max-age=0, must-revalidate';
const immutable = 'public, max-age=31536000, immutable';

export const assetRules: { path: string; headers: Record<string, string> }[] = [
  {
    path: '/sw.js',
    headers: {
      'Cache-Control': revalidate,
      'Service-Worker-Allowed': '/',
      // Worker scripts have their own CSP; allow installation's same-origin fetches.
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'",
    },
  },
  { path: '/manifest.webmanifest', headers: { 'Cache-Control': revalidate } },
  {
    path: '/og/superfocus-v2.png',
    headers: { 'Cache-Control': immutable, 'Content-Type': 'image/png' },
  },
  { path: '/_next/static/*', headers: { 'Cache-Control': immutable } },
  {
    path: '/fonts/geist-sans-v1.7.2.woff2',
    headers: { 'Cache-Control': immutable },
  },
  { path: '/fonts/geist-OFL.txt', headers: { 'Cache-Control': revalidate } },
  {
    path: '/audio/*',
    headers: { 'Cache-Control': 'public, max-age=86400, must-revalidate' },
  },
  {
    path: '/icons/*',
    headers: { 'Cache-Control': 'public, max-age=86400, must-revalidate' },
  },
  {
    path: '/favicon.svg',
    headers: { 'Cache-Control': 'public, max-age=86400, must-revalidate' },
  },
  {
    path: '/vinext-client-entry-manifest.json',
    headers: { 'Cache-Control': revalidate },
  },
  ...['/robots.txt', '/llms.txt'].map((path) => ({
    path,
    headers: {
      'Cache-Control': revalidate,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })),
  ...['/sitemap.xml'].map((path) => ({
    path,
    headers: {
      'Cache-Control': revalidate,
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })),
  {
    path: '/index.md',
    headers: {
      'Cache-Control': revalidate,
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: '</llms.txt>; rel="describedby"',
    },
  },
];

// Nitro translates ** wildcards into Workers static-asset header rules.
export const hostingRules = [
  { path: '/**', headers: securityHeaders },
  { path: '/', headers: documentCacheHeaders },
  ...assetRules.map(({ path, headers }) => ({
    path: path.replace('/*', '/**'),
    headers,
  })),
];

export function assetHeaders(
  pathname: string,
): Record<string, string> | undefined {
  return assetRules.find(({ path }) =>
    path.endsWith('*')
      ? pathname.startsWith(path.slice(0, -1))
      : path === pathname,
  )?.headers;
}

export function createNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
}

export function contentSecurityPolicy(
  nonce: string,
  development = false,
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    // Component positioning, progress and sliders use dynamic style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}
