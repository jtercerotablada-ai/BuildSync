"use client";

/**
 * /teams — All-teams listing for the dashboard route group.
 *
 * Like /projects, the dashboard had no /teams listing — only
 * /teams/[teamId]/* subroutes. Hitting the URL bar fell through to
 * the public marketing page. This restores the proper logged-in view.
 *
 * Reads from /api/teams/list which already returns teams scoped to
 * the user's workspace + membership.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { peekTeamInvite, consumeTeamInvite } from "@/lib/team-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Loader2,
  Search,
  Users,
  Target,
  Lock,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  privacy: "PUBLIC" | "PRIVATE";
  _count: {
    objectives: number;
    members: number;
  };
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setLoadError(false);
    fetch("/api/teams/list")
      .then((r) => {
        // A 401/500 used to be parsed as JSON and coerced to [], which
        // rendered the "No teams yet" empty state and invited the user to
        // re-create teams that already exist.
        if (!r.ok) throw new Error("Failed to load teams");
        return r.json();
      })
      .then((data) => {
        if (canceled) return;
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        const list = data as Team[];
        setTeams(list);
        // "Invite teammate" entry point (Home People widget + header menu)
        // routes here with a pending invite intent. Forward to the actual
        // team's overview, which consumes the intent and auto-opens the
        // invite dialog; if there are no teams yet, drop the intent and send
        // them to create one first.
        if (peekTeamInvite()) {
          if (list.length > 0) {
            router.replace(`/teams/${list[0].id}`);
          } else {
            consumeTeamInvite();
            router.replace("/teams/new");
          }
        }
      })
      .catch(() => {
        if (canceled) return;
        setTeams([]);
        setLoadError(true);
      })
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [router, reloadKey]);

  const filtered = teams.filter((t) =>
    search.trim()
      ? t.name.toLowerCase().includes(search.trim().toLowerCase())
      : true
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-semibold text-black">
            Teams
          </h1>
          <span className="text-xs text-gray-500 tabular-nums">
            ({filtered.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="w-16 h-16 bg-white border border-black rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-black" />
            </div>
            <h3 className="text-lg font-medium text-black mb-2">
              {teams.length === 0
                ? "No teams yet"
                : "No teams match your search"}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm text-center mb-4">
              {teams.length === 0
                ? "Group people around a goal or a project type — Design, Construction, FISP — for shared workload and OKRs."
                : "Try a different search term."}
            </p>
            {teams.length === 0 && (
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
          <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.id}`}
                className="group block border rounded-xl p-4 bg-white hover:border-gray-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: t.color || "#c9a84c" }}
                  >
                    <Users className="h-5 w-5 text-white/90" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black truncate group-hover:underline">
                      {t.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {t.privacy === "PRIVATE" ? (
                        <Lock className="h-3 w-3 text-gray-400" />
                      ) : (
                        <Globe className="h-3 w-3 text-gray-400" />
                      )}
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {t.privacy === "PRIVATE" ? "Private" : "Public"}
                      </span>
                    </div>
                  </div>
                </div>

                {t.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {t.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {t._count.members} member{t._count.members === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {t._count.objectives} goal
                    {t._count.objectives === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
