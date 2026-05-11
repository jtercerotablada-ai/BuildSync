"use client";

/**
 * GanttTimeline — a polished timeline view for engineering projects.
 *
 * Why this beats Asana / Linear / Monday for our use case:
 *   - The bar fill is gradient-rendered by project GATE so a Construction
 *     project mid-Design shows a gold prefix and gray suffix. That's the
 *     core of structural project management — phase is more important
 *     than just start-end dates.
 *   - "Today" is a dashed vertical line drawn across the whole grid so
 *     you can spot any project running long at a glance.
 *   - Three zoom levels (Quarter / Month / Week) with sticky lane labels.
 *   - Overdue projects (endDate < today, status != COMPLETED) glow in
 *     gold-on-black trim so they pull the eye immediately.
 *   - Pure CSS grid + a few absolutely-positioned bars — no virtualization
 *     library, no dependency on @nivo / vis-timeline / dhtmlx.
 *
 * Layout:
 *   ┌─────────────┬───────────── timeline header (months/weeks/quarters) ───────┐
 *   │ Name  Owner │ ─────────── today ──────────                                │
 *   ├─────────────┼─────────────────────────────────────────────────────────────┤
 *   │  Project A  │            [▰▰▰▰▱▱▱▱]                                       │
 *   │  Project B  │    [▰▰▰▰▰▰▰▰▱▱]                                             │
 *   │  Project C  │                  [▰▰▰▰▰▰▰▰▰▰]                               │
 *   └─────────────┴─────────────────────────────────────────────────────────────┘
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MapPin, Diamond } from "lucide-react";
import { computePmiSnapshot, formatIndex } from "@/lib/pmi-metrics";

type ProjectType =
  | "CONSTRUCTION"
  | "DESIGN"
  | "RECERTIFICATION"
  | "PERMIT";

type ProjectGate =
  | "PRE_DESIGN"
  | "DESIGN"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "CLOSEOUT";

type ProjectStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETED";

interface GanttProject {
  id: string;
  name: string;
  color: string;
  type: ProjectType | null;
  gate: ProjectGate | null;
  status: ProjectStatus;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  budget?: number | string | null;
  currency?: string | null;
  projectNumber: string | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  tasks?: {
    id: string;
    completed: boolean;
    taskType?: string | null;
    dueDate?: string | null;
  }[];
  _count: { tasks: number; sections: number };
}

type ZoomLevel = "week" | "month" | "quarter";

const GATE_LABEL: Record<ProjectGate, string> = {
  PRE_DESIGN: "Pre-design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

const GATE_ORDER: ProjectGate[] = [
  "PRE_DESIGN",
  "DESIGN",
  "PERMITTING",
  "CONSTRUCTION",
  "CLOSEOUT",
];

// Gate colors — every gate gets a distinct shade on the monochrome+gold
// palette. Pre-design is light, Closeout is dark. Construction is the
// most saturated gold because that's where the most $ is moving.
const GATE_COLOR: Record<ProjectGate, string> = {
  PRE_DESIGN: "#e8d99a",
  DESIGN: "#d4b870",
  PERMITTING: "#a8893a",
  CONSTRUCTION: "#c9a84c",
  CLOSEOUT: "#666666",
};

/**
 * Pixels per day, by zoom level. Keep these multiples-of-7 so weekly
 * gridlines line up exactly with day positions.
 */
const DAY_PX: Record<ZoomLevel, number> = {
  week: 28, // ~28 days fit in 800px → ~1 month
  month: 6, // ~180 days in 1080px → ~6 months
  quarter: 2, // ~540 days in 1080px → ~18 months
};

