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
import { InviteWorkerDialog } from "@/components/admin/invite-worker-dialog";
import { Users } from "lucide-react";

export default async function AdminWorkersPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/signin");

  const currentMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
    redirect("/portal/dashboard");
  }

  const workers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: currentMember.workspaceId,
      role: { in: ["WORKER", "MEMBER"] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          jobTitle: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const pendingInvitations = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId: currentMember.workspaceId,
      role: { in: ["WORKER", "MEMBER"] },
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workers</h1>
          <p className="text-muted-foreground">
            Manage workers and team members in your workspace.
          </p>
        </div>
        <InviteWorkerDialog />
      </div>

      {/* Active Workers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Workers ({workers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No workers found. Invite your first worker to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell className="font-medium">
                      {worker.user.name || "Unnamed"}
                    </TableCell>
                    <TableCell>{worker.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={worker.role === "WORKER" ? "default" : "secondary"}>
                        {worker.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {worker.user.jobTitle || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(worker.joinedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
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
                      <Badge variant="outline">{inv.role}</Badge>
                    </TableCell>
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
