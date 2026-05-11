import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Portfolio of structural engineering projects by Tercero Tablada — residential towers, commercial complexes, industrial warehouses, and public infrastructure.',
  openGraph: {
    title: 'Projects · Tercero Tablada',
    description:
      'Portfolio of structural engineering projects — residential, commercial, industrial, and public works.',
    type: 'website',
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