export function GanttTimeline({
  projects,
}: {
  projects: GanttProject[];
}) {
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [centerDate, setCenterDate] = useState<Date>(() => new Date());
  const [groupBy, setGroupBy] = useState<"none" | "type" | "gate" | "owner">(
    "none"
  );

  // Only project rows that have BOTH start and end dates make it into
  // the gantt. The rest get a "Missing dates" empty-state panel below.
  const dated = projects.filter((p) => p.startDate && p.endDate);
  const undated = projects.filter((p) => !p.startDate || !p.endDate);

  // Compute the visible date window. The window centers on `centerDate`
  // and spans enough days to fill ~80% of the viewport. We round to
  // month boundaries so the header always shows complete months.
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const dayPx = DAY_PX[zoom];
    // Aim for ~1080 px of timeline width.
    const visibleDays = Math.ceil(1080 / dayPx);
    const half = Math.floor(visibleDays / 2);

    const start = new Date(centerDate);
    start.setDate(start.getDate() - half);
    start.setDate(1); // snap to first of month

    const end = new Date(start);
    end.setDate(end.getDate() + visibleDays + 60); // buffer right edge

    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ),
    };
  }, [centerDate, zoom]);

  const dayPx = DAY_PX[zoom];
  const timelineWidth = totalDays * dayPx;

  // Header — list of month boundaries within the visible window.
  const monthMarkers = useMemo(() => {
    const markers: { date: Date; left: number; label: string }[] = [];
    const cursor = new Date(rangeStart);
    cursor.setDate(1);
    while (cursor < rangeEnd) {
      const daysFromStart = Math.floor(
        (cursor.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      markers.push({
        date: new Date(cursor),
        left: daysFromStart * dayPx,
        label: cursor.toLocaleDateString("en-US", {
          month: "short",
          year:
            cursor.getMonth() === 0 || markers.length === 0
              ? "numeric"
              : undefined,
        }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return markers;
  }, [rangeStart, rangeEnd, dayPx]);

  // Today line — only render if "now" is in the visible window.
  const todayLeft = useMemo(() => {
    const now = new Date();
    if (now < rangeStart || now > rangeEnd) return null;
    const daysFromStart = Math.floor(
      (now.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysFromStart * dayPx;
  }, [rangeStart, rangeEnd, dayPx]);

  // Group projects into lanes per the active groupBy.
  const groupedRows = useMemo(() => {
    if (groupBy === "none") return [{ label: "", projects: dated }];

    const groups = new Map<string, GanttProject[]>();
    for (const p of dated) {
      let key = "";
      if (groupBy === "type") key = p.type || "Unspecified";
      else if (groupBy === "gate") key = p.gate || "Unspecified";
      else if (groupBy === "owner") key = p.owner?.name || "Unassigned";
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([label, projects]) => ({
      label: humanizeGroupLabel(label, groupBy),
      projects,
    }));
  }, [dated, groupBy]);

  function shift(days: number) {
    const next = new Date(centerDate);
    next.setDate(next.getDate() + days);
    setCenterDate(next);
  }

  const shiftAmountByZoom: Record<ZoomLevel, number> = {
    week: 14,
    month: 60,
    quarter: 180,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls strip */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-2 border-b bg-white sticky top-0 z-20">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => shift(-shiftAmountByZoom[zoom])}
            aria-label="Pan left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs font-medium"
            onClick={() => setCenterDate(new Date())}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => shift(shiftAmountByZoom[zoom])}
            aria-label="Pan right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {(["week", "month", "quarter"] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                "px-2.5 py-1 text-[11px] uppercase tracking-wider font-medium rounded transition-colors",
                zoom === z
                  ? "bg-black text-white"
                  : "text-gray-500 hover:text-black hover:bg-gray-100"
              )}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
            Group
          </span>
          {(
            [
              { id: "none", label: "Flat" },
              { id: "type", label: "Type" },
              { id: "gate", label: "Gate" },
              { id: "owner", label: "Owner" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setGroupBy(opt.id)}
              className={cn(
                "px-2 py-1 text-[11px] rounded-full border transition-colors",
                groupBy === opt.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500 tabular-nums">
          <span>{dated.length} projects on timeline</span>
          {undated.length > 0 && (
            <span className="text-gray-400">· {undated.length} missing dates</span>
          )}
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: 320 + timelineWidth }}>
          {/* Left fixed pane — project labels */}
          <div className="w-[280px] md:w-[320px] flex-shrink-0 border-r bg-white sticky left-0 z-10">
            {/* Header spacer to align with timeline header */}
            <div className="h-[52px] border-b" />

            {groupedRows.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b">
                    {group.label}
                    <span className="ml-1 text-gray-400/70">
                      ({group.projects.length})
                    </span>
                  </div>
                )}
                {group.projects.map((p) => (
                  <LaneLabel key={p.id} project={p} />
                ))}
              </div>
            ))}
          </div>

          {/* Right scrolling pane — the actual gantt grid */}
          <div className="relative flex-1" style={{ width: timelineWidth }}>
            {/* Timeline header (months) */}
            <div className="h-[52px] relative border-b sticky top-0 bg-white z-10">
              <div className="absolute inset-x-0 top-0 h-6 flex items-center text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {monthMarkers.map((m, i) => (
                  <div
                    key={i}
                    className="absolute border-l border-gray-100 h-full pl-1.5 pr-2 flex items-center"
                    style={{ left: m.left }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-0 bottom-0 h-6 flex items-center">
                {/* Quarter brackets */}
                {monthMarkers
                  .filter((m) => [0, 3, 6, 9].includes(m.date.getMonth()))
                  .map((m, i) => (
                    <div
                      key={i}
                      className="absolute text-[9px] font-semibold text-gray-400 uppercase tracking-wider px-1.5"
                      style={{ left: m.left + 4 }}
                    >
                      Q{Math.floor(m.date.getMonth() / 3) + 1}
                    </div>
                  ))}
              </div>
            </div>

            {/* Gridlines (vertical, one per month) */}
            <div className="absolute inset-x-0 top-[52px] bottom-0 pointer-events-none">
              {monthMarkers.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-gray-100"
                  style={{ left: m.left }}
                />
              ))}
            </div>

            {/* Today line */}
            {todayLeft !== null && (
              <div
                className="absolute top-0 bottom-0 w-0 pointer-events-none z-10"
                style={{ left: todayLeft }}
              >
                <div className="absolute inset-y-0 left-0 border-l border-dashed border-[#c9a84c]" />
                <div className="absolute top-1 left-1 text-[9px] font-semibold text-[#c9a84c] uppercase tracking-wider bg-white/90 px-1 rounded">
                  Today
                </div>
              </div>
            )}

            {/* Project bars */}
            {groupedRows.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <div className="h-7 bg-gray-50 border-b" />
                )}
                {group.projects.map((p) => (
                  <GanttBar
                    key={p.id}
                    project={p}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    dayPx={dayPx}
                  />
                ))}
              </div>
            ))}

            {dated.length === 0 && (
              <div className="absolute inset-0 top-[52px] flex flex-col items-center justify-center text-gray-400 text-sm gap-1">
                <p>No projects with start + end dates yet.</p>
                <p className="text-xs">
                  Add dates to a project to see it on the timeline.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Undated projects footer */}
        {undated.length > 0 && (
          <div className="border-t bg-gray-50 px-4 md:px-6 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Missing dates ({undated.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {undated.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 border rounded-md text-xs hover:bg-white"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate max-w-[200px]">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LaneLabel({ project }: { project: GanttProject }) {
  const taskList = project.tasks || [];
  const totalTasks = project._count.tasks ?? taskList.length;
  const completedTasks = taskList.filter((t) => t.completed).length;
  const pmi = computePmiSnapshot({
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget ?? null,
    status: project.status,
    taskCount: totalTasks,
    completedTaskCount: completedTasks,
  });
  const isOverdue =
    pmi.floatDays !== null && pmi.floatDays < 0 && project.status !== "COMPLETED";

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-b h-12 hover:bg-gray-50 transition-colors group",
        isOverdue && "ring-1 ring-inset ring-[#c9a84c]/30 bg-[#c9a84c]/5"
      )}
    >
      <div
        className="w-1.5 h-7 rounded-sm flex-shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black truncate group-hover:underline">
          {project.name}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 truncate font-mono">
          {project.projectNumber && (
            <span className="font-medium tabular-nums">
              {project.projectNumber}
            </span>
          )}
          {/* SPI / CPI inline badges — give the lane label PMI weight */}
          {pmi.spi > 0 && (
            <span
              className={cn(
                "tabular-nums",
                pmi.spi < 0.85 ? "text-black font-semibold" : "text-gray-500"
              )}
              title={`Schedule Performance Index: ${pmi.spi.toFixed(2)}`}
            >
              SPI {formatIndex(pmi.spi)}
            </span>
          )}
        </div>
      </div>
      {project.owner && (
        <Avatar className="h-5 w-5 flex-shrink-0">
          <AvatarImage src={project.owner.image || undefined} />
          <AvatarFallback className="bg-[#c9a84c] text-white text-[9px]">
            {(project.owner.name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </Link>
  );
}

function GanttBar({
  project,
  rangeStart,
  rangeEnd,
  dayPx,
}: {
  project: GanttProject;
  rangeStart: Date;
  rangeEnd: Date;
  dayPx: number;
}) {
  const start = new Date(project.startDate!);
  const end = new Date(project.endDate!);
  // Clamp to visible window so a bar that extends beyond the visible
  // range gets its edge rendered at the timeline edge (rather than off-
  // screen with no visual feedback).
  const visibleStart = start < rangeStart ? rangeStart : start;
  const visibleEnd = end > rangeEnd ? rangeEnd : end;

  if (visibleEnd < visibleStart) {
    // entirely outside window
    return <div className="h-12 border-b" />;
  }

  const left =
    Math.floor(
      (visibleStart.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    ) * dayPx;
  const width =
    Math.max(
      1,
      Math.ceil(
        (visibleEnd.getTime() - visibleStart.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    ) * dayPx;

  // Compute the gate progress ratio — what % of the bar is already
  // past based on the project's current gate. Gates are equally
  // weighted segments along the bar; "Closeout" = 100%.
  const gateIdx = project.gate ? GATE_ORDER.indexOf(project.gate) : -1;
  const gateRatio = gateIdx >= 0 ? (gateIdx + 1) / GATE_ORDER.length : 0;
  const gateColor = project.gate ? GATE_COLOR[project.gate] : project.color;

  const isOverdue =
    new Date(project.endDate!) < new Date() &&
    project.status !== "COMPLETED";

  // Time progress ratio — what % of the project window has elapsed.
  // Shown as a darker "actual" fill stripe inside the bar.
  const now = new Date();
  let timeRatio = 0;
  if (now >= start && now <= end) {
    timeRatio =
      (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  } else if (now > end) timeRatio = 1;

  // Milestones — tasks marked taskType=MILESTONE plotted as diamonds
  // along the bar at their due date. Standard PMBOK Gantt convention.
  const milestones = (project.tasks || [])
    .filter((t) => t.taskType === "MILESTONE" && t.dueDate)
    .map((t) => {
      const d = new Date(t.dueDate!);
      if (d < rangeStart || d > rangeEnd) return null;
      const days = Math.floor(
        (d.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { id: t.id, completed: t.completed, left: days * dayPx };
    })
    .filter((m): m is { id: string; completed: boolean; left: number } => m !== null);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="relative block h-12 border-b hover:bg-gray-50 transition-colors group"
    >
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-6 rounded-md border overflow-hidden shadow-sm",
          isOverdue
            ? "border-[#c9a84c] ring-1 ring-[#c9a84c]/40"
            : "border-gray-300"
        )}
        style={{ left, width, backgroundColor: "#f5f5f5" }}
        title={`${project.name} — ${start.toLocaleDateString()} → ${end.toLocaleDateString()}${project.gate ? " · " + GATE_LABEL[project.gate] : ""}`}
      >
        {/* Gate fill (gradient from start to current gate position) */}
        <div
          className="absolute inset-y-0 left-0 transition-all"
          style={{
            width: `${gateRatio * 100}%`,
            backgroundColor: gateColor,
            opacity: 0.85,
          }}
        />
        {/* Time elapsed indicator — thin stripe over the gate fill */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-black/80"
          style={{ width: `${timeRatio * 100}%` }}
        />
        {/* Label overlay — only when there's enough room */}
        {width > 80 && (
          <div className="relative h-full flex items-center px-2 z-10">
            <span
              className={cn(
                "text-[10px] font-semibold truncate",
                gateRatio > 0.3 ? "text-white" : "text-gray-700"
              )}
            >
              {project.gate ? GATE_LABEL[project.gate] : "—"}
            </span>
          </div>
        )}
      </div>
      {/* Milestone diamonds on top of the bar. Standard Primavera/MS
          Project convention — closed black diamond when complete,
          gold-outlined when pending. */}
      {milestones.map((m) => (
        <div
          key={m.id}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
          style={{ left: m.left }}
        >
          <Diamond
            className={cn(
              "h-3.5 w-3.5 drop-shadow",
              m.completed ? "fill-black text-black" : "text-[#c9a84c]"
            )}
            fill={m.completed ? "currentColor" : "#ffffff"}
          />
        </div>
      ))}
    </Link>
  );
}

function humanizeGroupLabel(
  raw: string,
  groupBy: "type" | "gate" | "owner" | "none"
): string {
  if (groupBy === "type") {
    const map: Record<string, string> = {
      CONSTRUCTION: "Construction",
      DESIGN: "Design",
      RECERTIFICATION: "Recertification",
      PERMIT: "Permit",
    };
    return map[raw] || raw;
  }
  if (groupBy === "gate") {
    return (GATE_LABEL as Record<string, string>)[raw] || raw;
  }
  return raw;
}
