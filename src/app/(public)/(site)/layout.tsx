import {
  PublicShell,
  publicMetadata,
  publicViewport,
} from '@/components/ttc/mp/PublicShell';

/* The English site's shell layout. Everything it used to hold — fonts,
   mp.css, the metadata, the structured data, the chrome — is PublicShell now,
   because the Spanish site mounts the very same thing from its own route
   group ((public-es)/(site)/layout.tsx) and a copy would drift.

   It is a layout of its own, one level below the root layout in
   ../layout.tsx, rather than part of it: the title template declared here
   applies to the segments BELOW the one that declares it, and the error
   boundary (../error.tsx) has to sit above the chrome. Both were true under
   the single root layout and both stay true this way. */
export const metadata = publicMetadata;
export const viewport = publicViewport;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
