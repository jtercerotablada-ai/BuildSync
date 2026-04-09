import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import prisma from "@/lib/prisma";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Verify user has WORKER, ADMIN, or OWNER role
  if (session.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (user) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        select: { role: true },
      });

      const role = membership?.role;
      if (role !== "WORKER" && role !== "ADMIN" && role !== "OWNER") {
        redirect("/");
      }
    } else {
      redirect("/");
    }
  }

  return <DashboardShell variant="ttc" basePath="/portal">{children}</DashboardShell>;
}
