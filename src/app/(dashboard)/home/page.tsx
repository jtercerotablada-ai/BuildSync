"use client";

/**
 * /home — Asana-style drag-drop widget grid with PMI-grade tiles.
 *
 * Combines two things Juan asked for explicitly:
 *
 *   1. The classic Asana behavior — cards that he can drag to reorder,
 *      resize (half / full row), hide via a per-tile menu, and
 *      pick from a Customize modal. Layout persists per user
 *      via `useWidgetPreferences` (DB-backed).
 *
 *   2. PMI-grade content inside each tile — AI Brief, Priority queue
 *      (overdue + due-today), Active projects with SPI/health/gate,
 *      Team capacity bars, Upcoming milestones (14d), Recertification
 *      radar (120d), Goals snapshot, Recent activity. No generic
 *      productivity tool surfaces this content; it's why a PMP /
 *      structural firm CEO opens this dashboard daily.
 *
 * The header (greeting + period selector + personal KPI strip) sits
 * fixed above the grid so it doesn't shuffle when the user reorders
 * tiles. The Customize button opens the existing CustomizeWidgetsModal
 * (showing classic Asana widgets like My Tasks / Mentions / Notepad
 * as opt-in additions).
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import { useWidgetPreferences } from "@/hooks/use-widget-preferences";
import {
  WidgetContainer,
  WidgetOverlay,
} from "@/components/dashboard/widget-container";
import { CustomizeWidgetsModal } from "@/components/dashboard/customize-widgets-modal";
import type { WidgetType } from "@/types/dashboard";
import type { CockpitData } from "@/components/cockpit/types";

import {
  HomeHeader,
  type HomePeriod,
} from "@/components/home/home-header";
import { HomeAIBrief } from "@/components/home/home-ai-brief";
import { HomePriorityQueue } from "@/components/home/home-priority-queue";
import { HomeActiveProjects } from "@/components/home/home-active-projects";
import { HomeTeamCapacity } from "@/components/home/home-team-capacity";
import { HomeRecertRadar } from "@/components/home/home-recert-radar";
import { HomeUpcomingMilestones } from "@/components/home/home-upcoming-milestones";
import { HomeGoalsSnapshot } from "@/components/home/home-goals-snapshot";
import { HomeRecentActivity } from "@/components/home/home-recent-activity";
import { HomePortfolioSkyline } from "@/components/home/home-portfolio-skyline";

// Classic widget fallbacks (rendered when the user has opted into
// one of the legacy Asana-style widgets via Customize).
import {
  MyTasksWidget,
  ProjectsWidget,
  GoalsWidget,
  AssignedTasksWidget,
  PeopleWidget,
  StatusUpdatesWidget,
  PortfoliosWidget,
  PrivateNotepadWidget,
  DraftCommentsWidget,
  FormsWidget,
  MentionsWidget,
  LearningWidget,
  AIAssistantWidget,
} from "@/components/dashboard/widgets";

const PERIOD_STORAGE_KEY = "home.period";

export default function HomePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<HomePeriod>("week");
  const [activeId, setActiveId] = useState<WidgetType | null>(null);

  // ── Widget layout persistence (DB-backed) ────────────────────────
  const {
    preferences,
    isLoaded,
    toggleWidget,
    reorderWidgets,
    recalculateWidgetSizes,
    resetToDefaults,
    setWidgetSize,
    getWidgetSize,
  } = useWidgetPreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── Period selector persistence ─────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY) as HomePeriod | null;
    if (
      stored &&
      ["today", "week", "next14", "lookahead3w", "quarter"].includes(stored)
    ) {
      setPeriod(stored);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PERIOD_STORAGE_KEY, period);
  }, [period]);

  // ── Single fetch of CockpitData (shared across all PMI tiles) ───
  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/dashboard/ceo", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CockpitData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as WidgetType);
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = preferences.widgetOrder.indexOf(
        active.id as WidgetType
      );
      const newIndex = preferences.widgetOrder.indexOf(over.id as WidgetType);
      const newOrder = arrayMove(preferences.widgetOrder, oldIndex, newIndex);
      reorderWidgets(newOrder);
      setTimeout(() => recalculateWidgetSizes(), 300);
    }
  }

  // ── Header summary chips (Asana-style) ──────────────────────────
  const summary = useMemo(() => {
    if (!data) return { tasksCompleted: 0, collaborators: 0 };
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const tasksCompleted = data.activity.filter(
      (a) => a.completedAt && new Date(a.completedAt) >= weekAgo
    ).length;
    return { tasksCompleted, collaborators: data.team.length };
  }, [data]);

  // ── Render a single widget by id ────────────────────────────────
  function renderWidgetBody(id: WidgetType) {
    if (!data && isPmiWidget(id)) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      );
    }
    switch (id) {
      // ── PMI tiles — render directly. WidgetContainer in "naked"
      //    mode (hideHeader=true) has no inner padding, so the tile's
      //    own card frame fills the grid cell cleanly. The floating
      //    ⋯ menu sits absolute at top-right via WidgetContainer.
      case "ai-brief":
        return data ? <HomeAIBrief data={data} /> : null;
      case "priority-queue":
        return data ? (
          <HomePriorityQueue criticalTasks={data.criticalPath} />
        ) : null;
      case "active-projects-pmi":
        return data ? <HomeActiveProjects projects={data.projects} /> : null;
      case "team-capacity":
        return data ? <HomeTeamCapacity members={data.team} /> : null;
      case "upcoming-milestones":
        return data ? (
          <HomeUpcomingMilestones tasks={data.criticalPath} />
        ) : null;
      case "recert-radar":
        return data ? <HomeRecertRadar projects={data.projects} /> : null;
      case "goals-snapshot-pmi":
        return <HomeGoalsSnapshot />;
      case "recent-activity":
        return data ? <HomeRecentActivity items={data.activity} /> : null;

      // ── Classic widgets (opt-in) ──
      case "my-tasks":
        return (
          <MyTasksWidget
            size={getWidgetSize("my-tasks")}
            onSizeChange={(s) => setWidgetSize("my-tasks", s)}
            onRemove={() => toggleWidget("my-tasks")}
          />
        );
      case "projects":
        return <ProjectsWidget onCreateProject={() => {}} />;
      case "goals":
        return <GoalsWidget onCreateGoal={() => {}} />;
      case "assigned-tasks":
        return <AssignedTasksWidget onAssignTask={() => {}} />;
      case "people":
        return (
          <PeopleWidget
            size={getWidgetSize("people")}
            onSizeChange={(s) => setWidgetSize("people", s)}
            onRemove={() => toggleWidget("people")}
          />
        );
      case "status-updates":
        return <StatusUpdatesWidget />;
      case "portfolios":
        return <PortfoliosWidget />;
      case "private-notepad":
        return (
          <PrivateNotepadWidget
            size={getWidgetSize("private-notepad")}
            onSizeChange={(s) => setWidgetSize("private-notepad", s)}
            onRemove={() => toggleWidget("private-notepad")}
          />
        );
      case "draft-comments":
        return <DraftCommentsWidget />;
      case "forms":
        return (
          <FormsWidget
            size={getWidgetSize("forms")}
            onSizeChange={(s) => setWidgetSize("forms", s)}
            onRemove={() => toggleWidget("forms")}
          />
        );
      case "mentions":
        return (
          <MentionsWidget
            size={getWidgetSize("mentions")}
            onSizeChange={(s) => setWidgetSize("mentions", s)}
            onRemove={() => toggleWidget("mentions")}
          />
        );
      case "learning":
        return <LearningWidget />;
      case "ai-assistant":
        return (
          <AIAssistantWidget
            size={getWidgetSize("ai-assistant")}
            onSizeChange={(s) => setWidgetSize("ai-assistant", s)}
            onRemove={() => toggleWidget("ai-assistant")}
          />
        );
      default:
        return null;
    }
  }

  // ── Loading state ───────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center px-6">
        <h2 className="text-lg font-semibold text-black">
          Couldn&rsquo;t load home
        </h2>
        <p className="text-sm text-gray-500 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-auto">
      <HomeHeader
        userName={session?.user?.name}
        period={period}
        onPeriodChange={setPeriod}
        tasksCompleted={summary.tasksCompleted}
        collaboratorsCount={summary.collaborators}
      />

      {/* Signature visual — every project as a vertical bar in a
          city skyline. Height = % complete, color = health. On-brand
          for a structural firm; no other PM tool ships this view. */}
      {data && <HomePortfolioSkyline projects={data.projects} />}

      {/* Customize bar — the modal renders its own trigger button */}
      <div className="px-4 md:px-6 pt-4 flex items-center justify-end">
        <CustomizeWidgetsModal
          preferences={preferences}
          onToggleWidget={toggleWidget}
          onReset={resetToDefaults}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={preferences.widgetOrder.filter((w) =>
            preferences.visibleWidgets.includes(w)
          )}
          strategy={rectSortingStrategy}
        >
          <div className="px-4 md:px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 auto-rows-[360px] pb-12">
            {preferences.widgetOrder
              .filter((w) => preferences.visibleWidgets.includes(w))
              .map((id) => (
                <WidgetContainer
                  key={id}
                  id={id}
                  size={getWidgetSize(id)}
                  onSizeChange={(s) => setWidgetSize(id, s)}
                  onHide={() => toggleWidget(id)}
                  hideHeader={isPmiWidget(id)}
                >
                  {renderWidgetBody(id)}
                </WidgetContainer>
              ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <WidgetOverlay id={activeId} size={getWidgetSize(activeId)} />
          ) : null}
        </DragOverlay>
      </DndContext>

    </div>
  );
}

/**
 * The PMI widgets bring their own internal header + border, so the
 * WidgetContainer should be rendered with `hideHeader={true}` for
 * them. The classic Asana widgets expect WidgetContainer to render
 * their header (title from AVAILABLE_WIDGETS config + 3-dot menu).
 */
function isPmiWidget(id: WidgetType): boolean {
  return [
    "ai-brief",
    "priority-queue",
    "active-projects-pmi",
    "team-capacity",
    "upcoming-milestones",
    "recert-radar",
    "goals-snapshot-pmi",
    "recent-activity",
  ].includes(id);
}
