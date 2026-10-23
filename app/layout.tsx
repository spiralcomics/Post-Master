import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'Postmaster — Spiral Comics Social Studio',
  description: 'Create, schedule, and publish Spiral Comics content across every social channel from one place.',
  openGraph: {
    title: 'Postmaster — Spiral Comics Social Studio',
    description: 'Create, schedule, and publish Spiral Comics content from one place.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Postmaster by Spiral Comics' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Postmaster — Spiral Comics Social Studio',
    description: 'Create, schedule, and publish Spiral Comics content from one place.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
