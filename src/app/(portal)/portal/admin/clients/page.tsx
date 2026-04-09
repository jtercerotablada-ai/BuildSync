import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteClientDialog } from "@/components/admin/invite-client-dialog";
import { ClientAccessTable } from "@/components/admin/client-access-table";
import { Building2 } from "lucide-react";

export default async function AdminClientsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/signin");

  const currentMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
    redirect("/portal/dashboard");
  }

  const clients = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: currentMember.workspaceId,
      role: "CLIENT",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          clientProjectAccesses: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const pendingInvitations = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId: currentMember.workspaceId,
      role: "CLIENT",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch all projects in workspace for the invite dialog
  const projects = await prisma.project.findMany({
    where: { workspaceId: currentMember.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage client access and project permissions.
          </p>
        </div>
        <InviteClientDialog projects={projects} />
      </div>

      {/* Active Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Active Clients ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No clients found. Invite your first client to get started.
            </p>
          ) : (
            <div className="space-y-6">
              {clients.map((client) => (
                <div key={client.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {client.user.name || "Unnamed Client"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {client.user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>CLIENT</Badge>
                      <span className="text-xs text-muted-foreground">
                        Joined {new Date(client.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Project Access Table */}
                  <ClientAccessTable
                    clientId={client.user.id}
                    clientName={client.user.name || "Client"}
                    accesses={client.user.clientProjectAccesses.map((a) => ({
                      id: a.id,
                      projectId: a.project.id,
                      projectName: a.project.name,
                      canComment: a.canComment,
                      canUpload: a.canUpload,
                      canApprove: a.canApprove,
                    }))}
                    projects={projects}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Client Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">PENDING</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
