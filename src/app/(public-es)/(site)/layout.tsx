import {
  PublicShell,
  publicMetadata,
  publicViewport,
} from '@/components/ttc/mp/PublicShell';

/* The Spanish site's shell layout: the same PublicShell, metadata and
   viewport as the English one ((public)/(site)/layout.tsx), mounted under the
   root layout that prints <html lang="es">. The chrome reads the language
   from the URL, and every /es page sets its own Spanish <head> through
   pageMeta, so nothing here needs to differ — the shared fallbacks stay the
   ones the Spanish pages have always inherited.

   `es/layout.tsx`, one level down, still wraps the page body in
   <div lang="es">. */
export const metadata = publicMetadata;
export const viewport = publicViewport;

export default function PublicEsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
