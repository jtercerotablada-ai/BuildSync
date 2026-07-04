'use client';

/**
 * StatusUpdatesWidget — "Project Status" tile on the home dashboard.
 *
 * Replaces the old chronological feed-of-posts. The old design had
 * one row per status update POST, which hid the projects that
 * weren't posting (the exact ones a PM needs to be reminded about).
 *
 * New design (one row per ACTIVE project):
 *   - Status pill dot + project name
 *   - Last update snippet OR a red "Never updated · Post first update" CTA
 *   - "X days ago" badge — turns red when >= 14 days (stale)
 *   - Click anywhere on the row → opens project Overview tab with
 *     ?compose=status so the post composer auto-opens
 *   - Header "Post update" button → project picker dropdown → same route
 *
 * Backend: /api/projects/status-overview (per-project rollup, not
 * a post feed). See that endpoint for the sort order (never-updated
 * first, then stale, then off-track, etc.).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ArrowRight,
  AlertCircle,
  Loader2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ProjectStatus =
  | 'ON_TRACK'
  | 'AT_RISK'
  | 'OFF_TRACK'
  | 'ON_HOLD'
  | 'COMPLETE';

interface ProjectStatusRow {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  status: ProjectStatus;
  gate: string | null;
  lastUpdate: {
    id: string;
    status: ProjectStatus;
    summary: string;
    createdAt: string;
    author: { name: string; image: string | null } | null;
  } | null;
  daysSinceUpdate: number | null;
}

interface ProjectListItem {
  id: string;
  name: string;
  color?: string;
}

// Status pill visuals — matches ProjectOverview.STATUS_VISUAL so the
// widget and the project page read as one product.
const STATUS_DOT: Record<ProjectStatus, { color: string; label: string }> = {
  ON_TRACK: { color: '#c9a84c', label: 'On track' },
  AT_RISK: { color: '#a8893a', label: 'At risk' },
  OFF_TRACK: { color: '#000000', label: 'Off track' },
  ON_HOLD: { color: '#64748b', label: 'On hold' },
  COMPLETE: { color: '#c9a84c', label: 'Complete' },
};

function formatRelative(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return `${Math.floor(days / 7)} week ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
}

// Calendar-day difference between two dates in the user's local zone.
// The server's daysSinceUpdate counts elapsed 24h blocks, so a post
// from late yesterday reads "today" this morning; comparing startOfDay
// deltas gives the label the calendar boundary users expect.
function calendarDaysAgo(iso: string): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  const startOfThen = new Date(
    then.getFullYear(),
    then.getMonth(),
    then.getDate(),
  );
  const now = new Date();
  const startOfNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const diff = Math.round(
    (startOfNow.getTime() - startOfThen.getTime()) / 86400000,
  );
  return Math.max(0, diff);
}

export function StatusUpdatesWidget() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectStatusRow[]>([]);
  // null = not fetched yet (picker never opened / fetch in flight).
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectsError, setProjectsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/projects/status-overview?limit=8');
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ProjectStatusRow[];
          setRows(Array.isArray(data) ? data : []);
        } else {
          setError('Failed to load project status');
        }
      } catch (err) {
        console.error('Failed to fetch status overview:', err);
        if (!cancelled) setError('Failed to load project status');
      } finally {
        if (showSpinner && !cancelled) setLoading(false);
      }
    };

    void load(true);

    // Refresh every 60s while visible — status changes slowly so
    // we don't need /my-tasks' 30s cadence; once a minute is enough
    // to catch a teammate's update without burning network.
    const tick = () => {
      if (document.hidden) return;
      void load(false);
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 60000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshKey]);

  // The rollup is scoped to one workspace server-side; scope the
  // picker to the SAME workspace so a multi-workspace user can't
  // post to a project the widget list will never show.
  const workspaceId = rows[0]?.workspaceId ?? null;

  // Lazy-load projects only when the user opens the "Post update"
  // picker — most home loads never need this list. fields=summary
  // keeps the payload to id/name/color-ish rows instead of the
  // fully-hydrated owner/members/tasks shape.
  useEffect(() => {
    if (!pickerOpen || projects !== null || projectsError) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ fields: 'summary' });
        if (workspaceId) params.set('workspaceId', workspaceId);
        const res = await fetch(`/api/projects?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ProjectListItem[];
          setProjects(Array.isArray(data) ? data : []);
        } else {
          setProjectsError(true);
        }
      } catch {
        if (!cancelled) setProjectsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, projects, projectsError, workspaceId]);

  function openProjectStatus(projectId: string, compose = false) {
    const qs = compose ? '?view=overview&compose=status' : '?view=overview';
    router.push(`/projects/${projectId}${qs}`);
  }

  // ── Error state — shown instead of the empty state so a fetch
  // failure never reads as "you have no projects". ───────────────
  if (!loading && error && rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-2">
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────
  if (!loading && rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-[280px] px-2">
          <div className="relative w-12 h-14 mx-auto mb-3 border-2 border-gray-300 rounded-sm">
            <div className="mt-3 mx-2 space-y-1.5">
              <div className="h-1 bg-gray-200 rounded" />
              <div className="h-1 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a84c] rounded-full" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            Keep your projects visible
          </p>
          <p className="text-xs text-gray-500 mb-3 leading-snug">
            Post a weekly status (On track / At risk / Off track) so
            every project stays in sight — even the ones nobody is
            talking about this week.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push('/projects')}
          >
            Go to projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Loading state — show shimmer rows so the layout doesn't jump.
          h-20 ≈ a real row (p-3 + title + summary line + meta line),
          so the swap to live rows doesn't reflow the tile. */}
      {loading ? (
        <div className="space-y-1.5 flex-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto -mx-1">
            <ul className="space-y-1.5 px-1">
              {rows.map((row) => {
                const dot = STATUS_DOT[row.status];
                const isStale =
                  row.daysSinceUpdate != null && row.daysSinceUpdate >= 14;
                const neverUpdated = row.daysSinceUpdate == null;

                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openProjectStatus(row.id, neverUpdated)}
                      className={cn(
                        'w-full p-3 rounded-lg text-left transition-colors border',
                        neverUpdated
                          ? 'border-[#a8893a]/40 bg-[#fdf7e8]/40 hover:bg-[#fdf7e8]/70'
                          : isStale
                            ? 'border-[#a8893a]/30 bg-amber-50/40 hover:bg-amber-50/70'
                            : 'border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Status dot — current project status (the same
                            pill the project header shows). */}
                        <span
                          className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dot.color }}
                          title={dot.label}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {row.name}
                            </p>
                            <span
                              className={cn(
                                'text-[10px] font-medium uppercase tracking-wide flex-shrink-0',
                                neverUpdated || isStale
                                  ? 'text-[#a8893a]'
                                  : 'text-gray-700'
                              )}
                            >
                              {dot.label}
                            </span>
                          </div>

                          {neverUpdated ? (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#a8893a] font-medium">
                              <AlertCircle className="w-3 h-3" />
                              Never updated — post first status
                            </div>
                          ) : (
                            <>
                              <p className="text-[12px] text-gray-600 line-clamp-2 mt-0.5">
                                {row.lastUpdate?.summary}
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-[11px]">
                                <Clock
                                  className={cn(
                                    'w-3 h-3 flex-shrink-0',
                                    isStale ? 'text-[#a8893a]' : 'text-gray-400'
                                  )}
                                />
                                <span
                                  className={cn(
                                    'min-w-0 truncate',
                                    isStale
                                      ? 'text-[#a8893a] font-medium'
                                      : 'text-gray-500'
                                  )}
                                >
                                  Updated{' '}
                                  {formatRelative(
                                    row.lastUpdate
                                      ? calendarDaysAgo(row.lastUpdate.createdAt)
                                      : row.daysSinceUpdate!
                                  )}
                                  {row.lastUpdate?.author?.name &&
                                    ` by ${row.lastUpdate.author.name}`}
                                </span>
                                {isStale && (
                                  <span className="ml-auto flex-shrink-0 text-[10px] uppercase tracking-wider text-[#a8893a] font-semibold">
                                    Stale
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* "+ Post update" footer button — opens project picker so
              the user can post WITHOUT navigating to the project
              first. Same picker pattern as the Forms widget. */}
          <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
            <DropdownMenuTrigger asChild>
              <button className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                <Plus className="h-4 w-4" />
                Post status update
                <ChevronDown className="h-3.5 w-3.5 ml-auto" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-64 overflow-y-auto"
            >
              {projectsError ? (
                <div className="px-2 py-3 text-xs text-center">
                  <p className="text-red-600 mb-1.5">
                    Failed to load projects
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setProjectsError(false)}
                  >
                    Retry
                  </Button>
                </div>
              ) : projects === null ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto mb-1" />
                  Loading projects…
                </div>
              ) : projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  No projects yet
                </div>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b">
                    Post update for…
                  </div>
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => openProjectStatus(p.id, true)}
                      className="cursor-pointer"
                    >
                      <span
                        className="h-3 w-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: p.color || '#c9a84c' }}
                      />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
