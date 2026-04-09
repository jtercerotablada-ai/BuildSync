import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyClientAccess } from "@/lib/auth-guards";
import { ProjectDetailView } from "@/components/client/project-detail-view";

interface Props {
  params: { projectId: string };
}

export default async function ClientProjectDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  try {
    await verifyClientAccess(user.id, params.projectId);
  } catch {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      sections: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            select: {
              id: true,
              name: true,
              completed: true,
              completedAt: true,
              dueDate: true,
              priority: true,
              taskType: true,
              assignee: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, jobTitle: true },
          },
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          uploader: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  // Calculate milestones (tasks with MILESTONE type)
  const allTasks = project.sections.flatMap((s) => s.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const milestones = allTasks
    .filter((t) => t.taskType === "MILESTONE")
    .map((t) => ({
      id: t.id,
      name: t.name,
      dueDate: t.dueDate,
      completed: t.completed,
    }));

  const teamMembers = project.members.map((m) => ({
    id: m.user.id,
    name: m.user.name || "Unknown",
    email: m.user.email || "",
    image: m.user.image,
    role: m.role,
    jobTitle: m.user.jobTitle,
  }));

  const documents = project.files.map((f) => ({
    id: f.id,
    name: f.name,
    url: f.url,
    size: f.size,
    mimeType: f.mimeType,
    createdAt: f.createdAt.toISOString(),
    uploaderName: f.uploader.name || "Unknown",
  }));

  const serializedProject = {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    color: project.color,
    startDate: project.startDate?.toISOString() || null,
    endDate: project.endDate?.toISOString() || null,
    progress,
    totalTasks,
    completedTasks,
    ownerName: project.owner?.name || "Unknown",
  };

  return (
    <ProjectDetailView
      project={serializedProject}
      milestones={milestones.map((m) => ({
        ...m,
        dueDate: m.dueDate?.toISOString() || null,
      }))}
      teamMembers={teamMembers}
      documents={documents}
    />
  );
}
