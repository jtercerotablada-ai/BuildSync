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
 * /api/dashboard/ceo?slim=1, which skips the heavy cockpit pipeline
 * and returns just the two counts; everything else on this page is
 * per-widget self-fetching.
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
import { Loader2, Plus, Eye } from "lucide-react";
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
import type { CockpitData } from "@/components/cockpit/types";
import { startOfLocalDay } from "@/lib/date-only";
import {
  getHomeBackground,
  HOME_BACKGROUND_UI_STATE_KEY,
  type HomeBackgroundId,
} from "@/lib/home-background";

import {
  HomeHeader,
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

// /api/dashboard/ceo now also returns explicit header-chip counts.
// Typed locally (optional) so older cached payloads without it don't
// crash the UI right after a deploy.
type HomeCockpitData = CockpitData & {
  summary?: { tasksCompleted: number; teamCount: number };
};

// Maps the header period to the PAST window the "tasks completed"
// chip counts over. next14/lookahead3w are forward-looking planning
// windows where a completed-count is meaningless, so they fall back
// to the last 7 days (same as "week").
function periodStartFor(period: HomePeriod): Date {
  const now = new Date();
  switch (period) {
    case "today":
      return startOfLocalDay();
    case "quarter":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case "week":
    case "next14":
    case "lookahead3w":
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  // We keep this fetch only for the two summary chips in HomeHeader
  // ("X tasks completed" + "Y collaborators"). All widgets below
  // self-fetch.
  const [data, setData] = useState<HomeCockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The Gmail-compose-style task composer is mounted ONCE at the
  // DashboardShell level; CTAs here open it via openQuickCreateTask()
  // so Home never stacks a second pixel-identical composer over it.
  const { value: period, setValue: setPeriod } = useUiState<HomePeriod>(
    PERIOD_UI_STATE_KEY,
    "week"
  );
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
          `/api/dashboard/ceo?slim=1&periodStart=${encodeURIComponent(periodStart)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HomeCockpitData;
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
      collaborators: data.summary?.teamCount ?? data.team.length,
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
          strategy={staticGridSortingStrategy}
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
                  menuActions={getWidgetMenuActions(id)}
                  titleHref={getWidgetTitleHref(id)}
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

// `widgetOwnsHeader` was removed — none of the widgets in the home
// grid actually own complete self-chrome (border + background +
// header). Passing hideHeader=true to widgets that only had a bare
// <h3>Title</h3> left them floating without a card frame (Juan
// caught People + Mentions looking broken). The container now
// provides the chrome uniformly; each widget removed its duplicate
// internal title row in this same commit.
