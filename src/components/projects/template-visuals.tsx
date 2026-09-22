/**
 * Shared visual vocabulary for the project-template galleries.
 *
 * The create-project modal (create-project-gallery.tsx), the full-page
 * gallery (/templates), the confirm dialog, and the New-template dialog
 * all render the same template cards, so the icon + accent maps must
 * agree across every surface. Keep them here, import everywhere.
 */

import {
  Building2,
  FileBadge,
  BadgeCheck,
  Map,
  ShieldCheck,
  Hammer,
  Wrench,
  HelpCircle,
  Inbox,
  FilePenLine,
  Briefcase,
  PackageCheck,
  Target,
  Users,
  FileCheck2,
  ClipboardCheck,
  FileText,
  ListChecks,
  Rocket,
  CalendarDays,
  Layers,
  Folder,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ProjectTemplate } from "@/lib/project-templates";
import type { TemplateProjectType } from "@/lib/custom-templates";

/** Every icon a template (built-in or custom) can render by name. */
export const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  FileBadge,
  BadgeCheck,
  Map,
  ShieldCheck,
  Hammer,
  Wrench,
  HelpCircle,
  Inbox,
  FilePenLine,
  Briefcase,
  PackageCheck,
  Target,
  Users,
  FileCheck2,
  ClipboardCheck,
  FileText,
  ListChecks,
  Rocket,
  CalendarDays,
  Layers,
  Folder,
};

/** Resolve a template icon name to a component, with a safe fallback. */
export function resolveTemplateIcon(name: string | undefined | null): LucideIcon {
  return (name && ICON_MAP[name]) || Sparkles;
}

export const ACCENT_BG: Record<ProjectTemplate["accent"], string> = {
  amber: "bg-[#fbeed3] text-[#7a5b1b]",
  blue: "bg-[#e1eefc] text-[#274a73]",
  violet: "bg-[#ece4f7] text-[#4f3a7a]",
  rose: "bg-[#fce4e4] text-[#a8323a]",
  emerald: "bg-[#dff1e6] text-[#1d6b3e]",
  slate: "bg-[#f1f3f5] text-[#3a3f47]",
};

/** Ordered accents offered in the New-template picker. */
export const ACCENT_CHOICES: ProjectTemplate["accent"][] = [
  "amber",
  "blue",
  "violet",
  "rose",
  "emerald",
  "slate",
];

/** A representative hex per accent — stored on ProjectTemplate.color so a
 *  custom template still has a project color even though the gallery uses
 *  the pastel accent classes above. */
export const ACCENT_HEX: Record<ProjectTemplate["accent"], string> = {
  amber: "#c9a84c",
  blue: "#3b6fa0",
  violet: "#6f52a8",
  rose: "#b8434c",
  emerald: "#2d8a55",
  slate: "#5a6270",
};

/** Icons offered in the New-template picker (name must exist in ICON_MAP). */
export const ICON_CHOICES: string[] = [
  "Folder",
  "Building2",
  "Hammer",
  "FileBadge",
  "ClipboardCheck",
  "Target",
  "ListChecks",
  "CalendarDays",
  "Rocket",
  "Layers",
  "Briefcase",
  "Users",
];

/** Project types a template can seed, in the order the blank-project form
 *  offers them. Without one a project made from the template has no pipeline,
 *  so no stage strip and no stage-bound columns. */
export const TEMPLATE_TYPE_CHOICES: { value: TemplateProjectType; label: string }[] = [
  { value: "DESIGN", label: "Design" },
  { value: "PERMIT", label: "Permit" },
  { value: "RECERTIFICATION", label: "Recertification" },
  { value: "BSIP", label: "BSIP (Broward)" },
  { value: "CONSTRUCTION", label: "Construction" },
];

/** The project-type picker shared by the New and Edit template dialogs. */
export function TemplateTypeField({
  value,
  onChange,
}: {
  value: TemplateProjectType | undefined;
  onChange: (value: TemplateProjectType | undefined) => void;
}) {
  return (
    <div>
      <label
        htmlFor="template-project-type"
        className="block text-[12px] font-medium text-gray-700 mb-1.5"
      >
        Project type{" "}
        <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <select
        id="template-project-type"
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            TEMPLATE_TYPE_CHOICES.find((c) => c.value === e.target.value)?.value
          )
        }
        className="w-full h-9 px-2 text-[13px] border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-black/10 bg-white"
      >
        <option value="">No type (free-form board)</option>
        {TEMPLATE_TYPE_CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-gray-400">
        Sets the stage pipeline of projects made from this template. A section
        named like one of its stages becomes that stage.
      </p>
    </div>
  );
}
