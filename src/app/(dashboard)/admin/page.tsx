import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveAccess } from "@/lib/auth-utils";
import { canAccessSection, FORBIDDEN_REDIRECT } from "@/lib/access-control";
import { AdminClientPage } from "./admin-client";

/**
 * /admin — workspace administration page.
 *
 * Server-side gated: only workspace OWNER + ADMIN can access. Anyone
 * else who hits this URL gets redirected to /home. The sidebar
 * already hides this link from non-admins, so this guard catches
 * direct-URL navigation attempts.
 *
 * Renders the AdminClientPage which contains the tabs for billing,
 * workspace members, integrations, and danger zone.
 */
export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) {
    redirect("/login");
  }

  const access = await getEffectiveAccess(user.id);
  if (!access) {
    redirect("/login");
  }
  if (!canAccessSection(access, "admin")) {
    redirect(FORBIDDEN_REDIRECT);
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: access.workspaceId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
          projects: true,
        },
      },
    },
  });
  if (!workspace) {
    redirect("/home");
  }

  return (
    <AdminClientPage
      workspace={{
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId ?? "",
        createdAt: workspace.createdAt.toISOString(),
        memberCount: workspace._count.members,
        projectCount: workspace._count.projects,
      }}
      callerRole={access.workspaceRole}
      callerUserId={access.userId}
    />
  );
}
