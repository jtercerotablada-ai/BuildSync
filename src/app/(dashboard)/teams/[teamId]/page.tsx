"use client";

/**
 * /teams/[teamId] — Pro team workspace.
 *
 * Rebuilt from a generic Asana-style overview into a real PM
 * workspace for an engineering firm. The page surfaces:
 *
 *   1. Hero header  — name + color band + privacy + KPI tiles (members,
 *                     active projects, open tasks, overdue, velocity).
 *   2. Tab strip    — Overview (this page), Members, Work, Messages,
 *                     Calendar (existing sub-routes).
 *   3. Members      — dense table with role, open / overdue tasks,
 *                     completed-last-30d, projects-active, capacity
 *                     bar, joined date, lead-only role + remove actions.
 *   4. Capacity matrix — members rows × projects columns with a heat
 *                        scale and column / row totals. The killer
 *                        feature for engineering staffing decisions.
 *   5. Projects     — PMI rows with %Comp / BAC / EAC / SPI / CPI / Float
 *                     / Health for every project the team owns.
 *   6. Objectives   — goal chips this team is accountable for.
 *
 * All data is pulled in three parallel calls — the team itself, its
 * workload digest, and the projects with task data — and rendered
 * client-side. Everything is wired to real endpoints; there are no
 * dead clicks.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  FolderKanban,
  LayoutGrid,
  MessageSquare,
  Calendar,
  Target,
  Loader2,
  Settings,
  UserPlus,
  Star,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Globe,
  Lock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CapacityMatrix,
  type MatrixMember,
  type MatrixProject,
} from "@/components/teams/capacity-matrix";
import {
  TeamMembersTable,
  type MemberRow,
} from "@/components/teams/team-members-table";
import {
  TeamProjectsPanel,
  type TeamProjectRow,
} from "@/components/teams/team-projects-panel";
import { InviteTeamModal, TeamSettingsModal } from "@/components/teams";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  privacy: "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";
  workspace?: { id: string; name: string };
  members: {
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  }[];
  objectives: {
    id: string;
    name: string;
    progress: number;
    status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED" | null;
  }[];
  _count: { projects: number; members: number };
}

interface WorkloadResponse {
  members: (MemberRow & { taskByProject: Record<string, number> })[];
  projects: MatrixProject[];
  summary: {
    totalMembers: number;
    totalProjects: number;
    totalOpenTasks: number;
    totalOverdueTasks: number;
    totalCompletedLast30Days: number;
    maxOpenPerMember: number;
  };
  projectIds: string[];
}

interface TeamProjectFull {
  id: string;
  name: string;
  color: string;
  projectNumber: string | null;
  status: string;
  gate: string | null;
  budget: number | string | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  members: { id: string; name: string | null; image: string | null }[];
}

export default function TeamWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const teamId = params.teamId as string;
  const currentUserId =
    (session?.user as { id?: string } | undefined)?.id || null;

  const [team, setTeam] = useState<Team | null>(null);
  const [workload, setWorkload] = useState<WorkloadResponse | null>(null);
  const [projectsFull, setProjectsFull] = useState<TeamProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [starred, setStarred] = useState(false);

  // ── Load everything in parallel ──────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [teamRes, wlRes, projRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/workload`),
        fetch(`/api/teams/${teamId}/projects`),
      ]);
      if (teamRes.ok) setTeam(await teamRes.json());
      if (wlRes.ok) setWorkload(await wlRes.json());
      if (projRes.ok) {
        const list: TeamProjectFull[] = await projRes.json();
        // We need budget + dates for PMI calc. /api/teams/[id]/projects
        // doesn't return budget/dates yet — fetch via /api/projects
        // and filter to this team's projects. Cheap because we already
        // have the IDs.
        const all = await fetch(`/api/projects`).then((r) =>
          r.ok ? r.json() : []
        );
        const allArr: TeamProjectFull[] = Array.isArray(all) ? all : [];
        const byId = new Map(allArr.map((p) => [p.id, p]));
        const rows: TeamProjectRow[] = list
          .map((p) => {
            const full = byId.get(p.id);
            if (!full) return null;
            return {
              id: p.id,
              name: p.name,
              color: p.color,
              projectNumber: full.projectNumber ?? null,
              status: full.status,
              gate: full.gate ?? null,
              budget: full.budget ?? null,
              currency: full.currency ?? null,
              startDate: full.startDate ?? null,
              endDate: full.endDate ?? null,
              owner: full.owner,
              tasks: (full as unknown as { tasks?: TeamProjectRow["tasks"] })
                .tasks ?? [],
              totalTaskCount:
                (full as unknown as { _count?: { tasks?: number } })._count
                  ?.tasks ?? 0,
            };
          })
          .filter((p): p is TeamProjectRow => p !== null);
        setProjectsFull(rows);
      }
    } catch (e) {
      console.error("Error loading team workspace:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Read starred state from localStorage (mirrors the goal-detail
  // pattern; no Following model yet).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teams.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      setStarred(list.includes(teamId));
    } catch {
      // ignore
    }
  }, [teamId]);

  function toggleStar() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teams.starred");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = list.includes(teamId)
        ? list.filter((id) => id !== teamId)
        : [...list, teamId];
      localStorage.setItem("teams.starred", JSON.stringify(next));
      setStarred(next.includes(teamId));
    } catch {
      toast.error("Couldn't update star");
    }
  }

  // ── Velocity heuristic: % of work closed in the last 30 days ────
  const velocityPct = useMemo(() => {
    if (!workload) return 0;
    const done = workload.summary.totalCompletedLast30Days;
    const total = done + workload.summary.totalOpenTasks;
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }, [workload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <h2 className="text-lg font-semibold">Team not found</h2>
        <Button onClick={() => router.push("/teams")}>Back to teams</Button>
      </div>
    );
  }

  const teamInitial = team.name.charAt(0).toUpperCase();
  const PrivacyIcon = team.privacy === "PRIVATE" ? Lock : Globe;

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* ── HERO HEADER ─────────────────────────────────────────────
          Flat light-gray band identical to the /team Overview pattern
          (and Asana's reference): a neutral 88px-tall strip with the
          team avatar straddling the band/content boundary. The
          per-team color used to drive a magenta-gradient hero here,
          which read as loud and didn't compose well with the KPI
          strip below it. The color still surfaces on KPI tiles,
          project cards, and capacity bars where it carries meaning. */}
      <div className="relative border-b">
        <div className="h-[72px] md:h-[88px] bg-gray-100" />
        <div className="px-4 md:px-6 -mt-6 md:-mt-8 pb-3 md:pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex items-end gap-3 md:gap-4 min-w-0">
            <div
              className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gray-300 ring-4 ring-white flex items-center justify-center flex-shrink-0"
            >
              <span className="text-2xl md:text-3xl font-light text-gray-600">
                {teamInitial}
              </span>
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                {team.workspace?.name || "Workspace"}
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <PrivacyIcon className="h-2.5 w-2.5" />
                  {team.privacy === "PRIVATE" ? "Private" : "Public"}
                </span>
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-black truncate">
                {team.name}
              </h1>
              {team.description && (
                <p className="text-xs md:text-sm text-gray-500 truncate max-w-[640px]">
                  {team.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", starred && "text-[#c9a84c]")}
              onClick={toggleStar}
              aria-label={starred ? "Unstar team" : "Star team"}
            >
              <Star className={cn("h-4 w-4", starred && "fill-current")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInvite(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite member
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* ── TAB STRIP (sub-routes existing) ─────────────────────── */}
      <div className="flex items-center gap-1 px-4 md:px-6 border-b overflow-x-auto bg-white">
        {[
          { id: "overview", label: "Overview", icon: LayoutGrid, href: `/teams/${teamId}` },
          { id: "members", label: "Members", icon: Users, href: `/teams/${teamId}/members` },
          { id: "work", label: "All work", icon: FolderKanban, href: `/teams/${teamId}/work` },
          { id: "messages", label: "Messages", icon: MessageSquare, href: `/teams/${teamId}/messages` },
          { id: "calendar", label: "Calendar", icon: Calendar, href: `/teams/${teamId}/calendar` },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = t.id === "overview";
          return (
            <Link
              key={t.id}
              href={t.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0",
                isActive
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-black"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* ── KPI STRIP ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-0 border-b bg-white">
        <KpiTile
          label="Members"
          value={String(team._count.members)}
          icon={Users}
        />
        <KpiTile
          label="Active projects"
          value={String(team._count.projects)}
          icon={Briefcase}
        />
        <KpiTile
          label="Open tasks"
          value={String(workload?.summary.totalOpenTasks ?? 0)}
          icon={FolderKanban}
        />
        <KpiTile
          label="Overdue"
          value={String(workload?.summary.totalOverdueTasks ?? 0)}
          icon={AlertTriangle}
          emphasize={(workload?.summary.totalOverdueTasks ?? 0) > 0}
        />
        <KpiTile
          label="Velocity 30d"
          value={`${velocityPct}%`}
          sub={`${workload?.summary.totalCompletedLast30Days ?? 0} closed`}
          icon={TrendingUp}
        />
      </div>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 py-4 md:py-6 space-y-6 md:space-y-8 max-w-[1600px]">
          {/* Members table */}
          <section>
            <SectionHeader
              title="Members"
              subtitle={`${team._count.members} on the team`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInvite(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Invite member
                </Button>
              }
            />
            <TeamMembersTable
              teamId={teamId}
              currentUserId={currentUserId}
              members={(workload?.members || []) as MemberRow[]}
              onChanged={fetchAll}
            />
          </section>

          {/* Capacity matrix */}
          <section>
            <SectionHeader
              title="Capacity matrix"
              subtitle="Open tasks per member × project. Heat color = relative load."
            />
            <CapacityMatrix
              members={(workload?.members || []) as MatrixMember[]}
              projects={(workload?.projects || []) as MatrixProject[]}
              maxOpenPerMember={workload?.summary.maxOpenPerMember ?? 1}
            />
          </section>

          {/* Team projects (PMI rows) */}
          <section>
            <SectionHeader
              title="Projects"
              subtitle={`${projectsFull.length} project${projectsFull.length === 1 ? "" : "s"} owned by this team`}
            />
            <TeamProjectsPanel projects={projectsFull} />
          </section>

          {/* Linked objectives */}
          <section>
            <SectionHeader
              title="Objectives"
              subtitle={`${team.objectives.length} goal${team.objectives.length === 1 ? "" : "s"} this team is accountable for`}
            />
            {team.objectives.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-center text-sm text-gray-500">
                No objectives assigned to this team yet.{" "}
                <Link
                  href="/goals"
                  className="text-black underline hover:no-underline"
                >
                  Open Goals
                </Link>{" "}
                to assign one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.objectives.map((o) => (
                  <Link
                    key={o.id}
                    href={`/goals/${o.id}`}
                    className="block border rounded-xl p-3 bg-white hover:border-gray-400 transition-colors"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Target className="h-3.5 w-3.5 text-[#c9a84c] mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium text-black truncate">
                        {o.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#c9a84c]"
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-gray-600 w-9 text-right">
                        {o.progress}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <InviteTeamModal
        teamId={teamId}
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInviteSent={fetchAll}
      />
      <TeamSettingsModal
        team={{
          id: team.id,
          name: team.name,
          description: team.description,
          privacy: team.privacy,
          workspace: team.workspace
            ? { name: team.workspace.name }
            : null,
        }}
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={fetchAll}
      />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-black">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-gray-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  emphasize = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  emphasize?: boolean;
}) {
  return (
    <div className="px-4 py-3 border-r last:border-r-0 border-gray-200 flex items-center gap-3">
      <div
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
          emphasize ? "bg-black text-[#c9a84c]" : "bg-gray-100 text-gray-500"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p
          className={cn(
            "text-lg md:text-xl font-mono tabular-nums leading-tight",
            emphasize ? "font-bold text-black" : "font-semibold text-black"
          )}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-gray-500 font-mono tabular-nums truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
