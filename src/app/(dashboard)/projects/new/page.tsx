"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  List,
  LayoutGrid,
  Clock,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTemplateById, allTemplates, type TemplateDefinition } from "@/lib/templates-data";

// Color options for project
const colorOptions = [
  { value: "#4573D2", label: "Blue" },
  { value: "#7C3AED", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#EF4444", label: "Red" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#10B981", label: "Green" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#64748B", label: "Gray" },
];

// Get view icon
function getViewIcon(type: string) {
  switch (type) {
    case "list": return List;
    case "board": return LayoutGrid;
    case "calendar": return CalendarDays;
    case "timeline": return Clock;
    default: return List;
  }
}

// Template preview component
function TemplatePreviewLarge({ type }: { type: string }) {
  const baseClasses = "w-full h-48 bg-gray-50 rounded-lg p-4";

  if (type === "list") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-lg shadow-sm h-full p-4">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                <div className="h-2 bg-gray-200 rounded flex-1" style={{ width: `${50 + Math.random() * 40}%` }} />
                <div className={cn(
                  "h-4 w-14 rounded text-xs",
                  i === 1 && "bg-white border border-black",
                  i === 2 && "bg-white border border-black",
                  i === 3 && "bg-white border border-black",
                  i === 4 && "bg-white border border-black",
                )} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "board") {
    return (
      <div className={baseClasses}>
        <div className="flex gap-3 h-full">
          {["To do", "In progress", "Done"].map((col, colIndex) => (
            <div key={col} className="flex-1 bg-white rounded-lg shadow-sm p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{col}</span>
                <span className="text-xs text-gray-400">{3 - colIndex}</span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 - colIndex }).map((_, cardIndex) => (
                  <div key={cardIndex} className="bg-gray-50 rounded p-2 border">
                    <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                    <div className="h-2 bg-gray-200 rounded w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "calendar") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-lg shadow-sm h-full p-3">
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-50 rounded p-0.5 text-xs flex items-center justify-center">
                <span className="text-gray-400">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "timeline") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-lg shadow-sm h-full p-3">
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
          </div>
          <div className="space-y-3">
            {[
              { name: "Phase 1", color: "bg-purple-400", start: 0, width: 30 },
              { name: "Phase 2", color: "bg-blue-400", start: 25, width: 35 },
              { name: "Phase 3", color: "bg-green-400", start: 50, width: 40 },
            ].map((task) => (
              <div key={task.name} className="flex items-center gap-2">
                <div className="w-16 text-xs text-gray-600 truncate">{task.name}</div>
                <div className="flex-1 h-5 bg-gray-100 rounded relative">
                  <div
                    className={cn("absolute h-full rounded", task.color)}
                    style={{ left: `${task.start}%`, width: `${task.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const teamId = searchParams.get("teamId");

  const [template, setTemplate] = useState<TemplateDefinition | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState("#4573D2");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  // Load template if templateId is provided
  useEffect(() => {
    if (templateId) {
      const foundTemplate = getTemplateById(templateId);
      if (foundTemplate) {
        setTemplate(foundTemplate);
        setProjectName(foundTemplate.name);
        setProjectDescription(foundTemplate.description);
        setProjectColor(foundTemplate.color);
      }
    }
  }, [templateId]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          color: projectColor,
          templateId: template?.id,
          teamId: teamId || undefined,
          startDate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      return response.json();
    },
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`);
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    createProjectMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Create new project</h1>
              {template && (
                <p className="text-sm text-gray-500">
                  Using template: {template.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6 space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Project name
                </Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="What is this project about?"
                  className="mt-1.5 min-h-[100px]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Project color</Label>
                <div className="flex gap-2 mt-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setProjectColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        projectColor === color.value
                          ? "ring-2 ring-offset-2 ring-gray-900"
                          : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="startDate" className="text-sm font-medium">
                  Start date
                </Label>
                <div className="relative mt-1.5">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Task due dates will be calculated from this date
                </p>
              </div>

              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || createProjectMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating project...
                  </>
                ) : (
                  <>
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Create project
                  </>
                )}
              </Button>

              {createProjectMutation.isError && (
                <p className="text-sm text-red-500 text-center">
                  Failed to create project. Please try again.
                </p>
              )}
            </div>
          </div>

          {/* Right: Template Preview */}
          <div className="space-y-6">
            {template ? (
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: template.color }}
                  >
                    {(() => {
                      const ViewIcon = getViewIcon(template.preview);
                      return <ViewIcon className="h-6 w-6 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{template.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {template.preview} view
                      </Badge>
                      {template.isNew && (
                        <Badge className="bg-white border border-black text-blue-700 text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">{template.description}</p>

                {/* Preview */}
                <TemplatePreviewLarge type={template.preview} />

                {/* What's included */}
                <div className="mt-6 space-y-3">
                  <h3 className="font-medium text-sm text-gray-900">What's included</h3>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{template.sections.length} sections: {template.sections.map(s => s.name).join(", ")}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{template.tasks.length} pre-built tasks with due dates</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>4 views: List, Board, Timeline, Calendar</span>
                  </div>

                  {template.tasks.some(t => t.subtasks && t.subtasks.length > 0) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Subtasks for complex tasks</span>
                    </div>
                  )}

                  {template.company && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Trusted by</p>
                      <p className="font-medium text-gray-700">{template.company}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
                    <FolderKanban className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">Blank project</h2>
                    <p className="text-sm text-gray-500">Start from scratch</p>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">
                  Create a blank project and add your own sections, tasks, and workflows.
                </p>

                {/* Preview */}
                <TemplatePreviewLarge type="board" />

                {/* What's included */}
                <div className="mt-6 space-y-3">
                  <h3 className="font-medium text-sm text-gray-900">What's included</h3>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>3 default sections: To do, In progress, Done</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>4 views: List, Board, Timeline, Calendar</span>
                  </div>
                </div>

                {/* Browse templates */}
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-3">
                    Want to start with a template?
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/templates")}
                    className="w-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Browse templates
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
