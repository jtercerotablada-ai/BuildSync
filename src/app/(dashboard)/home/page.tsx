'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import { useWidgetPreferences } from '@/hooks/use-widget-preferences';
import { WidgetContainer } from '@/components/dashboard/widget-container';
import { CustomizeWidgetsModal } from '@/components/dashboard/customize-widgets-modal';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { CreateObjectiveDialog } from '@/components/goals/create-objective-dialog';
import { QuickCreateTaskModal } from '@/components/tasks/quick-create-task-modal';
import {
  MyTasksWidget,
  ProjectsWidget,
  QuickOverviewWidget,
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

export default function HomePage() {
  const { data: session } = useSession();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showQuickCreateTask, setShowQuickCreateTask] = useState(false);

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
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = preferences.widgetOrder.indexOf(active.id as WidgetType);
      const newIndex = preferences.widgetOrder.indexOf(over.id as WidgetType);
      const newOrder = arrayMove(preferences.widgetOrder, oldIndex, newIndex);
      reorderWidgets(newOrder);
    }
  };

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  // Widget components map
  const renderWidget = (widgetId: WidgetType) => {
    switch (widgetId) {
      case 'quick-overview':
        return <QuickOverviewWidget />;
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
        return <PeopleWidget />;
      case 'status-updates':
        return <StatusUpdatesWidget />;
      case 'portfolios':
        return <PortfoliosWidget />;
      case 'private-notepad':
        return <PrivateNotepadWidget />;
      case 'draft-comments':
        return <DraftCommentsWidget />;
      case 'forms':
        return <FormsWidget />;
      case 'mentions':
        return <MentionsWidget />;
      case 'ai-assistant':
        return <AIAssistantWidget />;
      default:
        return null;
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
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
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-gray-500 mt-1">
              Here&apos;s what&apos;s happening with your projects
            </p>
          </div>
          <CustomizeWidgetsModal
            preferences={preferences}
            onToggleWidget={toggleWidget}
            onReset={resetToDefaults}
          />
        </div>

        {/* Widget Grid - 2 columnas con widgets cuadrados */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={preferences.widgetOrder}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {preferences.widgetOrder.map((widgetId) => {
                if (!preferences.visibleWidgets.includes(widgetId)) return null;

                // MyTasks widget has its own header with dropdown
                const hideHeader = widgetId === 'my-tasks';
                const widgetSize = getWidgetSize(widgetId);

                return (
                  <WidgetContainer
                    key={widgetId}
                    id={widgetId}
                    onHide={toggleWidget}
                    size={widgetSize}
                    hideHeader={hideHeader}
                  >
                    {renderWidget(widgetId)}
                  </WidgetContainer>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Empty state if no widgets */}
        {preferences.visibleWidgets.length === 0 && (
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
