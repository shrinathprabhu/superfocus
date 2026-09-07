import type { Metadata, Viewport } from 'next';
import { site } from '@/lib/site-content';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://lowkey.tools'),
  applicationName: site.name,
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  publisher: 'OwlEye Analytics',
  title: site.title,
  description: site.description,
  alternates: { canonical: site.canonical },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: site.canonical,
    siteName: 'lowkey.tools',
    title: site.title,
    description: site.description,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: site.title,
    description: site.description,
  },
  category: 'productivity',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/icons/icon-192.png' },
  appleWebApp: {
    capable: true,
    title: 'SuperFocus',
    statusBarStyle: 'black-translucent',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#121218',
  colorScheme: 'dark',
  viewportFit: 'cover',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="describedby" href="/superfocus/llms.txt" type="text/plain" />
        <link
          rel="alternate"
          href="/superfocus/index.md"
          type="text/markdown"
          title="SuperFocus app guide"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
