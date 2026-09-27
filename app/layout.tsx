import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://spiral-comics-postmaster.magic-daisy-1168.chatgpt.site'),
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
