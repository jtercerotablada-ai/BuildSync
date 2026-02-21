import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Calendar, Briefcase, FolderKanban, Settings } from "lucide-react";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: Props) {
  const { userId: targetUserId } = await params;
  const currentUserId = await getCurrentUserId();

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      jobTitle: true,
      bio: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  if (!user) notFound();

  const isOwnProfile = currentUserId === targetUserId;

  let sharedWorkspaces: { id: string; name: string }[] = [];
  let sharedProjects: { id: string; name: string; color: string }[] = [];

  if (currentUserId && !isOwnProfile) {
    const currentUserWsIds = (
      await prisma.workspaceMember.findMany({
        where: { userId: currentUserId },
        select: { workspaceId: true },
      })
    ).map((w) => w.workspaceId);

    const targetWs = await prisma.workspaceMember.findMany({
      where: { userId: targetUserId, workspaceId: { in: currentUserWsIds } },
      select: { workspace: { select: { id: true, name: true } } },
    });
    sharedWorkspaces = targetWs.map((w) => w.workspace);

    const currentUserProjIds = (
      await prisma.projectMember.findMany({
        where: { userId: currentUserId },
        select: { projectId: true },
      })
    ).map((p) => p.projectId);

    const targetProj = await prisma.projectMember.findMany({
      where: { userId: targetUserId, projectId: { in: currentUserProjIds } },
      select: { project: { select: { id: true, name: true, color: true } } },
    });
    sharedProjects = targetProj.map((p) => p.project);
  }

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={user.image || ""} />
          <AvatarFallback className="bg-black text-white text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">
              {user.name || "Unnamed user"}
            </h1>
            {user.emailVerified && (
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            )}
          </div>
          {user.jobTitle && (
            <p className="text-muted-foreground mt-0.5">{user.jobTitle}</p>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
            <Calendar className="h-3.5 w-3.5" />
            Member since {memberSince}
          </div>
          {isOwnProfile && (
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/settings">
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Edit profile
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <>
          <Separator className="my-6" />
          <div>
            <h2 className="text-sm font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {user.bio}
            </p>
          </div>
        </>
      )}

      {/* Shared context (only when viewing another user) */}
      {!isOwnProfile && (sharedWorkspaces.length > 0 || sharedProjects.length > 0) && (
        <>
          <Separator className="my-6" />

          {sharedWorkspaces.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Workspaces you share
              </h2>
              <div className="flex flex-wrap gap-2">
                {sharedWorkspaces.map((ws) => (
                  <Badge key={ws.id} variant="secondary">
                    {ws.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {sharedProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects you share
              </h2>
              <div className="space-y-2">
                {sharedProjects.map((proj) => (
                  <Card key={proj.id}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                      <Link
                        href={`/projects/${proj.id}`}
                        className="text-sm font-medium hover:underline truncate"
                      >
                        {proj.name}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
