import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ThemeToggle from '@/components/theme-toggle';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MockSnap — AI-powered Mock API Generator',
  description: 'Describe your API in words, paste JSON, or drop an OpenAPI spec — get a live REST + GraphQL API with docs in seconds.',
  metadataBase: new URL('https://mocksnap.dev'),
  keywords: ['mock API', 'API generator', 'REST API', 'GraphQL', 'mock server', 'API prototyping', 'OpenAPI', 'JSON', 'developer tools'],
  authors: [{ name: 'VeriContext' }],
  creator: 'VeriContext',
  alternates: {
    canonical: 'https://mocksnap.dev',
  },
  openGraph: {
    title: 'MockSnap — AI-powered Mock API Generator',
    description: 'Describe your API in words — get live REST + GraphQL with docs in seconds. No signup needed.',
    url: 'https://mocksnap.dev',
    siteName: 'MockSnap',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MockSnap — AI-powered Mock API Generator',
    description: 'Describe your API in words — get live REST + GraphQL with docs in seconds.',
    creator: '@vericontext',
    images: ['/og.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MockSnap',
  url: 'https://mocksnap.dev',
  description: 'AI-powered Mock API Generator. Describe your API in words, paste JSON, or drop an OpenAPI spec — get a live REST + GraphQL API with docs in seconds.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'VeriContext',
    url: 'https://github.com/vericontext',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
