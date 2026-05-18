import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { ChevronLeft, Download, ExternalLink, Inbox } from "lucide-react";

type SubmissionAnswer = { value?: unknown };
type SubmissionData = Record<string, SubmissionAnswer | string | number | null>;

function formatAnswerCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "object" && v && "name" in v
          ? String((v as { name: unknown }).name)
          : String(v)
      )
      .join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) return formatAnswerCell(obj.value);
    if ("name" in obj) return String(obj.name);
    return JSON.stringify(obj);
  }
  return String(value);
}

export default async function AdminFormSubmissionsPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) redirect("/auth/signin");

  const currentMember = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true, role: true },
  });

  if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
    redirect("/portal/dashboard");
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      project: {
        select: { id: true, name: true, workspaceId: true },
      },
    },
  });

  if (!form || form.project.workspaceId !== currentMember.workspaceId) {
    notFound();
  }

  const submissions = await prisma.formSubmission.findMany({
    where: { formId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // FormSubmission stores taskId but doesn't have a typed Task relation,
  // so fetch the task names in a separate batched query.
  const taskIds = submissions
    .map((s) => s.taskId)
    .filter((id): id is string => !!id);
  const tasks = taskIds.length
    ? await prisma.task.findMany({
        where: { id: { in: taskIds } },
        select: { id: true, name: true },
      })
    : [];
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Show ALL fields, even HEADING (skipped in cell). Order preserved.
  const fields = (form.fields as Array<{
    id: string;
    label: string;
    type: string;
  }>) || [];
  const dataFields = fields.filter((f) => f.type !== "HEADING");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link
          href="/portal/admin/forms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All forms
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{form.name}</h1>
            <p className="text-muted-foreground">
              Submissions for{" "}
              <Link
                href={`/projects/${form.project.id}`}
                className="hover:underline"
              >
                {form.project.name}
              </Link>
            </p>
          </div>
          <a
            href={`/api/forms/${form.id}/submissions/export`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Submissions ({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No submissions yet.</p>
              <p className="text-xs text-muted-foreground">
                Share the form&apos;s public URL and submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {dataFields.map((f) => (
                      <TableHead key={f.id} className="whitespace-nowrap">
                        {f.label}
                      </TableHead>
                    ))}
                    <TableHead>Task</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((sub) => {
                    const data = (sub.data as SubmissionData) || {};
                    const task = sub.taskId ? taskById.get(sub.taskId) : null;
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(sub.createdAt).toLocaleString()}
                        </TableCell>
                        {dataFields.map((f) => (
                          <TableCell
                            key={f.id}
                            className="max-w-[240px] truncate"
                          >
                            {formatAnswerCell(data[f.id])}
                          </TableCell>
                        ))}
                        <TableCell>
                          {task ? (
                            <Link
                              href={`/tasks/${task.id}`}
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              {task.name.length > 30
                                ? `${task.name.slice(0, 30)}…`
                                : task.name}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <Badge variant="outline">No task</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
