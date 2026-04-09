import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectProgressCard } from "@/components/client/project-progress-card";
import {
  FolderKanban,
  CheckCircle,
  MessageSquare,
  Clock,
} from "lucide-react";

export default async function ClientDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });

  if (!user) redirect("/login");

  // Fetch client's projects via ClientProjectAccess
  const accesses = await prisma.clientProjectAccess.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          tasks: {
            select: { id: true, completed: true },
          },
          _count: {
            select: { tasks: true },
          },
        },
      },
    },
  });

  const projects = accesses.map((a) => {
    const total = a.project.tasks.length;
    const completed = a.project.tasks.filter((t) => t.completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      id: a.project.id,
      name: a.project.name,
      status: a.project.status,
      color: a.project.color,
      progress,
      totalTasks: total,
      completedTasks: completed,
      startDate: a.project.startDate,
      endDate: a.project.endDate,
    };
  });

  // Pending approvals
  const pendingApprovals = await prisma.clientApproval.count({
    where: { clientId: user.id, status: "PENDING" },
  });

  // Unread messages
  const unreadMessages = await prisma.directMessage.count({
    where: { receiverId: user.id, read: false },
  });

  // Recent activity (latest completed tasks across client projects)
  const projectIds = accesses.map((a) => a.projectId);
  const recentTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      completed: true,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      completedAt: true,
      project: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Welcome back, {user.name?.split(" ")[0] || "Client"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Here&apos;s an overview of your projects and pending items.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c9a84c]/10">
              <FolderKanban className="h-6 w-6 text-[#c9a84c]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{projects.length}</p>
              <p className="text-sm text-white/50">Active Projects</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <CheckCircle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingApprovals}</p>
              <p className="text-sm text-white/50">Pending Approvals</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{unreadMessages}</p>
              <p className="text-sm text-white/50">Unread Messages</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Your Projects</h2>
        {projects.length === 0 ? (
          <Card className="border-white/10 bg-[#151515]">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-10 w-10 text-white/20 mb-3" />
              <p className="text-white/50">No projects assigned yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectProgressCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="p-0">
            {recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-white/20 mb-3" />
                <p className="text-white/50">No recent activity.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{task.name}</p>
                      <p className="text-xs text-white/40">
                        {task.project?.name}
                      </p>
                    </div>
                    <p className="text-xs text-white/30">
                      {task.completedAt
                        ? new Date(task.completedAt).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
