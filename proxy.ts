import { NextResponse, type NextRequest } from 'next/server';
import {
  assetHeaders,
  contentSecurityPolicy,
  createNonce,
  documentCacheHeaders,
  securityHeaders,
} from './lib/http-policy';

export function proxy(request: NextRequest) {
  // These are server-owned inputs, never browser request headers. Reject them
  // before Vinext's renderer can prefer an original CSP over proxy overrides.
  if (
    [
      'x-nonce',
      'content-security-policy',
      'content-security-policy-report-only',
    ].some((key) => request.headers.has(key))
  ) {
    return new NextResponse('Invalid request headers.', {
      status: 400,
      headers: {
        ...securityHeaders,
        ...documentCacheHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Security-Policy':
          "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      },
    });
  }
  const asset = assetHeaders(request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  const nonce = createNonce();
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  );
  // Give the document, framework and component library the same trusted nonce.
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [key, value] of Object.entries(securityHeaders))
    response.headers.set(key, value);
  for (const [key, value] of Object.entries(asset ?? documentCacheHeaders))
    response.headers.set(key, value);
  if (!asset) response.headers.set('Content-Security-Policy', csp);
  if (['/', '/superfocus', '/superfocus/'].includes(request.nextUrl.pathname)) {
    response.headers.set('X-SuperFocus-Shell', '1');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
