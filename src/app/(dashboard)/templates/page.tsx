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

// Preview images using Storyset illustrations
function TemplatePreview({ type }: { type: string }) {
  const imageMap: Record<string, string> = {
    list: "/templates/list.svg",
    board: "/templates/board.svg",
    calendar: "/templates/calendar.svg",
    timeline: "/templates/timeline.svg",
  };

  const image = imageMap[type] || imageMap.list;

  return (
    <div className="w-full h-52 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center p-4 overflow-hidden">
      <img
        src={image}
        alt={`${type} template preview`}
        className="w-full h-full object-contain grayscale hover:grayscale-0 transition-all duration-300"
      />
    </div>
  );
}

// Large preview for modal - using Storyset illustrations
function LargeTemplatePreview({ type }: { type: string }) {
  const imageMap: Record<string, string> = {
    list: "/templates/list.svg",
    board: "/templates/board.svg",
    calendar: "/templates/calendar.svg",
    timeline: "/templates/timeline.svg",
  };

  const image = imageMap[type] || imageMap.list;

  return (
    <div className="w-full h-72 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center p-8 border border-gray-200">
      <img
        src={image}
        alt={`${type} template preview`}
        className="w-full h-full object-contain"
      />
    </div>
  );
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className="group cursor-pointer"
              >
                {/* Preview - Asana style */}
                <div className="rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all duration-200 bg-white">
                  <TemplatePreview type={template.preview} />
                </div>

                {/* Info - Below preview like Asana */}
                <div className="pt-4 px-1">
                  <h3 className="font-semibold text-lg text-gray-900 group-hover:text-black leading-tight">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                    {template.description}
                  </p>

                  {/* Footer - Asana style */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      {template.isNew ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-600">
                          <Sparkles className="h-3 w-3" />
                          <span>New</span>
                        </div>
                      ) : template.isTrusted ? (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          <span>Trusted by top teams</span>
                        </div>
                      ) : null}
                    </div>
                    {template.company && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500">
                          {template.company.charAt(0)}
                        </span>
                      </div>
                    )}
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
