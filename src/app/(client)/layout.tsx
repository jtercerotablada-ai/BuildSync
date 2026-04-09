import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ClientShell } from "@/components/client/client-shell";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Verify user has CLIENT role (or ADMIN/OWNER who can view client portal)
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      workspaceMembers: {
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const role = user.workspaceMembers[0]?.role;
  if (role !== "CLIENT" && role !== "ADMIN" && role !== "OWNER") {
    redirect("/home");
  }

  return (
    <ClientShell
      user={{
        id: user.id,
        name: user.name || "Client",
        email: user.email || "",
        image: user.image,
      }}
    >
      {children}
    </ClientShell>
  );
}
