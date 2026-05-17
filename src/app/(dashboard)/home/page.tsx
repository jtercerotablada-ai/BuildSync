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
 * The chips ("X tasks completed", "Y collaborators") still consume
 * /api/dashboard/ceo because that's the cheapest way to compute them
 * portfolio-wide; everything else on this page is per-widget self-
 * fetching.
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
import { useUiState } from "@/hooks/use-ui-state";
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

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  // We keep this fetch only for the two summary chips in HomeHeader
  // ("X tasks completed" + "Y collaborators"). All widgets below
  // self-fetch.
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { value: period, setValue: setPeriod } = useUiState<HomePeriod>(
    PERIOD_UI_STATE_KEY,
    "week"
  );
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

  // ── Single fetch for the HomeHeader summary chips ────────────────
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
    switch (id) {
      case "my-tasks":
        return (
          <MyTasksWidget
            size={getWidgetSize("my-tasks")}
            onSizeChange={(s) => setWidgetSize("my-tasks", s)}
            onRemove={() => toggleWidget("my-tasks")}
          />
        );
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
        return (
          <AssignedTasksWidget
            onAssignTask={() => router.push("/my-tasks")}
          />
        );
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
                  // Six classic widgets render their own header / chrome
                  // (title, badges, tabs, etc.). Without hideHeader the
                  // user sees a "double header" — WidgetContainer's title
                  // stacked on top of the widget's internal title. Pass
                  // hideHeader for these so the container just provides
                  // the frame + ⋯ menu floating at the top-right.
                  hideHeader={widgetOwnsHeader(id)}
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
 * Widgets that render their own internal title + chrome (and would
 * therefore produce a "double header" if WidgetContainer also drew
 * one above them). Keep this list in sync with whichever widgets
 * use a `<h3>`/`<span className="font-semibold">` of their own at
 * the top of the body — typically the ones with custom tabs (tabs
 * + title) or built-in toolbars.
 */
function widgetOwnsHeader(id: WidgetType): boolean {
  return [
    "my-tasks",
    "people",
    "private-notepad",
    "forms",
    "mentions",
    "ai-assistant",
  ].includes(id);
}
