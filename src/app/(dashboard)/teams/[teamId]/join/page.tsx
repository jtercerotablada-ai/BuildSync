import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { JoinTeamButton } from "@/components/teams/join-team-button";

/**
 * Public-ish team invite landing page.
 *
 * Reached via the "Copy invite link" flow in InviteTeamModal. The URL
 * shape is /teams/:teamId/join. Anyone with the link can land here,
 * but the actual join is gated by /api/teams/:teamId/join (workspace
 * membership + non-PRIVATE team).
 */
export default async function TeamJoinPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect(`/login?callbackUrl=/teams/${teamId}/join`);
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      description: true,
      privacy: true,
      workspaceId: true,
      _count: { select: { members: true } },
    },
  });

  if (!team) {
    return (
      <div className="mx-auto max-w-md p-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              This team link is no longer valid.
            </p>
            <Link
              href="/teams"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Browse teams
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If the user is already in the team, skip the join screen entirely.
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  if (existing) {
    redirect(`/teams/${teamId}`);
  }

  const inWorkspace = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: team.workspaceId },
    },
    select: { role: true },
  });

  const canJoin = !!inWorkspace && team.privacy !== "PRIVATE";

  return (
    <div className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#c9a84c]/10 text-[#c9a84c]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Join {team.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {team._count.members} member
                {team._count.members === 1 ? "" : "s"} ·{" "}
                {team.privacy.toLowerCase().replace("_", " ")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.description && (
            <p className="text-sm text-muted-foreground">{team.description}</p>
          )}

          {!inWorkspace && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You&apos;re not a member of this team&apos;s workspace. Ask the
              workspace owner to invite you first.
            </div>
          )}

          {inWorkspace && team.privacy === "PRIVATE" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This team is private. Ask a team Lead to invite you directly.
            </div>
          )}

          {canJoin && <JoinTeamButton teamId={teamId} />}

          <Link
            href={`/teams/${teamId}`}
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            View team page
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
