"use client";

/**
 * /home — Asana-style drag-drop widget grid.
 *
 * Behaviors kept from the original Asana paradigm:
 *   - Cards can be reordered by drag, resized to half/full row, hidden
 *     via the per-tile menu, and added/removed from the Customize modal.
 *   - Layout persists per user via `useWidgetPreferences` (DB-backed).
 *
 * The earlier PMI/EVM "10x upgrade" tiles (AI Brief, Priority Queue,
 * Active Projects, Team Capacity, Upcoming Milestones, Recertification
 * Radar, Goals Snapshot, Recent Activity) were removed at the product
 * owner's request — too much duplicated info versus the classic
 * widgets and not enough signal vs noise. The Portfolio Skyline
 * visualization went with them.
 *
 * The header (greeting + period selector + two summary chips) stays.
 * The chips ("X tasks completed", "Y collaborators") consume
 * /api/dashboard/ceo, which returns just those two counts; everything
 * else on this page is per-widget self-fetching.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { openCreateProjectGallery } from "@/lib/open-create-project";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Plus, Eye, LayoutGrid } from "lucide-react";
import { useWidgetPreferences } from "@/hooks/use-widget-preferences";
import { useUiState } from "@/hooks/use-ui-state";
import {
  WidgetContainer,
  WidgetOverlay,
  type WidgetMenuAction,
} from "@/components/dashboard/widget-container";
import { CustomizeWidgetsModal } from "@/components/dashboard/customize-widgets-modal";
import { openQuickCreateTask } from "@/components/layout/dashboard-shell";
import type { WidgetType } from "@/types/dashboard";
import { startOfLocalDay } from "@/lib/date-only";
import {
  getHomeBackground,
  HOME_BACKGROUND_UI_STATE_KEY,
  type HomeBackgroundId,
} from "@/lib/home-background";

import {
  HomeHeader,
  normalizeHomePeriod,
  type HomePeriod,
} from "@/components/home/home-header";

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

// Per-user period preference, stored on UserPreferences.uiState in
// the DB so it follows the user across devices instead of dying in
// localStorage. Default "week" matches the original behavior.
const PERIOD_UI_STATE_KEY = "home.period";

// rectSortingStrategy assumes uniform item sizes, but widgets span 1
// or 2 grid columns, so its mid-drag previews promised slots the real
// CSS grid reflow never produced (visible jump on drop). A null
// strategy keeps neighbors static while dragging — the DragOverlay
// plus the isOver ring on the hovered card communicate the drop — and
// the grid settles once, on the card the user actually pointed at.
const staticGridSortingStrategy: SortingStrategy = () => null;

// The header-chip counts from /api/dashboard/ceo. Optional so a
// response without them renders 0 instead of crashing.
type HomeSummaryData = {
  summary?: { tasksCompleted: number; teamCount: number };
};

// Maps the header period to the window the "tasks completed" chip
// counts over. Every window is a calendar one in the viewer's own
// time zone — "This week" starts on Monday 00:00, not 7 days ago.
//
// The clock read below is the safe kind: this is only ever called from the
// fetch effect, so it runs on the browser, with the browser's day. It must
// NOT be moved into the render — the server renders in UTC, and from 20:00
// in Miami "today" there is already tomorrow, which would ask the API for a
// window that has not started yet.
function periodStartFor(period: HomePeriod): Date {
  const now = new Date();
  switch (period) {
    case "today":
      return startOfLocalDay(now);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case "week":
    default: {
      const today = startOfLocalDay(now);
      // getDay(): Sunday = 0. Days since Monday: Mon 0 … Sun 6.
      const sinceMonday = (today.getDay() + 6) % 7;
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - sinceMonday
      );
    }
  }
}

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  // We keep this fetch only for the two summary chips in HomeHeader
  // ("X tasks completed" + "Y collaborators"). All widgets below
  // self-fetch.
  const [data, setData] = useState<HomeSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The Gmail-compose-style task composer is mounted ONCE at the
  // DashboardShell level; CTAs here open it via openQuickCreateTask()
  // so Home never stacks a second pixel-identical composer over it.
  const { value: storedPeriod, setValue: setPeriod } = useUiState<HomePeriod>(
    PERIOD_UI_STATE_KEY,
    "week"
  );
  // A saved "next14"/"lookahead3w" from before those options were retired
  // reads as the default instead of a period nothing understands.
  const period = normalizeHomePeriod(storedPeriod);
  const { value: backgroundId, setValue: setBackgroundId } =
    useUiState<HomeBackgroundId>(HOME_BACKGROUND_UI_STATE_KEY, "default");
  const background = getHomeBackground(backgroundId);
  const [activeId, setActiveId] = useState<WidgetType | null>(null);

  // ── Widget layout persistence (DB-backed) ────────────────────────
  const {
    preferences,
    isLoaded,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    setWidgetSize,
    getWidgetSize,
  } = useWidgetPreferences();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    // The drag handles use touch-action:manipulation so touch scrolling
    // stays native; a long-press (TouchSensor delay) is the only way a
    // finger can start a drag without the browser stealing the gesture.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── Fetch for the HomeHeader summary chips ───────────────────────
  // Refetches when the period changes; data is reset to null first so
  // the chips show their skeleton instead of the previous period's
  // numbers.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const periodStart = periodStartFor(period).toISOString();
        const res = await fetch(
          `/api/dashboard/ceo?periodStart=${encodeURIComponent(periodStart)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HomeSummaryData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

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
    }
  }

  // ── Header summary chips (Asana-style) ──────────────────────────
  // Tri-state per chip: number → render, null → loading (skeleton in
  // HomeHeader), undefined → fetch failed (chips hidden; the rest of
  // the page is unaffected — every widget self-fetches).
  const chips = useMemo(() => {
    if (error) return { tasksCompleted: undefined, collaborators: undefined };
    if (!data) return { tasksCompleted: null, collaborators: null };
    return {
      tasksCompleted: data.summary?.tasksCompleted ?? 0,
      collaborators: data.summary?.teamCount ?? 0,
    };
  }, [data, error]);

  // ── Per-widget title link target ─────────────────────────────────
  // Asana makes the widget heading itself a link to the full page
  // (clicking "Mis tareas" → /my-tasks, "Metas" → /goals, etc.).
  // We mirror that for the widgets whose data has a full-page view.
  function getWidgetTitleHref(id: WidgetType): string | undefined {
    if (id === "my-tasks") return "/my-tasks";
    if (id === "goals") return "/goals";
    if (id === "portfolios") return "/portfolios";
    if (id === "projects") return "/projects/all";
    if (id === "people") return "/people";
    // forms: no titleHref — there is no dashboard-side forms page yet,
    // and /portal/admin/forms ejects MEMBER users to the marketing site.
    return undefined;
  }

  // ── Per-widget custom actions for the WidgetContainer ⋯ menu ─────
  // Mirrors Asana's per-widget Acciones (e.g. "+ Create task" /
  // "View all my tasks" on the My tasks widget) — these sit above
  // the shared "Half size / Full size / Remove widget" block.
  function getWidgetMenuActions(id: WidgetType): WidgetMenuAction[] | undefined {
    if (id === "my-tasks") {
      return [
        {
          label: "Create task",
          icon: <Plus className="h-4 w-4 mr-2" />,
          onClick: () => openQuickCreateTask(),
        },
        {
          label: "View all my tasks",
          icon: <Eye className="h-4 w-4 mr-2" />,
          onClick: () => router.push("/my-tasks"),
        },
      ];
    }
    if (id === "assigned-tasks") {
      return [
        {
          label: "Assign task",
          icon: <Plus className="h-4 w-4 mr-2" />,
          onClick: () => openQuickCreateTask(),
        },
      ];
    }
    if (id === "goals") {
      return [
        {
          label: "View all goals",
          icon: <Eye className="h-4 w-4 mr-2" />,
          onClick: () => router.push("/goals"),
        },
      ];
    }
    if (id === "portfolios") {
      return [
        {
          label: "View all portfolios",
          icon: <Eye className="h-4 w-4 mr-2" />,
          onClick: () => router.push("/portfolios"),
        },
      ];
    }
    return undefined;
  }

  // ── Render a single widget by id ────────────────────────────────
  function renderWidgetBody(id: WidgetType) {
    switch (id) {
      case "my-tasks":
        return <MyTasksWidget />;
      case "projects":
        // Opens the template gallery (Asana-style) via a custom-event
        // so the modal lives at the layout root, not inside this widget.
        return (
          <ProjectsWidget
            onCreateProject={() => openCreateProjectGallery()}
          />
        );
      case "goals":
        return (
          <GoalsWidget onCreateGoal={() => router.push("/goals?new=1")} />
        );
      case "assigned-tasks":
        // Opens the Gmail-compose-style task composer pinned to the
        // bottom-right (the shell's single instance). Replaces the
        // previous router.push("/my-tasks") bounce — users wanted to
        // actually assign here, not navigate.
        return (
          <AssignedTasksWidget onAssignTask={() => openQuickCreateTask()} />
        );
      case "people":
        return <PeopleWidget />;
      case "status-updates":
        return <StatusUpdatesWidget />;
      case "portfolios":
        return <PortfoliosWidget />;
      case "private-notepad":
        return <PrivateNotepadWidget />;
      case "draft-comments":
        return <DraftCommentsWidget />;
      case "forms":
        return <FormsWidget />;
      case "mentions":
        return <MentionsWidget />;
      case "learning":
        return <LearningWidget />;
      case "ai-assistant":
        return <AIAssistantWidget />;
      default:
        return null;
    }
  }

  // ── Loading state ───────────────────────────────────────────────
  // Carry the saved background tint here too — useUiState hydrates it
  // from cache before widget prefs finish loading, so applying it on
  // the spinner branch avoids a white flash on every Home mount for
  // users who have a tint set.
  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center h-[60vh]"
        style={{ backgroundColor: background.bg ?? undefined }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  // A chips-fetch failure must never blank the page: the fetch only
  // feeds the two header chips, and every widget below self-fetches.
  // On error the chips are simply hidden (see the `chips` memo).

  const visibleOrder = preferences.widgetOrder.filter((w) =>
    preferences.visibleWidgets.includes(w)
  );

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-auto transition-colors duration-300"
      style={{ backgroundColor: background.bg ?? undefined }}
    >
      <HomeHeader
        userName={session?.user?.name}
        period={period}
        onPeriodChange={setPeriod}
        tasksCompleted={chips.tasksCompleted}
        collaboratorsCount={chips.collaborators}
        actions={
          <CustomizeWidgetsModal
            preferences={preferences}
            onToggleWidget={toggleWidget}
            onReset={resetToDefaults}
            backgroundId={backgroundId}
            onBackgroundChange={setBackgroundId}
          />
        }
      />

      {/* A fixed id: dnd-kit otherwise numbers its aria-describedby ids from
          a module counter that differs between the server render and the
          browser, which is a hydration mismatch React never repairs. */}
      <DndContext
        id="home-widget-grid"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleOrder}
          strategy={staticGridSortingStrategy}
        >
          {visibleOrder.length === 0 ? (
            // Every widget removed: say so and offer the way back, instead
            // of a header over an empty page.
            <div className="px-4 md:px-6 py-4 pb-12">
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-white/70 px-6 py-16 text-center">
                <LayoutGrid className="h-6 w-6 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Your Home has no widgets. Add some back to get started.
                </p>
                <CustomizeWidgetsModal
                  preferences={preferences}
                  onToggleWidget={toggleWidget}
                  onReset={resetToDefaults}
                  backgroundId={backgroundId}
                  onBackgroundChange={setBackgroundId}
                />
              </div>
            </div>
          ) : (
            <div className="px-4 md:px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 auto-rows-[360px] pb-12">
              {visibleOrder.map((id) => (
                <WidgetContainer
                  key={id}
                  id={id}
                  size={getWidgetSize(id)}
                  onSizeChange={(s) => setWidgetSize(id, s)}
                  onHide={() => toggleWidget(id)}
                  menuActions={getWidgetMenuActions(id)}
                  titleHref={getWidgetTitleHref(id)}
                >
                  {renderWidgetBody(id)}
                </WidgetContainer>
              ))}
            </div>
          )}
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

// `widgetOwnsHeader` was removed — none of the widgets in the home
// grid actually own complete self-chrome (border + background +
// header). Passing hideHeader=true to widgets that only had a bare
// <h3>Title</h3> left them floating without a card frame (Juan
// caught People + Mentions looking broken). The container now
// provides the chrome uniformly; each widget removed its duplicate
// internal title row in this same commit.
