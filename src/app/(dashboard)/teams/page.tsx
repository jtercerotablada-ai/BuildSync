"use client";

/**
 * /teams — All-teams listing for the dashboard route group.
 *
 * Like /projects, the dashboard had no /teams listing — only
 * /teams/[teamId]/* subroutes. Hitting the URL bar fell through to
 * the public marketing page. This restores the proper logged-in view.
 *
 * Two lists, from two endpoints, because they answer two questions:
 *
 *   /api/teams/list  — the teams I'm ON, across every workspace I belong
 *                      to. Membership is the whole scope.
 *   /api/teams       — every team in my workspace I'm ALLOWED to see:
 *                      PUBLIC, REQUEST_TO_JOIN, or one I'm already on.
 *                      Subtracting the first from the second is the set of
 *                      teams I could join, which this screen used to have
 *                      no way to show. Before it did, a PUBLIC team was
 *                      only reachable if somebody pasted you its URL.
 *
 * It is also where archived teams live. An archived team is hidden from
 * the default list but never deleted, so the Active/Archived toggle here
 * is the only thing standing between "archived" and "gone" — the same
 * shape the projects browser uses, deliberately.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { peekTeamInvite, consumeTeamInvite } from "@/lib/team-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Loader2,
  Search,
  Users,
  Target,
  FolderKanban,
  UserPlus,
  Archive,
} from "lucide-react";
import { teamJoinMode, teamPrivacyMeta } from "@/lib/team-privacy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Pill styling shared by the Active/Archived toggle, matching the projects
// browser so the two archive controls read as one control language.
const PILL_BASE =
  "inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-[13px] transition-colors";
const PILL_ON = "bg-black text-white border-black";
const PILL_OFF = "bg-white text-gray-700 border-gray-300 hover:border-gray-400";

type Scope = "active" | "archived";

/**
 * One card's worth of team, normalized from either endpoint — they select
 * different counts (`objectives` vs `projects`), so the page folds both
 * into this rather than teaching every card about two payload shapes.
 */
interface TeamCard {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  privacy: string;
  isArchived: boolean;
  memberCount: number;
  goalCount?: number;
  projectCount?: number;
}

interface ListPayload {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  privacy: string;
  // Optional on purpose: /api/teams/list selects its columns explicitly, so
  // an older deploy of that route simply omits the flag. Absent reads as
  // "not archived", which shows the team in the Active list — the direction
  // that loses nothing, rather than hiding a live team behind a toggle.
  isArchived?: boolean;
  _count?: { objectives?: number; members?: number; projects?: number };
}

function normalize(t: ListPayload): TeamCard {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    color: t.color ?? null,
    privacy: t.privacy,
    isArchived: t.isArchived === true,
    memberCount: t._count?.members ?? 0,
    goalCount: t._count?.objectives,
    projectCount: t._count?.projects,
  };
}

function PrivacyBadge({ privacy }: { privacy: string }) {
  const meta = teamPrivacyMeta(privacy);
  const Icon = meta.icon;
  return (
    <>
      <Icon className="h-3 w-3 text-gray-400 flex-shrink-0" />
      <span className="text-[10px] text-gray-500 uppercase tracking-wider truncate">
        {meta.label}
      </span>
    </>
  );
}

/** Muted marker so an archived team never reads as a live one. */
function ArchivedBadge() {
  return (
    <span className="flex-shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Archived
    </span>
  );
}

// useSearchParams must live under a Suspense boundary in Next 15, so the
// page body is a child component and the default export only wraps it.
export default function TeamsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <TeamsPageContent />
    </Suspense>
  );
}

function TeamsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myTeams, setMyTeams] = useState<TeamCard[]>([]);
  const [visibleTeams, setVisibleTeams] = useState<TeamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  // Scope stays plain useState, like the projects browser: the archive is
  // somewhere you go to retrieve one old team, never how you want to browse
  // tomorrow. ?scope=archived is the one exception — the banner on an
  // archived team's page links here to say where it went, and landing on
  // Active would open the one list guaranteed not to contain it.
  const [scope, setScope] = useState<Scope>(
    searchParams.get("scope") === "archived" ? "archived" : "active"
  );
  const [joiningId, setJoiningId] = useState<string | null>(null);
  // Requests sent during this visit. GET /requests is the lead's queue and
  // 403s for the requester, so there is nothing to read back; the endpoint
  // upserts, so asking again after a reload is a no-op, not a duplicate.
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const load = useCallback(() => {
    let canceled = false;
    setLoading(true);
    setLoadError(false);
    // `archived=all` is the ONE value that returns active AND archived rows:
    // teamArchiveWhere() fails closed, so any other value — including a
    // parameter it doesn't recognise — answers with active teams only. Both
    // lists need both scopes, because the Active/Archived toggle below splits
    // them client-side; asking for less makes the Archived tab permanently
    // empty and an archived team unreachable from every screen.
    // Discovery is fetched alongside and is allowed to fail on its own:
    // losing "teams you can join" must not blank out the teams you're on.
    Promise.all([
      fetch("/api/teams/list?archived=all").then((r) => {
        // A 401/500 used to be parsed as JSON and coerced to [], which
        // rendered the "No teams yet" empty state and invited the user to
        // re-create teams that already exist.
        if (!r.ok) throw new Error("Failed to load teams");
        return r.json();
      }),
      fetch("/api/teams?archived=all")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([mine, visible]) => {
        if (canceled) return;
        if (!Array.isArray(mine)) throw new Error("Unexpected response");
        const mineCards = (mine as ListPayload[]).map(normalize);
        const visibleCards = (
          Array.isArray(visible) ? (visible as ListPayload[]) : []
        ).map(normalize);
        setMyTeams(mineCards);
        setVisibleTeams(visibleCards);

        // "Invite teammate" entry point (Home People widget + header menu)
        // routes here with a pending invite intent. Forward to the actual
        // team's overview, which consumes the intent and auto-opens the
        // invite dialog; if there are no teams yet, drop the intent and send
        // them to create one first. An archived team is never the landing
        // spot — it can't take new members.
        if (peekTeamInvite()) {
          const target = mineCards.find((t) => !t.isArchived);
          if (target) {
            router.replace(`/teams/${target.id}`);
          } else {
            consumeTeamInvite();
            router.replace("/teams/new");
          }
        }
      })
      .catch(() => {
        if (canceled) return;
        setMyTeams([]);
        setVisibleTeams([]);
        setLoadError(true);
      })
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [router]);

  useEffect(() => load(), [load, reloadKey]);

  const term = search.trim().toLowerCase();
  const matches = useCallback(
    (t: TeamCard) => (term ? t.name.toLowerCase().includes(term) : true),
    [term]
  );

  // `/api/teams/list` is the authority on membership; anything in the
  // workspace listing that isn't in it is a team the user could join.
  const myIds = useMemo(() => new Set(myTeams.map((t) => t.id)), [myTeams]);

  // The workspace listing carries isArchived even where the membership
  // listing doesn't, so fold the flag across before splitting by scope.
  const inScope = useMemo(() => {
    const archivedElsewhere = new Set(
      visibleTeams.filter((t) => t.isArchived).map((t) => t.id)
    );
    return myTeams
      .map((t) =>
        t.isArchived || !archivedElsewhere.has(t.id)
          ? t
          : { ...t, isArchived: true }
      )
      .filter((t) => t.isArchived === (scope === "archived"));
  }, [myTeams, visibleTeams, scope]);

  const filtered = useMemo(() => inScope.filter(matches), [inScope, matches]);

  // Archived teams are never offered for joining: both /join and /requests
  // refuse them, so a button here would only produce a toast.
  const joinable = useMemo(
    () =>
      visibleTeams.filter(
        (t) =>
          !myIds.has(t.id) &&
          !t.isArchived &&
          teamJoinMode(t.privacy) !== "INVITE_ONLY"
      ),
    [visibleTeams, myIds]
  );
  const joinableFiltered = useMemo(
    () => joinable.filter(matches),
    [joinable, matches]
  );
  const showDiscovery = scope === "active" && joinableFiltered.length > 0;

  /**
   * Join, or ask to. PUBLIC self-joins through /join; REQUEST_TO_JOIN opens
   * a PENDING row through /requests for a lead to approve. /join answers 409
   * with `requiresRequest` when the team's privacy changed under us since
   * the list was fetched, so that answer is followed rather than shown to
   * the user as a failure.
   */
  async function handleJoin(team: TeamCard) {
    setJoiningId(team.id);
    try {
      if (teamJoinMode(team.privacy) === "INSTANT") {
        const res = await fetch(`/api/teams/${team.id}/join`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success(`You joined ${team.name}`);
          setReloadKey((k) => k + 1);
          return;
        }
        if (!data?.requiresRequest) {
          throw new Error(data?.error || "Couldn't join this team");
        }
      }
      const res = await fetch(`/api/teams/${team.id}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't send your request");
      setRequestedIds((prev) => [...prev, team.id]);
      toast.success("Request sent — a team lead will review it");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join this team");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-semibold text-black">Teams</h1>
          <span className="text-xs text-gray-500 tabular-nums">
            ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Archive scope. Until this existed, archiving a team dropped it
              out of every list in the app with no way back to it. */}
          <div className="flex items-center gap-1">
            {(
              [
                { id: "active" as Scope, label: "Active" },
                { id: "archived" as Scope, label: "Archived" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setScope(opt.id)}
                aria-pressed={scope === opt.id}
                className={cn(PILL_BASE, scope === opt.id ? PILL_ON : PILL_OFF)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search teams…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-full sm:w-64"
            />
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/teams/new")}
            className="bg-black hover:bg-gray-900 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New team
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md rounded-2xl border p-10 text-center">
              <p className="mb-4 text-sm text-gray-600">
                Couldn&apos;t load your teams.
              </p>
              <Button
                variant="outline"
                onClick={() => setReloadKey((k) => k + 1)}
                className="gap-1.5"
              >
                <Loader2 className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 && !showDiscovery ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
              {scope === "archived" ? (
                <Archive className="h-8 w-8 text-black" />
              ) : (
                <Users className="h-8 w-8 text-black" />
              )}
            </div>
            {/* "This scope is empty" and "the search hid everything" are
                different answers; saying the first for the second sends the
                reader away from an archive that isn't actually empty. */}
            <h3 className="text-lg font-medium text-black mb-2">
              {inScope.length > 0
                ? "No teams match your search"
                : scope === "archived"
                  ? "No archived teams"
                  : "No teams yet"}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm text-center mb-4">
              {inScope.length > 0
                ? "Try a different search term."
                : scope === "archived"
                  ? "Teams you archive are kept here instead of deleted."
                  : "Group people around a goal or a project type — Design, 40-year Recertification, Broward BSIP — for shared workload and OKRs."}
            </p>
            {inScope.length === 0 && scope === "active" && (
              <Button
                onClick={() => router.push("/teams/new")}
                className="bg-black hover:bg-gray-900 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create first team
              </Button>
            )}
          </div>
        ) : (
          <div className="p-4 md:p-6 space-y-8">
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {filtered.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="group block border rounded-xl p-4 bg-white hover:border-gray-400 hover:shadow-sm transition-all"
                  >
                    <TeamCardBody team={t} />
                  </Link>
                ))}
              </div>
            )}

            {/* ── Teams you can join ──────────────────────────────
                The other half of discovery: /teams used to list only the
                teams you were already on, so a PUBLIC team was invisible
                to everyone who wasn't in it. */}
            {showDiscovery && (
              <div>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-black">
                    Teams you can join
                  </h2>
                  <span className="text-xs text-gray-500 tabular-nums">
                    ({joinableFiltered.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {joinableFiltered.map((t) => {
                    const mode = teamJoinMode(t.privacy);
                    const asked = requestedIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        className="border rounded-xl p-4 bg-white flex flex-col"
                      >
                        <Link
                          href={`/teams/${t.id}`}
                          className="group block flex-1"
                        >
                          <TeamCardBody team={t} />
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          disabled={joiningId === t.id || asked}
                          onClick={() => handleJoin(t)}
                        >
                          {joiningId === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {asked
                            ? "Request sent"
                            : mode === "INSTANT"
                              ? "Join team"
                              : "Request to join"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The identity + counts block, shared by the two grids so a team looks the
 * same whether you're on it or considering joining it.
 */
function TeamCardBody({ team }: { team: TeamCard }) {
  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: team.color || "#c9a84c" }}
        >
          <Users className="h-5 w-5 text-white/90" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-black truncate group-hover:underline">
              {team.name}
            </p>
            {team.isArchived && <ArchivedBadge />}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <PrivacyBadge privacy={team.privacy} />
          </div>
        </div>
      </div>

      {team.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {team.description}
        </p>
      )}

      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
        </span>
        {team.goalCount !== undefined ? (
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {team.goalCount} goal{team.goalCount === 1 ? "" : "s"}
          </span>
        ) : team.projectCount !== undefined ? (
          <span className="flex items-center gap-1">
            <FolderKanban className="h-3 w-3" />
            {team.projectCount} project{team.projectCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    </>
  );
}
