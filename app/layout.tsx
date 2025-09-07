import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Slow Go',
  description: 'Get alerts for speed cameras in San Francisco.',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    images: ['https://slowgo.app/windows11/LargeTile.scale-150.png'],
    url: 'https://slowgo.app',
    description: 'Get alerts for speed cameras in San Francisco.',
    title: 'Slow Go',
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
      <Script
        src="https://analytics.slowgo.app/script.js"
        data-website-id="6d262295-0997-49eb-8b03-42dfa5a2ce87"
        strategy="afterInteractive"
      />
    </html>
  );
}
