"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  List,
  LayoutGrid,
  Calendar,
  GanttChart,
  BarChart3,
  Plus,
  MoreHorizontal,
  Star,
  Settings,
  Trash2,
  Share2,
  Filter,
  SortAsc,
  FileText,
  GitBranch,
  MessageSquare,
  FolderOpen,
  ChevronDown,
  Rows3,
  Search,
} from "lucide-react";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { TimelineView } from "@/components/views/timeline-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { CalendarView } from "@/components/views/calendar-view";
import { WorkflowView } from "@/components/views/workflow-view";
import { MessagesView } from "@/components/views/messages-view";
import { FilesView } from "@/components/views/files-view";
import { ProjectOverview } from "@/components/projects/project-overview";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

interface Task {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  subtasks: { id: string; completed: boolean }[];
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
  };
}

interface Section {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  sections: Section[];
  views: { id: string; name: string; type: string; isDefault: boolean }[];
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  members: {
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }[];
  portfolio?: {
    id: string;
    name: string;
  } | null;
}

interface ProjectContentProps {
  project: Project;
  currentView: string;
}

const STATUS_COLORS = {
  ON_TRACK: "bg-green-100 text-green-800",
  AT_RISK: "bg-yellow-100 text-yellow-800",
  OFF_TRACK: "bg-red-100 text-red-800",
  ON_HOLD: "bg-gray-100 text-gray-800",
  COMPLETE: "bg-blue-100 text-blue-800",
};

const STATUS_LABELS = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  ON_HOLD: "On hold",
  COMPLETE: "Complete",
};

export function ProjectContent({ project, currentView }: ProjectContentProps) {
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const handleViewChange = (view: string) => {
    router.push(`/projects/${project.id}?view=${view}`);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleAddTask = (sectionId?: string) => {
    setSelectedSectionId(sectionId || null);
    setShowCreateTask(true);
  };

  const statusConfig = {
    ON_TRACK: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
    AT_RISK: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
    OFF_TRACK: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
    ON_HOLD: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
    COMPLETE: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  };

  const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.ON_TRACK;

  // Show toolbar only for task views
  const showToolbar = ["list", "board", "timeline", "calendar"].includes(currentView);

  return (
    <div className="h-full flex flex-col">
      {/* Portfolio Breadcrumb */}
      {project.portfolio && (
        <div className="px-6 py-2 text-sm text-slate-500 border-b bg-slate-50">
          <Link
            href={`/portfolios/${project.portfolio.id}`}
            className="hover:text-slate-700 hover:underline"
          >
            {project.portfolio.name}
          </Link>
        </div>
      )}

      {/* Project Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Project Icon */}
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: project.color }}
            >
              {project.name[0]}
            </div>

            {/* Project Name with Dropdown */}
            <button className="flex items-center gap-1 text-xl font-semibold text-slate-900 hover:text-slate-700">
              {project.name}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {/* Favorite */}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Star className="h-4 w-4" />
            </Button>

            {/* Status Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${status.bg} ${status.text}`}>
              <div className={`w-2 h-2 rounded-full ${status.dot}`} />
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Members */}
            <div className="flex -space-x-2 mr-2">
              {project.members.slice(0, 3).map((member) => (
                <div
                  key={member.userId}
                  className="w-8 h-8 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-sm font-medium text-white"
                  title={member.user.name || member.user.email || ""}
                >
                  {member.user.name?.[0] || member.user.email?.[0] || "?"}
                </div>
              ))}
              {project.members.length === 0 && (
                <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-sm font-medium text-white">
                  {project.owner.name?.[0] || "?"}
                </div>
              )}
            </div>

            {/* Share Button */}
            <Button className="bg-amber-500 hover:bg-amber-600 text-white">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            {/* Customize Button */}
            <Button variant="outline">
              Customize
            </Button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => handleViewChange("overview")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "overview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "list"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => handleViewChange("board")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "board"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
            <button
              onClick={() => handleViewChange("timeline")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "timeline"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <GanttChart className="h-4 w-4" />
              Timeline
            </button>
            <button
              onClick={() => handleViewChange("dashboard")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "dashboard"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => handleViewChange("calendar")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "calendar"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => handleViewChange("workflow")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "workflow"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitBranch className="h-4 w-4" />
              Workflow
            </button>
            <button
              onClick={() => handleViewChange("messages")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "messages"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Messages
            </button>
            <button
              onClick={() => handleViewChange("files")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                currentView === "files"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Files
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Toolbar - only show for task views */}
          {showToolbar && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="ghost" size="sm">
                <SortAsc className="mr-2 h-4 w-4" />
                Sort
              </Button>
              <Button variant="ghost" size="sm">
                <Rows3 className="mr-2 h-4 w-4" />
                Group
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Options
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden flex bg-white">
        <div className="flex-1 overflow-auto bg-white">
          {currentView === "overview" && (
            <ProjectOverview project={project} />
          )}
          {currentView === "list" && (
            <ListView
              sections={project.sections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
            />
          )}
          {currentView === "board" && (
            <BoardView
              sections={project.sections}
              onTaskClick={handleTaskClick}
              onAddTask={handleAddTask}
              projectId={project.id}
            />
          )}
          {currentView === "timeline" && (
            <TimelineView
              sections={project.sections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
            />
          )}
          {currentView === "calendar" && (
            <CalendarView
              sections={project.sections}
              onTaskClick={handleTaskClick}
              projectId={project.id}
            />
          )}
          {currentView === "dashboard" && (
            <DashboardView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {currentView === "workflow" && (
            <WorkflowView
              sections={project.sections}
              projectId={project.id}
            />
          )}
          {currentView === "messages" && (
            <MessagesView
              sections={project.sections}
              projectId={project.id}
              projectName={project.name}
              projectColor={project.color}
              projectStatus={project.status}
            />
          )}
          {currentView === "files" && (
            <FilesView
              sections={project.sections}
              projectId={project.id}
            />
          )}
        </div>

        {/* Task Detail Panel */}
        {selectedTaskId && (
          <TaskDetailPanel
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        projectId={project.id}
        sectionId={selectedSectionId || undefined}
      />
    </div>
  );
}

function ComingSoon({ view }: { view: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="rounded-full bg-slate-100 p-4 mx-auto w-fit mb-4">
          <GanttChart className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="font-medium text-slate-900">{view} view</h3>
        <p className="text-sm text-slate-500 mt-1">Coming soon</p>
      </div>
    </div>
  );
}
