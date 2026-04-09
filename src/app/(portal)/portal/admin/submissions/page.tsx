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
import { SubmissionActions } from "@/components/admin/submission-actions";
import { Mail } from "lucide-react";

function getStatusColor(status: string) {
  switch (status) {
    case "NEW":
      return "default" as const;
    case "REVIEWED":
      return "secondary" as const;
    case "CONTACTED":
      return "outline" as const;
    default:
      return "default" as const;
  }
}

export default async function AdminSubmissionsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/signin");

  const currentMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
    redirect("/portal/dashboard");
  }

  const submissions = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  const newCount = submissions.filter((s) => s.status === "NEW").length;
  const reviewedCount = submissions.filter((s) => s.status === "REVIEWED").length;
  const contactedCount = submissions.filter((s) => s.status === "CONTACTED").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact Submissions</h1>
        <p className="text-muted-foreground">
          Review and manage contact form submissions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{newCount}</div>
            <p className="text-xs text-muted-foreground">New submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{reviewedCount}</div>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contactedCount}</div>
            <p className="text-xs text-muted-foreground">Contacted</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            All Submissions ({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No contact submissions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell>{sub.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.phone || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.service}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {sub.message}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(sub.status)}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SubmissionActions
                        submissionId={sub.id}
                        currentStatus={sub.status}
                        fullMessage={sub.message}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
