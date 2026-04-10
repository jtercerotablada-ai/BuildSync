'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { useWidgetPreferences } from '@/hooks/use-widget-preferences';
import { WidgetContainer, WidgetOverlay, WidgetMenuAction } from '@/components/dashboard/widget-container';
import { CustomizeWidgetsModal } from '@/components/dashboard/customize-widgets-modal';
import { Plus, Target, CheckSquare, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { CreateObjectiveDialog } from '@/components/goals/create-objective-dialog';
import { QuickCreateTaskModal } from '@/components/tasks/quick-create-task-modal';
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
} from '@/components/dashboard/widgets';
import { WidgetType } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomePage() {
  const { data: session } = useSession();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showQuickCreateTask, setShowQuickCreateTask] = useState(false);
  const [activeId, setActiveId] = useState<WidgetType | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [today, setToday] = useState('');

  useEffect(() => {
    // Defer state sets to the next microtask to avoid cascading renders lint rule
    const t = setTimeout(() => {
      setToday(getFormattedDate());
      setIsMobile(window.innerWidth < 768);
    }, 0);
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', check);
    };
  }, []);

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
      activationConstraint: {
        distance: 5, // Reduced for more responsive feel
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetType);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = preferences.widgetOrder.indexOf(active.id as WidgetType);
      const newIndex = preferences.widgetOrder.indexOf(over.id as WidgetType);
      const newOrder = arrayMove(preferences.widgetOrder, oldIndex, newIndex);
      reorderWidgets(newOrder);

      // Recalculate auto sizes after the drop animation settles
      setTimeout(() => {
        recalculateWidgetSizes();
      }, 300);
    }
  };

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  // Get menu actions for each widget type
  const getMenuActions = (widgetId: WidgetType): WidgetMenuAction[] => {
    switch (widgetId) {
      case 'projects':
        return [{
          label: 'New project',
          icon: <Plus className="h-4 w-4 mr-2" />,
          onClick: () => setShowCreateProject(true),
        }];
      case 'goals':
        return [{
          label: 'New goal',
          icon: <Target className="h-4 w-4 mr-2" />,
          onClick: () => setShowCreateGoal(true),
        }];
      default:
        return [];
    }
  };

  // Widget components map
  const renderWidget = (widgetId: WidgetType) => {
    switch (widgetId) {
      case 'my-tasks':
        return (
          <MyTasksWidget
            size={getWidgetSize('my-tasks')}
            onSizeChange={(size) => setWidgetSize('my-tasks', size)}
            onRemove={() => toggleWidget('my-tasks')}
          />
        );
      case 'projects':
        return <ProjectsWidget onCreateProject={() => setShowCreateProject(true)} />;
      case 'goals':
        return <GoalsWidget onCreateGoal={() => setShowCreateGoal(true)} />;
      case 'learning':
        return <LearningWidget />;
      case 'assigned-tasks':
        return <AssignedTasksWidget onAssignTask={() => setShowQuickCreateTask(true)} />;
      case 'people':
        return (
          <PeopleWidget
            size={getWidgetSize('people')}
            onSizeChange={(size) => setWidgetSize('people', size)}
            onRemove={() => toggleWidget('people')}
          />
        );
      case 'status-updates':
        return <StatusUpdatesWidget />;
      case 'portfolios':
        return <PortfoliosWidget />;
      case 'private-notepad':
        return (
          <PrivateNotepadWidget
            size={getWidgetSize('private-notepad')}
            onSizeChange={(size) => setWidgetSize('private-notepad', size)}
            onRemove={() => toggleWidget('private-notepad')}
          />
        );
      case 'draft-comments':
        return <DraftCommentsWidget />;
      case 'forms':
        return (
          <FormsWidget
            size={getWidgetSize('forms')}
            onSizeChange={(size) => setWidgetSize('forms', size)}
            onRemove={() => toggleWidget('forms')}
          />
        );
      case 'mentions':
        return (
          <MentionsWidget
            size={getWidgetSize('mentions')}
            onSizeChange={(size) => setWidgetSize('mentions', size)}
            onRemove={() => toggleWidget('mentions')}
          />
        );
      case 'ai-assistant':
        return (
          <AIAssistantWidget
            size={getWidgetSize('ai-assistant')}
            onSizeChange={(size) => setWidgetSize('ai-assistant', size)}
            onRemove={() => toggleWidget('ai-assistant')}
          />
        );
      default:
        return null;
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mt-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 md:mb-6 gap-2">
          <div className="min-w-0 flex-1">
            {today && (
              <p className="text-[11px] md:text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                {today}
              </p>
            )}
            <h1 className="text-xl md:text-3xl font-bold text-gray-900 truncate">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1">
              Here&apos;s what&apos;s happening with your projects
            </p>
          </div>
          <div className="flex-shrink-0">
            <CustomizeWidgetsModal
              preferences={preferences}
              onToggleWidget={toggleWidget}
              onReset={resetToDefaults}
            />
          </div>
        </div>

        {/* Quick action pills */}
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8 text-xs md:text-sm"
            onClick={() => setShowQuickCreateTask(true)}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-1" />
            New task
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8 text-xs md:text-sm"
            onClick={() => setShowCreateProject(true)}
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            New project
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8 text-xs md:text-sm"
            onClick={() => setShowCreateGoal(true)}
          >
            <Target className="h-3.5 w-3.5 mr-1" />
            New goal
          </Button>
        </div>

        {/* Widget Grid - 2 columns with square widgets */}
        {isMobile ? (
          /* Mobile: simple stack without drag-and-drop */
          <div className="grid grid-cols-1 gap-2.5">
            {(preferences.widgetOrder || []).map((widgetId) => {
              if (!(preferences.visibleWidgets || []).includes(widgetId)) return null;
              const widgetContent = renderWidget(widgetId);
              if (!widgetContent) return null;
              const hideHeader = widgetId === 'my-tasks' || widgetId === 'mentions' || widgetId === 'forms' || widgetId === 'people' || widgetId === 'private-notepad' || widgetId === 'ai-assistant';
              const widgetSize = getWidgetSize(widgetId);
              return (
                <WidgetContainer
                  key={widgetId}
                  id={widgetId}
                  onHide={toggleWidget}
                  size={widgetSize}
                  onSizeChange={!hideHeader ? (size) => setWidgetSize(widgetId, size) : undefined}
                  hideHeader={hideHeader}
                  menuActions={!hideHeader ? getMenuActions(widgetId) : undefined}
                >
                  {widgetContent}
                </WidgetContainer>
              );
            })}
          </div>
        ) : (
          /* Desktop: full DnD experience */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={preferences.widgetOrder || []}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-6">
                {(preferences.widgetOrder || []).map((widgetId) => {
                  if (!(preferences.visibleWidgets || []).includes(widgetId)) return null;
                  const widgetContent = renderWidget(widgetId);
                  if (!widgetContent) return null;
                  const hideHeader = widgetId === 'my-tasks' || widgetId === 'mentions' || widgetId === 'forms' || widgetId === 'people' || widgetId === 'private-notepad' || widgetId === 'ai-assistant';
                  const widgetSize = getWidgetSize(widgetId);
                  return (
                    <WidgetContainer
                      key={widgetId}
                      id={widgetId}
                      onHide={toggleWidget}
                      size={widgetSize}
                      onSizeChange={!hideHeader ? (size) => setWidgetSize(widgetId, size) : undefined}
                      hideHeader={hideHeader}
                      menuActions={!hideHeader ? getMenuActions(widgetId) : undefined}
                    >
                      {widgetContent}
                    </WidgetContainer>
                  );
                })}
              </div>
            </SortableContext>

            {/* Drag Overlay - Shows a preview of the dragged widget */}
            <DragOverlay adjustScale={false} dropAnimation={{
              duration: 250,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
              {activeId ? (
                <WidgetOverlay id={activeId} size="half" />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Empty state if no widgets */}
        {(preferences.visibleWidgets || []).length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg bg-white">
            <p className="text-gray-500 mb-4">No widgets visible. Add some to get started!</p>
            <CustomizeWidgetsModal
              preferences={preferences}
              onToggleWidget={toggleWidget}
              onReset={resetToDefaults}
            />
          </div>
        )}

        {/* Dialogs */}
        <CreateProjectDialog
          open={showCreateProject}
          onOpenChange={setShowCreateProject}
        />
        <CreateObjectiveDialog
          open={showCreateGoal}
          onOpenChange={setShowCreateGoal}
        />
        <QuickCreateTaskModal
          open={showQuickCreateTask}
          onOpenChange={setShowQuickCreateTask}
        />
      </div>
    </div>
  );
}
