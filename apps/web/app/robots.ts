import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/m/', '/api/'],
      },
    ],
    sitemap: 'https://mocksnap.dev/sitemap.xml',
  };
}
