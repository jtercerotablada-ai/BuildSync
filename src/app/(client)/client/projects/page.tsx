import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProjectProgressCard } from "@/components/client/project-progress-card";
import { FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function ClientProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  const accesses = await prisma.clientProjectAccess.findMany({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          tasks: {
            select: { id: true, completed: true },
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

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          My Projects
        </h1>
        <p className="mt-1 text-sm text-white/50">
          All projects you have access to.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="border-white/10 bg-[#151515]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/50 text-lg">No projects assigned yet</p>
            <p className="text-white/30 text-sm mt-1">
              Your team will grant you access to projects as they become available.
            </p>
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
  );
}
