import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DocumentList } from "@/components/client/document-list";

export default async function ClientDocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  // Get all project IDs client has access to
  const accesses = await prisma.clientProjectAccess.findMany({
    where: { userId: user.id },
    select: {
      projectId: true,
      canUpload: true,
      project: { select: { id: true, name: true } },
    },
  });

  const projectIds = accesses.map((a) => a.projectId);

  // Fetch all files from those projects
  const files = await prisma.file.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      uploader: { select: { name: true } },
    },
  });

  const documents = files.map((f) => ({
    id: f.id,
    name: f.name,
    url: f.url,
    size: f.size,
    mimeType: f.mimeType,
    createdAt: f.createdAt.toISOString(),
    projectId: f.projectId,
    projectName: f.project.name,
    uploaderName: f.uploader.name || "Unknown",
  }));

  const projects = accesses.map((a) => ({
    id: a.project.id,
    name: a.project.name,
    canUpload: a.canUpload,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Documents
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Browse and manage documents across your projects.
        </p>
      </div>

      <DocumentList documents={documents} projects={projects} />
    </div>
  );
}
