"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Download,
  Plus,
  Users,
  ChevronDown,
  Star,
  Share2,
  MoreHorizontal,
  List,
  LayoutGrid,
  Calendar,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  allTemplates,
  templateCategories,
  getTemplatesByCategory,
  type TemplateDefinition,
} from "@/lib/templates-data";

// Categories for UI
const categories = [
  { id: "for_you", label: "For you" },
  { id: "my_org", label: "My organization" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations & PMO" },
  { id: "productivity", label: "Productivity" },
  { id: "more", label: "More: Sales & CX", hasDropdown: true },
];

const moreCategories = [
  { id: "design", label: "Design" },
  { id: "it", label: "IT" },
  { id: "engineering", label: "Product & Engineering" },
  { id: "hr", label: "HR" },
  { id: "sales", label: "Sales & Customer Experience" },
];

// Preview images by type
function TemplatePreview({ type }: { type: string }) {
  const baseClasses = "w-full h-40 rounded-t-lg bg-gradient-to-br from-gray-50 to-gray-100 p-4 border-b overflow-hidden";

  if (type === "list") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-lg shadow-sm h-full p-3 border border-gray-200">
          {/* Header row */}
          <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100">
            <div className="w-4 h-4" />
            <div className="h-2 bg-gray-300 rounded w-20" />
            <div className="h-2 bg-gray-200 rounded w-14" />
            <div className="h-2 bg-gray-200 rounded w-14" />
          </div>
          {/* Task rows */}
          <div className="space-y-2">
            {[85, 70, 55, 90].map((width, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                <div className="h-2.5 bg-gray-200 rounded" style={{ width: `${width}%` }} />
                <div className={cn(
                  "h-5 w-14 rounded-full flex-shrink-0",
                  i === 0 && "bg-black",
                  i === 1 && "bg-gray-400",
                  i === 2 && "bg-gray-300",
                  i === 3 && "bg-black"
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
        <div className="flex gap-2 h-full">
          {[{ title: "To Do", cards: 3 }, { title: "In Progress", cards: 2 }, { title: "Done", cards: 1 }].map((col, colIdx) => (
            <div key={col.title} className="flex-1 bg-white rounded-lg shadow-sm p-2 border border-gray-200">
              <div className="flex items-center gap-1 mb-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  colIdx === 0 && "bg-gray-400",
                  colIdx === 1 && "bg-black",
                  colIdx === 2 && "bg-gray-300"
                )} />
                <div className="h-2 bg-gray-300 rounded w-10" />
              </div>
              <div className="space-y-1.5">
                {Array.from({ length: col.cards }).map((_, cardIdx) => (
                  <div key={cardIdx} className="bg-gray-50 rounded p-1.5 border border-gray-100">
                    <div className="h-1.5 bg-gray-300 rounded w-full mb-1" />
                    <div className="h-1.5 bg-gray-200 rounded w-3/4" />
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
        <div className="bg-white rounded-lg shadow-sm h-full p-2 border border-gray-200">
          {/* Month header */}
          <div className="flex items-center justify-between mb-2">
            <div className="h-2 bg-gray-300 rounded w-16" />
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-gray-100 rounded" />
              <div className="w-4 h-4 bg-gray-100 rounded" />
            </div>
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-50 rounded-sm p-0.5 flex flex-col">
                <span className="text-[6px] text-gray-400">{i + 1}</span>
                {[3, 8, 12, 17, 22].includes(i) && (
                  <div className="h-1 bg-black rounded-sm mt-auto" />
                )}
                {[5, 15, 25].includes(i) && (
                  <div className="h-1 bg-gray-400 rounded-sm mt-auto" />
                )}
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
        <div className="bg-white rounded-lg shadow-sm h-full p-3 border border-gray-200">
          {/* Timeline header */}
          <div className="flex gap-4 mb-3 text-[8px] text-gray-400 border-b border-gray-100 pb-1">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span>
          </div>
          {/* Timeline bars */}
          <div className="space-y-2">
            {[
              { start: 5, width: 30, color: "bg-black" },
              { start: 25, width: 35, color: "bg-gray-500" },
              { start: 45, width: 40, color: "bg-gray-400" },
              { start: 10, width: 25, color: "bg-gray-300" },
            ].map((bar, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 h-2 bg-gray-200 rounded flex-shrink-0" />
                <div className="flex-1 h-5 bg-gray-100 rounded relative">
                  <div
                    className={cn("absolute h-full rounded", bar.color)}
                    style={{ left: `${bar.start}%`, width: `${bar.width}%` }}
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

// Large preview for modal - looks like real app screenshot
function LargeTemplatePreview({ type }: { type: string }) {
  const baseClasses = "w-full h-80 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-150 rounded-2xl p-5 shadow-inner";

  if (type === "list") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-xl shadow-xl h-full overflow-hidden border border-gray-200">
          {/* App header bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-5 w-48 bg-gray-200 rounded-md" />
            </div>
          </div>
          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="w-6" />
            <div className="flex-1 text-xs font-semibold text-gray-500">Task name</div>
            <div className="w-24 text-xs font-semibold text-gray-500 text-center">Status</div>
            <div className="w-20 text-xs font-semibold text-gray-500 text-center">Priority</div>
            <div className="w-10 text-xs font-semibold text-gray-500 text-center">Owner</div>
          </div>
          {/* Task rows */}
          <div className="divide-y divide-gray-50">
            {[
              { name: "Review project requirements", status: "Done", statusColor: "bg-black text-white", priority: "High" },
              { name: "Create wireframes for homepage", status: "In Progress", statusColor: "bg-gray-600 text-white", priority: "High" },
              { name: "Set up development environment", status: "In Progress", statusColor: "bg-gray-600 text-white", priority: "Medium" },
              { name: "Design system components", status: "To Do", statusColor: "bg-gray-200 text-gray-700", priority: "Medium" },
              { name: "Write technical documentation", status: "To Do", statusColor: "bg-gray-200 text-gray-700", priority: "Low" },
            ].map((task, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  task.status === "Done" ? "bg-black border-black" : "border-gray-300"
                )}>
                  {task.status === "Done" && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div className={cn("flex-1 text-sm", task.status === "Done" && "line-through text-gray-400")}>{task.name}</div>
                <div className={cn("w-24 text-xs font-medium px-2 py-1 rounded-full text-center", task.statusColor)}>{task.status}</div>
                <div className="w-20 text-xs text-gray-600 text-center">{task.priority}</div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0" />
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
        <div className="bg-white rounded-xl shadow-xl h-full overflow-hidden border border-gray-200">
          {/* App header bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-5 w-48 bg-gray-200 rounded-md" />
            </div>
          </div>
          {/* Board columns */}
          <div className="flex gap-4 p-4 h-[calc(100%-40px)] bg-gray-50/30">
            {[
              { title: "To Do", cards: [
                { title: "Research competitors", tag: "Research" },
                { title: "Define user personas", tag: "Planning" },
                { title: "Create mood board", tag: "Design" },
              ]},
              { title: "In Progress", cards: [
                { title: "Build landing page", tag: "Development" },
                { title: "Design mobile views", tag: "Design" },
              ]},
              { title: "Done", cards: [
                { title: "Project kickoff", tag: "Meeting" },
              ]},
            ].map((col, colIdx) => (
              <div key={col.title} className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    colIdx === 0 && "bg-gray-400",
                    colIdx === 1 && "bg-black",
                    colIdx === 2 && "bg-gray-300"
                  )} />
                  <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                  <span className="text-xs text-gray-400 ml-auto">{col.cards.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-hidden">
                  {col.cards.map((card, cardIdx) => (
                    <div key={cardIdx} className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                      <p className="text-sm font-medium text-gray-800 mb-2">{card.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{card.tag}</span>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "calendar") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-xl shadow-xl h-full overflow-hidden border border-gray-200">
          {/* App header bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-5 w-48 bg-gray-200 rounded-md" />
            </div>
          </div>
          {/* Calendar */}
          <div className="p-4 h-[calc(100%-40px)]">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-gray-900">January 2026</span>
              <div className="flex gap-1">
                <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600">‹</button>
                <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-center mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-gray-400 font-semibold py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-1">
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i - 3;
                const hasEvent1 = [2, 8, 15, 22].includes(day);
                const hasEvent2 = [5, 12, 19].includes(day);
                const isToday = day === 15;
                return (
                  <div key={i} className={cn(
                    "aspect-[4/3] rounded-lg p-1 text-xs flex flex-col",
                    isToday ? "bg-black text-white" : "bg-gray-50 hover:bg-gray-100",
                    day < 1 || day > 31 ? "opacity-30" : ""
                  )}>
                    {day >= 1 && day <= 31 && (
                      <>
                        <span className={cn("font-semibold", isToday ? "text-white" : "text-gray-700")}>{day}</span>
                        <div className="mt-auto space-y-0.5">
                          {hasEvent1 && <div className={cn("h-1 rounded-full", isToday ? "bg-white/60" : "bg-black")} />}
                          {hasEvent2 && <div className={cn("h-1 rounded-full", isToday ? "bg-white/40" : "bg-gray-400")} />}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "timeline") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-xl shadow-xl h-full overflow-hidden border border-gray-200">
          {/* App header bar */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="h-5 w-48 bg-gray-200 rounded-md" />
            </div>
          </div>
          {/* Timeline */}
          <div className="p-4 h-[calc(100%-40px)]">
            {/* Month headers */}
            <div className="flex mb-4 pl-32">
              <div className="flex-1 grid grid-cols-6 text-xs font-semibold text-gray-500">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => (
                  <div key={m} className="text-center border-l border-gray-200 first:border-l-0">{m}</div>
                ))}
              </div>
            </div>
            {/* Timeline rows */}
            <div className="space-y-3">
              {[
                { name: "Discovery & Research", color: "bg-black", start: 0, width: 20 },
                { name: "UX Design", color: "bg-gray-700", start: 15, width: 25 },
                { name: "UI Design", color: "bg-gray-600", start: 30, width: 25 },
                { name: "Development", color: "bg-gray-500", start: 40, width: 40 },
                { name: "Testing & QA", color: "bg-gray-400", start: 70, width: 20 },
                { name: "Launch", color: "bg-gray-300", start: 88, width: 10 },
              ].map((task) => (
                <div key={task.name} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-gray-700 font-medium truncate flex-shrink-0">{task.name}</div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg relative">
                    <div
                      className={cn("absolute h-full rounded-lg shadow-sm flex items-center px-2", task.color)}
                      style={{ left: `${task.start}%`, width: `${task.width}%` }}
                    >
                      {task.width > 15 && <span className="text-xs text-white font-medium truncate">{task.name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Get view type icon
function getViewIcon(type: string) {
  switch (type) {
    case "list": return List;
    case "board": return LayoutGrid;
    case "calendar": return Calendar;
    case "timeline": return Clock;
    default: return List;
  }
}

export default function TemplatesGalleryPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("marketing");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);

  // Get templates based on active category
  const getTemplatesForCategory = (): TemplateDefinition[] => {
    if (activeCategory === "for_you") {
      // Return a mix of popular templates
      return allTemplates.slice(0, 6);
    }
    if (activeCategory === "my_org") {
      // Organization templates (empty for now)
      return [];
    }
    return getTemplatesByCategory(activeCategory);
  };

  const currentTemplates = getTemplatesForCategory();

  const getCategoryTitle = () => {
    const titles: Record<string, string> = {
      for_you: "you",
      my_org: "your organization",
      marketing: "marketing teams",
      operations: "operations & PMO teams",
      productivity: "all teams",
      design: "design teams",
      it: "IT teams",
      engineering: "product & engineering teams",
      hr: "HR teams",
      sales: "sales & customer experience teams",
    };
    return titles[activeCategory] || "all teams";
  };

  const handleUseTemplate = (template: TemplateDefinition) => {
    setSelectedTemplate(null);
    router.push(`/projects/new?template=${template.id}`);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Workflow gallery</h1>
            <Badge variant="secondary" className="bg-gray-200 text-black">
              New
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Send feedback
            </button>
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Import
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-black hover:bg-black"
              onClick={() => router.push("/projects/new")}
            >
              <Plus className="h-4 w-4" />
              Blank project
            </Button>
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 px-6 pb-4 overflow-x-auto">
          {categories.map((cat) => (
            <div key={cat.id} className="relative flex-shrink-0">
              {cat.hasDropdown ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 whitespace-nowrap",
                        moreCategories.some((mc) => mc.id === activeCategory)
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {cat.label}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {moreCategories.map((mc) => (
                      <DropdownMenuItem
                        key={mc.id}
                        onClick={() => setActiveCategory(mc.id)}
                        className={cn(
                          activeCategory === mc.id && "bg-gray-100 font-medium"
                        )}
                      >
                        {mc.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                    activeCategory === cat.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {cat.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Category Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold">
            Discover workflows designed for {getCategoryTitle()}
          </h2>
          <p className="text-gray-600 mt-1">
            Help your {getCategoryTitle()} track, plan, and deliver high-impact
            work
          </p>
        </div>

        {/* Templates Grid */}
        {currentTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              >
                {/* Preview */}
                <TemplatePreview type={template.preview} />

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900 group-hover:text-black">
                      {template.name}
                    </h3>
                    {template.isNew && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-200 text-black text-xs"
                      >
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    {template.isTrusted && (
                      <span className="text-xs text-gray-500">
                        Trusted by top teams
                      </span>
                    )}
                    {template.company && (
                      <span className="text-xs font-medium text-gray-700">
                        {template.company.toUpperCase()}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {template.sections.length} sections
                      </span>
                      <Users className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <List className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No templates yet</h3>
            <p className="text-gray-500 mt-1">
              {activeCategory === "my_org"
                ? "Your organization hasn't created any templates yet"
                : "Templates for this category coming soon"}
            </p>
          </div>
        )}
      </div>

      {/* Template Preview Modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedTemplate && (
            <>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center shadow-sm">
                    {(() => {
                      const ViewIcon = getViewIcon(selectedTemplate.preview);
                      return <ViewIcon className="h-6 w-6 text-white" />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-xl">{selectedTemplate.name}</h2>
                      {selectedTemplate.isNew && (
                        <span className="px-2 py-0.5 text-xs font-medium border border-black rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">{selectedTemplate.preview} view</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                    <Star className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                    <Share2 className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-5">
                {/* Large Preview */}
                <LargeTemplatePreview type={selectedTemplate.preview} />

                {/* Template Info */}
                <div className="mt-8 grid grid-cols-3 gap-8">
                  <div className="col-span-2 pr-4">
                    <h3 className="font-semibold text-gray-900 mb-3">About this template</h3>
                    <p className="text-gray-600 leading-relaxed">{selectedTemplate.description}</p>

                    {/* What's included */}
                    <div className="mt-6 space-y-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">What's included</p>
                      <div className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                        <span>{selectedTemplate.sections.length} sections: {selectedTemplate.sections.map(s => s.name).join(", ")}</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                        <span>{selectedTemplate.tasks.length} pre-built tasks ready to assign</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                        <span>Customizable fields and multiple views</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                        <span>Ready to use immediately</span>
                      </div>
                    </div>

                    {selectedTemplate.company && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Trusted by</p>
                        <p className="font-semibold text-gray-900">{selectedTemplate.company}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pl-4 border-l border-gray-100">
                    <Button
                      className="w-full bg-black hover:bg-gray-900 h-11 text-base font-medium"
                      onClick={() => handleUseTemplate(selectedTemplate)}
                    >
                      Use template
                    </Button>
                    <Button variant="outline" className="w-full h-11 text-base font-medium border-gray-300">
                      Preview
                    </Button>
                    <div className="text-center pt-2">
                      <button className="text-sm text-gray-500 hover:text-black transition-colors">
                        Learn more about templates
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
