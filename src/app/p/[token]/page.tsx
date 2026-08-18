import { notFound } from "next/navigation";
import { resolveShareLink, recordVisit } from "@/lib/client-link/access";
import { buildClientProjectView } from "@/lib/client-link/projection";
import { ClientProjectPage } from "@/components/client-link/client-project-page";

/**
 * The client-facing project page. One link, one project, no password.
 *
 * Data only. Everything rendered comes from buildClientProjectView — this
 * file must never reach for Prisma itself, or the "one place decides what a
 * client sees" guarantee stops being true.
 */

// Always render fresh. A revoked link has to stop working immediately, and a
// cached HTML page would happily keep serving the project after revocation.
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Unknown, revoked and expired all land here identically — the page 404s
  // without ever confirming that a link existed.
  const link = await resolveShareLink(token);
  if (!link) notFound();

  const view = await buildClientProjectView(link.projectId);
  if (!view) notFound();

  // Telemetry for the firm ("has the owner opened it yet?"). Cannot throw.
  await recordVisit(link.id);

  // `link.label` is the ONLY identity a password-less link legitimately knows
  // (e.g. "Board president"). It is already resolved and client-safe — passing
  // it is presentational, not a new read, and this route stays Prisma-free.
  return <ClientProjectPage view={view} viewerLabel={link.label} token={token} />;
}
