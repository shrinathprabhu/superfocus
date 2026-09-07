import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  publisher: 'OwlEye Analytics',
  title: 'SuperFocus — A little structure. A lot more focus.',
  description:
    'Pomodoro sessions, sprint planning, goals and original ambient music. Private, local and available offline.',
  alternates: { canonical: 'https://lowkey.tools/superfocus' },
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
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
