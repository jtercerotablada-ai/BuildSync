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

// Large preview for modal
function LargeTemplatePreview({ type }: { type: string }) {
  const baseClasses = "w-full h-72 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-6";

  if (type === "list") {
    return (
      <div className={baseClasses}>
        <div className="bg-white rounded-xl shadow-lg h-full p-5 border border-gray-200">
          <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
            <div className="w-5 h-5" />
            <div className="h-3 w-24 bg-gray-300 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          <div className="space-y-3">
            {[90, 75, 60, 85, 70].map((width, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                <div className="h-3 bg-gray-200 rounded" style={{ width: `${width}%` }} />
                <div className={cn(
                  "h-6 w-20 rounded-full flex-shrink-0",
                  i === 0 && "bg-black",
                  i === 1 && "bg-gray-500",
                  i === 2 && "bg-gray-300",
                  i === 3 && "bg-black",
                  i === 4 && "bg-gray-400",
                )} />
                <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
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
        <div className="flex gap-4 h-full">
          {[
            { title: "To do", count: 3, color: "bg-gray-400" },
            { title: "In progress", count: 2, color: "bg-black" },
            { title: "Done", count: 1, color: "bg-gray-300" }
          ].map((col) => (
            <div key={col.title} className="flex-1 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", col.color)} />
                  <span className="text-sm font-medium text-gray-700">{col.title}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{col.count}</span>
              </div>
              <div className="space-y-3">
                {Array.from({ length: col.count }).map((_, cardIdx) => (
                  <div key={cardIdx} className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                    <div className="h-2.5 bg-gray-300 rounded w-full mb-2" />
                    <div className="h-2 bg-gray-200 rounded w-3/4 mb-3" />
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "h-5 w-14 rounded-full",
                        cardIdx === 0 && "bg-black",
                        cardIdx === 1 && "bg-gray-400",
                        cardIdx === 2 && "bg-gray-300",
                      )} />
                      <div className="w-6 h-6 rounded-full bg-gray-200" />
                    </div>
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
        <div className="bg-white rounded-xl shadow-lg h-full p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-gray-800">January 2026</span>
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200" />
              <div className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs text-center mb-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-gray-500 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-50 rounded-lg p-1 text-xs border border-gray-100">
                {i >= 3 && i <= 33 && (
                  <>
                    <span className="text-gray-500 font-medium">{i - 2}</span>
                    {[5, 10, 15, 20, 25].includes(i) && (
                      <div className="h-1.5 bg-black rounded mt-0.5" />
                    )}
                    {[8, 18, 28].includes(i) && (
                      <div className="h-1.5 bg-gray-400 rounded mt-0.5" />
                    )}
                  </>
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
        <div className="bg-white rounded-xl shadow-lg h-full p-5 border border-gray-200">
          <div className="flex items-center gap-8 mb-5 text-sm text-gray-500 font-medium border-b border-gray-100 pb-3">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
          <div className="space-y-4">
            {[
              { name: "Planning", color: "bg-black", start: 0, width: 25 },
              { name: "Design", color: "bg-gray-600", start: 20, width: 30 },
              { name: "Development", color: "bg-gray-500", start: 35, width: 40 },
              { name: "Testing", color: "bg-gray-400", start: 60, width: 25 },
              { name: "Launch", color: "bg-gray-300", start: 80, width: 15 },
            ].map((task) => (
              <div key={task.name} className="flex items-center gap-4">
                <div className="w-28 text-sm text-gray-700 font-medium truncate">{task.name}</div>
                <div className="flex-1 h-7 bg-gray-100 rounded-lg relative">
                  <div
                    className={cn("absolute h-full rounded-lg shadow-sm", task.color)}
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
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: selectedTemplate.color }}
                  >
                    {(() => {
                      const ViewIcon = getViewIcon(selectedTemplate.preview);
                      return <ViewIcon className="h-5 w-5 text-white" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{selectedTemplate.name}</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="capitalize">{selectedTemplate.preview} view</span>
                      {selectedTemplate.isNew && (
                        <Badge className="bg-gray-200 text-black text-xs">New</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Large Preview */}
                <LargeTemplatePreview type={selectedTemplate.preview} />

                {/* Template Info */}
                <div className="mt-6 grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <h3 className="font-medium text-gray-900 mb-2">About this template</h3>
                    <p className="text-gray-600">{selectedTemplate.description}</p>

                    {/* What's included */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-black" />
                        <span>{selectedTemplate.sections.length} sections: {selectedTemplate.sections.map(s => s.name).join(", ")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-black" />
                        <span>{selectedTemplate.tasks.length} pre-built tasks</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-black" />
                        <span>Customizable fields and views</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-black" />
                        <span>Ready to use immediately</span>
                      </div>
                    </div>

                    {selectedTemplate.company && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Trusted by</p>
                        <p className="font-medium text-gray-700">{selectedTemplate.company}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      className="w-full bg-black hover:bg-black"
                      onClick={() => handleUseTemplate(selectedTemplate)}
                    >
                      Use template
                    </Button>
                    <Button variant="outline" className="w-full">
                      Preview
                    </Button>
                    <div className="text-center">
                      <button className="text-sm text-gray-500 hover:text-gray-700">
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
