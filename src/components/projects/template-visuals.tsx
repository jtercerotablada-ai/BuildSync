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
