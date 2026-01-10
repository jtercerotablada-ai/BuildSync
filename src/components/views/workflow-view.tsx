"use client";

import { useState } from "react";
import {
  Plus,
  FileText,
  CheckCircle,
  Link2,
  Users,
  MessageSquare,
  User,
  MoreHorizontal,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  name: string;
  completed: boolean;
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface WorkflowViewProps {
  sections: Section[];
  projectId: string;
}

interface WorkflowAction {
  id: string;
  type: "assign" | "add-collaborators" | "comment" | "complete" | "move-section" | "add-project";
  label: string;
  icon: React.ReactNode;
}

interface TaskSource {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

// ============================================
// AVAILABLE ACTIONS
// ============================================

const AVAILABLE_ACTIONS = [
  { type: "assign", label: "Set assignee", icon: <User className="w-4 h-4" /> },
  { type: "add-collaborators", label: "Add collaborators", icon: <Users className="w-4 h-4" /> },
  { type: "comment", label: "Add comment", icon: <MessageSquare className="w-4 h-4" /> },
  { type: "complete", label: "Mark complete", icon: <CheckCircle className="w-4 h-4" /> },
  { type: "add-project", label: "Add to another project", icon: <Plus className="w-4 h-4" /> },
];

// ============================================
// TASK SOURCES
// ============================================

const TASK_SOURCES: TaskSource[] = [
  {
    id: "forms",
    name: "Form submissions",
    description: "Create a form that converts submissions into tasks",
    icon: <FileText className="w-4 h-4 text-blue-500" />,
    enabled: false,
  },
  {
    id: "templates",
    name: "Task templates",
    description: "Create a template to standardize tasks easily",
    icon: <CheckCircle className="w-4 h-4 text-green-500" />,
    enabled: false,
  },
  {
    id: "integrations",
    name: "From other apps",
    description: "Choose apps your team uses to create tasks for this project",
    icon: <Link2 className="w-4 h-4 text-purple-500" />,
    enabled: false,
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowView({ sections, projectId }: WorkflowViewProps) {
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Initialize section actions state
  const [sectionActions, setSectionActions] = useState<Record<string, WorkflowAction[]>>(() => {
    const initial: Record<string, WorkflowAction[]> = {};
    sections.forEach((section, index) => {
      if (index === 0) {
        // First section: assign and add collaborators
        initial[section.id] = [
          { id: "a1", type: "assign", label: "Set assignee", icon: <User className="w-4 h-4" /> },
          { id: "a2", type: "add-collaborators", label: "Add collaborators", icon: <Users className="w-4 h-4" /> },
        ];
      } else if (index === sections.length - 1) {
        // Last section: complete and add to project
        initial[section.id] = [
          { id: "a3", type: "complete", label: "Mark complete", icon: <CheckCircle className="w-4 h-4" /> },
          { id: "a4", type: "add-project", label: "Add to another project", icon: <Plus className="w-4 h-4" /> },
        ];
      } else {
        // Middle sections: collaborators and comment
        initial[section.id] = [
          { id: "a5", type: "add-collaborators", label: "Add collaborators", icon: <Users className="w-4 h-4" /> },
          { id: "a6", type: "comment", label: "Add comment", icon: <MessageSquare className="w-4 h-4" /> },
        ];
      }
    });
    return initial;
  });

  const addAction = (sectionId: string, action: typeof AVAILABLE_ACTIONS[0]) => {
    const newAction: WorkflowAction = {
      id: `action-${Date.now()}`,
      type: action.type as WorkflowAction["type"],
      label: action.label,
      icon: action.icon,
    };

    setSectionActions((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), newAction],
    }));
  };

  const removeAction = (sectionId: string, actionId: string) => {
    setSectionActions((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] || []).filter((a) => a.id !== actionId),
    }));
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-auto bg-white">
      <div className="min-h-full min-w-max p-6">
        {/* Main Layout - HORIZONTAL */}
        <div className="flex items-start gap-4">

          {/* === LEFT: Onboarding Text === */}
          <div className="w-56 flex-shrink-0 pt-8">
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Create your workflow in minutes
            </h1>
            <p className="text-sm text-slate-500">
              Automate your team's processes and let the work flow.
            </p>
          </div>

          {/* === CENTER: Config Card + Connectors === */}
          {showOnboarding && (
            <div className="flex-shrink-0">
              {/* Configuration Card */}
              <div className="w-72 bg-white rounded-lg border shadow-sm">
                <div className="p-4">
                  <h2 className="text-sm font-semibold text-slate-900 text-center mb-3">
                    How will tasks be added to this project?
                  </h2>

                  <div className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg text-xs mb-3">
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-600">
                      Anyone with access to this project can add tasks manually.
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">More options</p>

                  <div className="space-y-2">
                    {TASK_SOURCES.map((source) => (
                      <button
                        key={source.id}
                        className="w-full flex items-start gap-2 p-2 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      >
                        <div className="p-1.5 bg-slate-100 rounded">
                          {source.icon}
                        </div>
                        <div>
                          <p className="font-medium text-xs text-slate-900">{source.name}</p>
                          <p className="text-xs text-slate-500">{source.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowOnboarding(false)}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ============================================ */}
          {/* HORIZONTAL CONNECTOR WITH + BUTTON */}
          {/* Connects Config Card to Section Cards */}
          {/* ============================================ */}
          {showOnboarding && (
            <div className="flex items-center self-start mt-[88px]">
              {/* Horizontal line from config card */}
              <div className="w-4 h-px bg-slate-300" />
              {/* Circular + button as connector */}
              <button className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
              {/* Horizontal line to sections */}
              <div className="w-4 h-px bg-slate-300" />
            </div>
          )}

          {/* === RIGHT: Section Cards with Connectors === */}
          <div className={`flex items-start flex-1 ${showOnboarding ? '' : ''}`}>
            {sections.map((section, index) => (
              <div key={section.id} className="flex items-start">
                <SectionCard
                  section={section}
                  actions={sectionActions[section.id] || []}
                  onAddAction={(action) => addAction(section.id, action)}
                  onRemoveAction={(actionId) => removeAction(section.id, actionId)}
                />
                {/* Connector line between cards */}
                {index < sections.length - 1 && (
                  <div className="flex items-center self-center h-full py-16">
                    <div className="w-4 h-px bg-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Connector to Add Section */}
            <div className="flex items-center self-center py-16">
              <div className="w-4 h-px bg-slate-300" />
            </div>

            {/* Add Section Card */}
            <button className="w-44 min-h-[200px] flex-shrink-0 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors gap-2">
              <Plus className="w-5 h-5" />
              <span className="text-xs">Add section</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION CARD COMPONENT
// ============================================

interface SectionCardProps {
  section: Section;
  actions: WorkflowAction[];
  onAddAction: (action: typeof AVAILABLE_ACTIONS[0]) => void;
  onRemoveAction: (actionId: string) => void;
}

function SectionCard({ section, actions, onAddAction, onRemoveAction }: SectionCardProps) {
  const [isAddingAction, setIsAddingAction] = useState(false);

  const incompleteCount = section.tasks.filter((t) => !t.completed).length;

  return (
    <div className="w-52 flex-shrink-0 bg-white rounded-lg border">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Section</span>
          <button className="p-1 hover:bg-slate-100 rounded">
            <MoreHorizontal className="w-3 h-3 text-slate-400" />
          </button>
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">{section.name}</h3>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {incompleteCount} incomplete {incompleteCount === 1 ? "task" : "tasks"}
        </p>
      </div>

      {/* Trigger Question */}
      <div className="p-3 border-b">
        <p className="text-xs text-slate-500">
          What actions should trigger automatically when tasks move to this section?
        </p>
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="space-y-1">
          {actions.map((action) => (
            <div
              key={action.id}
              className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-xs group"
            >
              <span className="text-slate-400">{action.icon}</span>
              <span className="text-slate-700 flex-1">{action.label}</span>
              <button
                onClick={() => onRemoveAction(action.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-all"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          ))}

          {actions.length === 0 && (
            <div className="text-center py-3 text-xs text-slate-400">
              No automations configured
            </div>
          )}
        </div>

        {/* Add Action */}
        {isAddingAction ? (
          <div className="mt-2 p-2 border rounded bg-white shadow-sm">
            <p className="text-xs text-slate-500 mb-2">Add an action:</p>
            {AVAILABLE_ACTIONS.map((action) => (
              <button
                key={action.type}
                onClick={() => {
                  onAddAction(action);
                  setIsAddingAction(false);
                }}
                className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-left text-xs"
              >
                <span className="text-slate-400">{action.icon}</span>
                <span className="text-slate-700">{action.label}</span>
              </button>
            ))}
            <button
              onClick={() => setIsAddingAction(false)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingAction(true)}
            className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <Plus className="w-3 h-3" />
            More actions
          </button>
        )}
      </div>
    </div>
  );
}
