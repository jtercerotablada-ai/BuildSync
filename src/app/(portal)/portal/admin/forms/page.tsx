import Link from "next/link";
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
import { FileText, Inbox, ArrowRight } from "lucide-react";

/**
 * Admin → Intake Forms
 *
 * Lists every Form in the user's workspace with a submission count
 * and a deep-link to its submissions view. This is the SaaS-side
 * intake (Asana parity) — distinct from the marketing /contact form
 * which lives in /portal/admin/submissions.
 */
export default async function AdminFormsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/signin");

  const currentMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
    redirect("/portal/dashboard");
  }

  // All forms whose parent project belongs to this workspace.
  const forms = await prisma.form.findMany({
    where: { project: { workspaceId: currentMember.workspaceId } },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalSubmissions = forms.reduce(
    (sum, f) => sum + f._count.submissions,
    0
  );
  const activeForms = forms.filter((f) => f.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intake Forms</h1>
        <p className="text-muted-foreground">
          All Forms in your workspace and the submissions they generate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{forms.length}</div>
            <p className="text-xs text-muted-foreground">Total forms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeForms}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSubmissions}</div>
            <p className="text-xs text-muted-foreground">Total submissions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Forms ({forms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No forms yet.</p>
              <p className="text-xs text-muted-foreground">
                Open any project and add an intake form from its Workflow tab.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">{form.name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${form.project.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        {form.project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{form.visibility}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={form.isActive ? "default" : "secondary"}>
                        {form.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {form._count.submissions}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(form.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/portal/admin/forms/${form.id}/submissions`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
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
