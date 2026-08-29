import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { JoinTeamButton } from "@/components/teams/join-team-button";
import { TeamJoinRequest } from "@/components/teams/team-join-request";
import { teamPrivacyMeta } from "@/lib/team-privacy";

/**
 * Team invite landing page — /teams/:teamId/join.
 *
 * Reached via the "Copy invite link" flow in InviteTeamModal.
 *
 * ── The leak this page used to be ──────────────────────────────────
 * It loaded the team by id with NO authorization and printed its name,
 * description, member count and privacy label, and only THEN rendered a
 * "you're not in this workspace" warning underneath that disclosure. Any
 * authenticated user of any workspace who held a team id — a guessed
 * cuid, a forwarded link, a stale bookmark — read a PRIVATE team's name
 * and description. Same disclosure teamVisibilityClause() closed once
 * already for /api/search (see the comment at project-visibility.ts:70).
 *
 * The rule now: nothing about a team is rendered until the viewer is
 * known to belong to its workspace, and a PRIVATE team the viewer isn't
 * on renders exactly what a non-existent team renders — one neutral card,
 * so the two cases can't be told apart.
 */

/** The single answer for "you may not know anything about this id". */
function UnavailableCard() {
  return (
    <div className="mx-auto max-w-md p-8">
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            This team link isn&apos;t available.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            It may have been removed, or it isn&apos;t shared with your
            account.
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
      isArchived: true,
      workspaceId: true,
      _count: { select: { members: true } },
    },
  });

  if (!team) return <UnavailableCard />;

  // Gate 1 — workspace. Nothing above this line is rendered.
  const inWorkspace = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: team.workspaceId },
    },
    select: { role: true },
  });
  if (!inWorkspace) return <UnavailableCard />;

  // If the user is already in the team, skip the join screen entirely.
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  if (existing) {
    redirect(`/teams/${teamId}`);
  }

  // Gate 2 — a PRIVATE team discloses nothing to a non-member, not even
  // that it exists. Telling them "ask a Lead to invite you" was itself
  // the disclosure: it confirmed the id, the team and its privacy.
  if (team.privacy === "PRIVATE") return <UnavailableCard />;

  const byRequest = team.privacy === "REQUEST_TO_JOIN";

  // The requester's own row — so a pending ask shows as pending instead of
  // as a button that invites them to send a second one.
  const myRequest = byRequest
    ? await prisma.teamJoinRequest.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { status: true, message: true, createdAt: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#c9a84c]/10 text-[#c9a84c]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {byRequest ? "Request to join" : "Join"} {team.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {team._count.members} member
                {team._count.members === 1 ? "" : "s"} ·{" "}
                {teamPrivacyMeta(team.privacy).label}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.description && (
            <p className="text-sm text-muted-foreground">{team.description}</p>
          )}

          {team.isArchived ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This team is archived and isn&apos;t taking new members.
            </div>
          ) : byRequest ? (
            <TeamJoinRequest
              teamId={teamId}
              existing={
                myRequest
                  ? {
                      status: myRequest.status,
                      message: myRequest.message,
                      createdAt: myRequest.createdAt.toISOString(),
                    }
                  : null
              }
            />
          ) : (
            <JoinTeamButton teamId={teamId} />
          )}

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
