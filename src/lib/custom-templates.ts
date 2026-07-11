/**
 * Custom (user-created) project templates.
 *
 * A custom template is a `ProjectTemplate` DB row (prisma model) whose
 * `structure` JSON mirrors the buildable parts of the built-in
 * ProjectTemplate shape from project-templates.ts. That symmetry is the
 * whole point: once mapped, a custom template renders in the gallery and
 * creates a project through the EXACT same inline path as a built-in one
 * (POST /api/projects with sections + customFields + tasks) — so there is
 * one creation code path, not two.
 *
 * Used by:
 *   - components/projects/create-project-gallery.tsx  (modal gallery)
 *   - app/(dashboard)/templates/page.tsx              (full-page gallery)
 *   - components/projects/new-template-dialog.tsx     (serializes on save)
 */

import type {
  ProjectTemplate,
  ProjectTemplateTask,
  ProjectTemplateCustomField,
} from "./project-templates";

/** The JSON persisted in ProjectTemplate.structure. */
export interface CustomTemplateStructure {
  sections: string[];
  customFields?: ProjectTemplateCustomField[];
  tasks?: ProjectTemplateTask[];
  defaults?: ProjectTemplate["defaults"];
  accent?: ProjectTemplate["accent"];
  workflowTemplateId?: string;
}

/** Raw row shape returned by GET /api/workspace/templates. */
export interface CustomTemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isPublic: boolean;
  structure: unknown;
  creatorId: string;
  createdAt: string;
  creator?: { id: string; name: string | null; image: string | null } | null;
  mine?: boolean;
}

/** A built-in ProjectTemplate augmented with custom-template metadata. */
export type CustomProjectTemplate = ProjectTemplate & {
  custom: true;
  creator?: CustomTemplateRow["creator"];
  mine?: boolean;
};

const ACCENTS: ProjectTemplate["accent"][] = [
  "amber",
  "blue",
  "violet",
  "rose",
  "emerald",
  "slate",
];

/** Prefix so a custom template id can never collide with a built-in id and
 *  the galleries can tell the two apart at pick time. */
export const CUSTOM_PREFIX = "custom:";

export function isCustomTemplateId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

export function customIdToDbId(id: string): string {
  return isCustomTemplateId(id) ? id.slice(CUSTOM_PREFIX.length) : id;
}

/** Defensively normalize an untyped `structure` JSON into a well-formed
 *  structure — old or malformed rows degrade to safe defaults instead of
 *  crashing the gallery. */
export function normalizeStructure(raw: unknown): CustomTemplateStructure {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(s.sections)
    ? (s.sections as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];
  const accent = ACCENTS.includes(s.accent as ProjectTemplate["accent"])
    ? (s.accent as ProjectTemplate["accent"])
    : undefined;
  return {
    sections,
    customFields: Array.isArray(s.customFields)
      ? (s.customFields as ProjectTemplateCustomField[])
      : undefined,
    tasks: Array.isArray(s.tasks) ? (s.tasks as ProjectTemplateTask[]) : undefined,
    defaults:
      s.defaults && typeof s.defaults === "object"
        ? (s.defaults as ProjectTemplate["defaults"])
        : undefined,
    accent,
    workflowTemplateId:
      typeof s.workflowTemplateId === "string" ? s.workflowTemplateId : undefined,
  };
}

/** Map a DB custom-template row into the client ProjectTemplate shape so the
 *  gallery renders + creates it identically to a built-in template. */
export function customRowToProjectTemplate(
  row: CustomTemplateRow
): CustomProjectTemplate {
  const st = normalizeStructure(row.structure);
  return {
    id: `${CUSTOM_PREFIX}${row.id}`,
    name: row.name,
    description: row.description || "Custom template created by your team.",
    icon: row.icon || "Folder",
    accent: st.accent || "slate",
    // Custom templates live under their own "Created by your team" tab; the
    // category value is never used to filter them, so any valid value works.
    category: "for_you",
    defaults: st.defaults || { color: row.color || undefined },
    sections: st.sections.length ? st.sections : ["To do", "In progress", "Done"],
    customFields: st.customFields,
    tasks: st.tasks,
    workflowTemplateId: st.workflowTemplateId,
    custom: true,
    creator: row.creator,
    mine: row.mine,
  };
}
