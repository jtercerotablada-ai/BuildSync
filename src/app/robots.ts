import type { MetadataRoute } from 'next';
import { company } from '@/lib/ttc/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/login',
          '/signup',
          '/dashboard',
          '/my-tasks',
          '/inbox',
          '/portfolios',
          '/goals',
          '/reporting',
          '/settings',
          '/teams',
          '/workspace',
          '/knowledge',
          '/client',
          '/portal',
          '/admin',
          '/logo-styles',
        ],
      },
    ],
    sitemap: `${company.url}/sitemap.xml`,
    host: company.url,
  };
}
