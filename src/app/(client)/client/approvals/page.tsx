import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ApprovalCard } from "@/components/client/approval-card";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default async function ClientApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  const approvals = await prisma.clientApproval.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, name: true } },
    },
  });

  const serialized = approvals.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    comments: a.comments,
    createdAt: a.createdAt.toISOString(),
    projectId: a.projectId,
    projectName: a.project.name,
    taskId: a.taskId,
    taskName: a.task?.name || null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Approvals
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Review and respond to pending deliverables.
        </p>
      </div>

      {serialized.length === 0 ? (
        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/50 text-lg">No approvals yet</p>
            <p className="text-white/30 text-sm mt-1">
              Items requiring your approval will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {serialized.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
        </div>
      )}
    </div>
  );
}
