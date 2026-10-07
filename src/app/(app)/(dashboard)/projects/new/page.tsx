"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toDateOnlyISO } from "@/lib/date-only";
import { useToday } from "@/lib/use-today";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  CheckCircle2,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { notifySidebarRefresh } from "@/lib/open-create-project";
import { DEFAULT_VISIBLE_VIEWS, baseLabelFor } from "@/lib/project-views";

// What a new project's tab strip really opens with (the rest start hidden
// under "+"), read from the same list POST /api/projects seeds from.
const STARTING_TABS = DEFAULT_VISIBLE_VIEWS.map((key) => baseLabelFor(key));
const STARTING_TABS_COPY = `Starts with ${STARTING_TABS.length} tabs: ${STARTING_TABS.join(
  ", "
)}. Add more views from "+".`;

// Fixed bar widths for the List preview. Random widths computed during render
// changed on every keystroke in the form and differed between server and
// client.
const LIST_PREVIEW_WIDTHS = [78, 62, 86, 55];

// Color options for project — strict monochrome + gold palette.
const colorOptions = [
  { value: "#0a0a0a", label: "Black" },
  { value: "#4a4a4a", label: "Charcoal" },
  { value: "#888888", label: "Gray" },
  { value: "#d4b65a", label: "Bright gold" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#a8893a", label: "Bronze" },
];

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
                <div className="h-2 bg-gray-200 rounded flex-1" style={{ width: `${LIST_PREVIEW_WIDTHS[i - 1]}%` }} />
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
              { name: "Phase 1", color: "bg-gray-500", start: 0, width: 30 },
              { name: "Phase 2", color: "bg-[#d4b65a]", start: 25, width: 35 },
              { name: "Phase 3", color: "bg-[#d4b65a]", start: 50, width: 40 },
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
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId");

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState("#c9a84c");
  // Default to the LOCAL calendar date. toISOString() would give the UTC
  // date, which is already "tomorrow" for US-evening users — and this value
  // becomes the project's start date server-side.
  //
  // Filled from `useToday()` in an effect rather than a useState initializer:
  // an initializer runs during RENDER, and this page is server-rendered, so
  // the server put its UTC date into the `value=` attribute of the date
  // input while the client's state held the local one. React does not
  // rewrite an input's value when it hydrates, so from 20:00 Miami the field
  // SHOWED tomorrow and POSTed today — the exact "already tomorrow for
  // US-evening users" case the comment above set out to avoid.
  const today = useToday();
  // null = the engineer has not picked a date, so the field follows today.
  // Derived rather than seeded-then-corrected: no effect, no second render,
  // and nothing to clobber a date that HAS been picked.
  const [pickedStartDate, setPickedStartDate] = useState<string | null>(null);
  const startDate = pickedStartDate ?? (today ? toDateOnlyISO(today) : "");

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
          teamId: teamId || undefined,
          startDate,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" && data.error
            ? data.error
            : "Failed to create project"
        );
      }

      return response.json();
    },
    onSuccess: (project) => {
      notifySidebarRefresh();
      // A mounted team "All work" list (same cache key as its page) refreshes too.
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: ["team-projects", teamId] });
      }
      router.push(`/projects/${project.id}`);
    },
  });

  const handleCreateProject = () => {
    // `startDate` is empty only on the very first frame, before the seeding
    // effect runs. Posting "" would hand the API an Invalid Date for the
    // project's start date.
    if (!projectName.trim() || !startDate) return;
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
                    onChange={(e) => setPickedStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  When work on the project begins
                </p>
              </div>

              <Button
                onClick={handleCreateProject}
                disabled={
                  !projectName.trim() ||
                  !startDate ||
                  createProjectMutation.isPending
                }
                className="w-full bg-[#c9a84c] hover:bg-[#a8893a]"
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
                <p className="text-sm text-black text-center">
                  {createProjectMutation.error?.message ||
                    "Failed to create project. Please try again."}
                </p>
              )}
            </div>
          </div>

          {/* Right: what a blank project starts with */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-[#c9a84c] flex items-center justify-center">
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
                  <CheckCircle2 className="h-4 w-4 text-[#a8893a] flex-shrink-0" />
                  <span>3 default sections: To do, In progress, Done</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-[#a8893a] flex-shrink-0" />
                  <span>{STARTING_TABS_COPY}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
