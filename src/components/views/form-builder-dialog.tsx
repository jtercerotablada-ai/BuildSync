"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  GripVertical,
  Type,
  AlignLeft,
  Mail,
  Calendar,
  ChevronDown,
  Hash,
  ListChecks,
  User,
  Paperclip,
  Heading2,
  Copy,
  Trash2,
  Globe,
  Lock,
  ExternalLink,
  Eye,
  Share2,
  Link2,
  Inbox,
  MoreHorizontal,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  FormField,
  FormFieldMapTo,
  FormFieldShowWhen,
  FormFieldType,
  FormRow,
} from "@/lib/form-types";
import {
  FORM_TEMPLATES,
  findFormTemplate,
  type FormTemplate,
} from "@/lib/form-templates";
import { FormSubmissionsDialog } from "@/components/views/form-submissions-dialog";
import {
  HelpCircle,
  FilePenLine,
  ShieldCheck,
  BadgeCheck,
  FileText,
} from "lucide-react";

/**
 * Form Builder dialog — single unified source for creating / editing
 * forms. Three tabs:
 *
 *   Build    — drag-and-drop field list with per-field config
 *              (label / required / mapTo / options / unit /
 *              accept / branching show-when)
 *   Settings — default section, default assignee, visibility,
 *              confirmation message, email notification toggle
 *   Share    — public form URL + copy button + iframe embed snippet
 *
 * Saves to /api/forms (create) or /api/forms/:id (edit). The Workflow
 * tab in a project hosts this dialog; the home page's FormsWidget
 * routes to /projects/:id?tab=workflow&form=new to open it.
 */

interface ProjectSection {
  id: string;
  name: string;
}

interface ProjectMember {
  id: string; // user id
  name: string | null;
  email: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Existing form (edit mode). When null, the dialog is in create mode. */
  initial?: FormRow | null;
  onSaved: (form: FormRow) => void;
  /** Called with the deleted form id so the parent can drop it from its list
   *  (the parent doesn't otherwise refetch when the dialog closes). */
  onDeleted?: (formId: string) => void;
}

const FIELD_TYPE_OPTIONS: {
  value: FormFieldType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "TEXT", label: "Short text", icon: <Type className="w-3.5 h-3.5" /> },
  { value: "TEXTAREA", label: "Long text", icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { value: "EMAIL", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "DATE", label: "Date", icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: "NUMBER", label: "Number", icon: <Hash className="w-3.5 h-3.5" /> },
  { value: "SELECT", label: "Dropdown", icon: <ChevronDown className="w-3.5 h-3.5" /> },
  { value: "MULTI_SELECT", label: "Multi-select", icon: <ListChecks className="w-3.5 h-3.5" /> },
  { value: "PEOPLE", label: "Person (name)", icon: <User className="w-3.5 h-3.5" /> },
  { value: "ATTACHMENT", label: "Attachment", icon: <Paperclip className="w-3.5 h-3.5" /> },
  { value: "HEADING", label: "Section heading", icon: <Heading2 className="w-3.5 h-3.5" /> },
];

const MAP_TO_OPTIONS: { value: FormFieldMapTo | "__none__"; label: string }[] = [
  { value: "__none__", label: "(none — append to description)" },
  { value: "name", label: "Task name" },
  { value: "description", label: "Task description" },
  { value: "dueDate", label: "Task due date (DATE only)" },
];

let _idCounter = 0;
function nextFieldId() {
  _idCounter += 1;
  return `f${Date.now()}_${_idCounter}`;
}

function emptyField(type: FormFieldType = "TEXT"): FormField {
  return {
    id: nextFieldId(),
    label: type === "HEADING" ? "Section" : "New field",
    type,
    required: false,
    options: type === "SELECT" || type === "MULTI_SELECT" ? ["Option 1"] : undefined,
  };
}

export function FormBuilderDialog({
  open,
  onOpenChange,
  projectId,
  initial,
  onSaved,
  onDeleted,
}: Props) {
  const [tab, setTab] = useState<"build" | "settings" | "share">("build");
  const [saving, setSaving] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  // Template picker removed — Asana doesn't expose form templates,
  // it just drops the user into the editor with a sensible default
  // (Name + Email). Kept as a const so the existing render branch
  // never fires.
  const showTemplatePicker = false;
  const setShowTemplatePicker = (_: boolean) => {};
  void setShowTemplatePicker;

  // ── Core form state ────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>(() => [
    emptyField("TEXT"),
  ]);

  // ── Settings state ─────────────────────────────────────────────
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true);
  const [visibility, setVisibility] = useState<"PUBLIC" | "ORGANIZATION">(
    "PUBLIC"
  );
  // Cover image URL — persisted in Form.settings JSON so we don't
  // need a schema migration. Accepts any HTTPS image URL the user
  // pastes (Unsplash, GitHub raw, S3, etc.).
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [coverInput, setCoverInput] = useState("");
  // Favorites persist in localStorage so they survive reloads. Per-
  // user, per-form. Mirrors Asana's ⭐ star on the form editor.
  const [isFavorite, setIsFavorite] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);

  // ── Picker options (lazy-loaded when needed) ───────────────────
  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);

  // ── Hydrate from `initial` on open ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setDescription(initial.description || "");
      setFields(
        Array.isArray(initial.fields) && initial.fields.length > 0
          ? initial.fields
          : [emptyField("TEXT")]
      );
      setDefaultSectionId(initial.defaultSectionId);
      setDefaultAssigneeId(initial.defaultAssigneeId);
      setConfirmationMessage(initial.confirmationMessage || "");
      setNotifyOnSubmission(initial.notifyOnSubmission);
      setVisibility(initial.visibility);
      // Cover image lives inside the open-ended settings JSON so we
      // don't need a schema migration. Cast carefully because TS
      // doesn't know the shape of FormRow.settings.
      const settings = (initial as unknown as { settings?: { coverImageUrl?: string } }).settings;
      setCoverImageUrl(settings?.coverImageUrl || null);
      setCoverInput(settings?.coverImageUrl || "");
      // Favorites are per-user, per-form, in localStorage.
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("buildsync-fav-forms");
          const set = new Set<string>(raw ? JSON.parse(raw) : []);
          setIsFavorite(set.has(initial.id));
        } catch {
          setIsFavorite(false);
        }
      }
    } else {
      // New form defaults — mirror Asana exactly. A fresh form drops
      // the user into the editor with title empty (placeholder),
      // empty description, and two pre-built fields: Name (required,
      // maps to task name) + Email (required). Asana ships the
      // same two defaults so submitters always identify themselves.
      setName("");
      setDescription("");
      setFields([
        {
          ...emptyField("TEXT"),
          label: "Name",
          required: true,
          mapTo: "name",
        },
        {
          ...emptyField("EMAIL"),
          label: "Email address",
          required: true,
        },
      ]);
      setDefaultSectionId(null);
      setDefaultAssigneeId(null);
      setConfirmationMessage("");
      setNotifyOnSubmission(true);
      setVisibility("PUBLIC");
      setCoverImageUrl(null);
      setCoverInput("");
      setIsFavorite(false);
    }
    setTab("build");
    setActiveFieldId(null);
    setSubmissionsOpen(false);
  }, [open, initial]);

  const pickTemplate = useCallback((template: FormTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setFields(template.fields.map((f) => ({ ...f })));
    setConfirmationMessage(template.confirmationMessage);
    setShowTemplatePicker(false);
    setActiveFieldId(null);
  }, []);

  // ── Load sections + members once the dialog opens ──────────────
  // GET /api/projects/:id returns both sections[] and members[] nested
  // — one round-trip instead of two.
  useEffect(() => {
    if (!open || pickersLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            sections?: { id: string; name: string }[];
            members?: {
              user: { id: string; name: string | null; email: string | null };
            }[];
          };
          if (Array.isArray(data.sections)) {
            setSections(
              data.sections.map((s) => ({ id: s.id, name: s.name }))
            );
          }
          if (Array.isArray(data.members)) {
            setMembers(
              data.members
                .map((m) => ({
                  id: m.user?.id,
                  name: m.user?.name ?? null,
                  email: m.user?.email ?? null,
                }))
                .filter((m): m is ProjectMember => Boolean(m.id))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load form-builder pickers:", err);
      } finally {
        if (!cancelled) setPickersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, pickersLoaded]);

  // ── Field operations ───────────────────────────────────────────
  const addField = useCallback((type: FormFieldType = "TEXT") => {
    setFields((prev) => [...prev, emptyField(type)]);
  }, []);

  const updateField = useCallback(
    (id: string, patch: Partial<FormField>) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
      );
    },
    []
  );

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    // Clear any showWhen rules pointing at the deleted field.
    setFields((prev) =>
      prev.map((f) =>
        f.showWhen?.fieldId === id ? { ...f, showWhen: undefined } : f
      )
    );
  }, []);

  const duplicateField = useCallback((id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const clone: FormField = {
        ...prev[idx],
        id: nextFieldId(),
        label: `${prev[idx].label} (copy)`,
        showWhen: prev[idx].showWhen ? { ...prev[idx].showWhen } : undefined,
      };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });
  }, []);

  const moveField = useCallback((id: string, dir: "up" | "down") => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  // ── Validation ─────────────────────────────────────────────────
  const validation = useMemo(() => {
    if (!name.trim()) return { ok: false, msg: "Form name is required" };
    const dataFields = fields.filter((f) => f.type !== "HEADING");
    if (dataFields.length === 0) {
      return { ok: false, msg: "Add at least one field" };
    }
    for (const f of fields) {
      if (!f.label.trim()) return { ok: false, msg: "Every field needs a label" };
      if (f.type === "SELECT" || f.type === "MULTI_SELECT") {
        if (!f.options || f.options.length === 0) {
          return { ok: false, msg: `"${f.label}" needs at least one option` };
        }
        // Blank options pass the length check but the server rejects them
        // (options: array of non-empty strings), so catch them here with a
        // clear, field-specific message instead of a cryptic 400 on save.
        if (f.options.some((o) => !o.trim())) {
          return { ok: false, msg: `"${f.label}" has an empty option` };
        }
      }
    }
    // Exactly one mapTo:"name" or zero (auto-fallback "New submission to …")
    const nameMappings = dataFields.filter((f) => f.mapTo === "name").length;
    if (nameMappings > 1) {
      return {
        ok: false,
        msg: "Only one field can map to the task name",
      };
    }
    return { ok: true as const, msg: "" };
  }, [name, fields]);

  // ── Save ───────────────────────────────────────────────────────
  async function handleSave() {
    if (!validation.ok) {
      toast.error(validation.msg);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        fields,
        projectId,
        defaultSectionId,
        defaultAssigneeId,
        confirmationMessage: confirmationMessage.trim() || null,
        notifyOnSubmission,
        visibility,
        // Persist the cover image URL inside the open-ended
        // settings JSON so we don't need a Form schema migration
        // just to add a header image. The Form viewer reads it
        // back out of the same bag.
        settings: { coverImageUrl: coverImageUrl || null },
      };
      const url = initial ? `/api/forms/${initial.id}` : "/api/forms";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Save failed");
      }
      const saved = (await res.json()) as FormRow;
      toast.success(initial ? "Form updated" : "Form created");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Share helpers ──────────────────────────────────────────────
  const publicUrl = useMemo(() => {
    if (!initial?.id) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/forms/${initial.id}`;
  }, [initial?.id]);

  const embedSnippet = useMemo(() => {
    if (!publicUrl) return "";
    return `<iframe src="${publicUrl}?embed=1" style="border:0;width:100%;min-height:680px" loading="lazy"></iframe>`;
  }, [publicUrl]);

  // ── Cover image: save the pasted URL via PATCH so it persists
  //    independently from the rest of the form data. The dialog
  //    closes the cover modal on success. ─────────────────────────
  async function saveCoverImage() {
    const url = coverInput.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Use an https:// URL");
      return;
    }
    setCoverImageUrl(url || null);
    setCoverModalOpen(false);
    if (initial?.id) {
      try {
        const res = await fetch(`/api/forms/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: { coverImageUrl: url || null },
          }),
        });
        if (!res.ok) throw new Error();
        toast.success(url ? "Cover image saved" : "Cover image removed");
      } catch {
        toast.error("Couldn't save the cover image");
      }
    } else {
      // New form — the cover will save together with the rest of
      // the form when the user hits Save.
      toast.info("Cover will save with the form");
    }
  }

  // ── Favorites: persisted per-user in localStorage. Toggle adds /
  //    removes the form id from the set. ───────────────────────────
  function toggleFavorite() {
    if (!initial?.id || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("buildsync-fav-forms");
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      if (set.has(initial.id)) {
        set.delete(initial.id);
        setIsFavorite(false);
        toast.success("Removed from favorites");
      } else {
        set.add(initial.id);
        setIsFavorite(true);
        toast.success("Added to favorites");
      }
      localStorage.setItem("buildsync-fav-forms", JSON.stringify(Array.from(set)));
    } catch {
      toast.error("Couldn't update favorites");
    }
  }

  // ── Delete: confirms, soft-deletes (closes the form so submissions are
  //    preserved — a hard DELETE cascades them away), tells the parent to
  //    drop it from the list, then closes the dialog. ─
  async function handleDelete() {
    if (!initial?.id) return;
    if (
      !window.confirm(
        `Delete the form "${initial.name}"? New submissions will be rejected; past submissions are kept.`
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/forms/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error();
      toast.success("Form deleted");
      onDeleted?.(initial.id);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete the form");
    } finally {
      setDeleting(false);
    }
  }

  // ── Submissions: open the dashboard-side submissions inbox
  //    inline. Backed by /api/forms/:id/submissions, which grants
  //    access to project members — unlike the portal admin route,
  //    which is gated to workspace OWNER/ADMIN and dead-ends every
  //    other editor on a redirect. ─────────────────────────────────
  function openSubmissions() {
    if (!initial?.id) return;
    setSubmissionsOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────────
  // Sized closer to Asana's form-editor modal (near-full-screen on
  // desktop, with internal scroll). The privacy banner under the
  // title bar mirrors Asana's "Solamente las personas de tu
  // organización pueden acceder…" line, kept dynamic to the
  // visibility setting so it stays accurate.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[1280px] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          {/* Title row — Asana puts inline actions on the right
              (Preview / Share / Copy link / More) once the form is
              saved. They're disabled for unsaved drafts. */}
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">
              {initial ? "Edit form" : "Add form"}
            </DialogTitle>
            {initial && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    publicUrl &&
                    window.open(publicUrl, "_blank", "noopener,noreferrer")
                  }
                  disabled={!publicUrl}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40"
                  title="View form"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">View form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  title="Share form"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Share form</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!publicUrl) return;
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("Link copied");
                  }}
                  disabled={!publicUrl}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40"
                  title="Copy link"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Copy link</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={toggleFavorite}>
                      <Star
                        className={cn(
                          "h-4 w-4 mr-2",
                          isFavorite
                            ? "text-[#c9a84c] fill-[#c9a84c]"
                            : "text-gray-500"
                        )}
                      />
                      {isFavorite ? "Remove from favorites" : "Add to favorites"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openSubmissions}>
                      <Inbox className="h-4 w-4 mr-2 text-gray-500" />
                      View submissions
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-rose-600 focus:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting ? "Deleting…" : "Delete form"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          {(
            <>
              {/* Privacy notice bar — Asana-style. Reads from the
                  current visibility setting so it stays accurate as
                  the user toggles it in the Settings tab. */}
              <div className="flex items-center gap-2 -mx-6 px-6 pt-3 pb-2 text-[12px] text-gray-600">
                {visibility === "PUBLIC" ? (
                  <>
                    <Globe className="h-3.5 w-3.5 text-gray-500" />
                    <span>
                      Anyone with the link can access and submit this form.
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-gray-500" />
                    <span>
                      Only members of your organization can access and submit
                      this form.
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="text-[12px] text-[#a8893a] hover:underline font-medium ml-1"
                >
                  Change
                </button>
              </div>
              {/* Two tabs only — Asana ships 'Preguntas / Ajustes',
                  and the share panel lives inside Ajustes. The legacy
                  'share' tab is retained as a target for the privacy
                  banner's Change link by aliasing 'share' to
                  'settings' at the tab handler. */}
              <div className="flex gap-4 border-b -mb-3 -mx-6 px-6 pt-2">
                {(["build", "settings"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "pb-2 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize",
                      (tab === t || (t === "settings" && tab === "share"))
                        ? "border-black text-black"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    )}
                  >
                    {t === "build" ? "Questions" : "Settings"}
                  </button>
                ))}
              </div>
            </>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "build" && (
            <BuildTab
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              fields={fields}
              activeFieldId={activeFieldId}
              setActiveFieldId={setActiveFieldId}
              updateField={updateField}
              removeField={removeField}
              duplicateField={duplicateField}
              moveField={moveField}
              addField={addField}
              coverImageUrl={coverImageUrl}
              onOpenCoverModal={() => {
                setCoverInput(coverImageUrl || "");
                setCoverModalOpen(true);
              }}
            />
          )}

          {(tab === "settings" || tab === "share") && (
            <div className="space-y-8">
              {/* Asana merges Settings and Share into a single
                  'Ajustes' tab — task settings on top, sharing /
                  embed at the bottom. We mirror that layout here so
                  the user has one Settings surface instead of two
                  tabs to flip between. */}
              <SettingsTab
                sections={sections}
                members={members}
                defaultSectionId={defaultSectionId}
                setDefaultSectionId={setDefaultSectionId}
                defaultAssigneeId={defaultAssigneeId}
                setDefaultAssigneeId={setDefaultAssigneeId}
                confirmationMessage={confirmationMessage}
                setConfirmationMessage={setConfirmationMessage}
                notifyOnSubmission={notifyOnSubmission}
                setNotifyOnSubmission={setNotifyOnSubmission}
                visibility={visibility}
                setVisibility={setVisibility}
              />
              {initial && (
                <div className="pt-6 border-t">
                  <h4 className="text-[13px] font-semibold text-gray-900 mb-3">
                    Share form
                  </h4>
                  <ShareTab
                    publicUrl={publicUrl}
                    embedSnippet={embedSnippet}
                    visibility={visibility}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {(
          <DialogFooter className="px-6 py-3 border-t bg-slate-50">
            {!validation.ok && (
              <span className="text-[12px] text-rose-600 mr-auto">
                {validation.msg}
              </span>
            )}
            {/* Preview opens the public form in a new tab so the editor
                can see exactly what a submitter will fill out (including
                the ATTACHMENT upload UI). Only meaningful for saved
                forms — show a hint instead when unsaved. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!initial) {
                  toast.info("Save the form first to preview it.");
                  return;
                }
                window.open(`/forms/${initial.id}`, "_blank");
              }}
              title={
                initial
                  ? "Open the public form in a new tab"
                  : "Save first, then preview"
              }
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !validation.ok}
              className="bg-black hover:bg-gray-900 text-white"
            >
              {saving ? "Saving…" : initial ? "Save changes" : "Create form"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Cover-image URL modal — Asana hosts uploads natively but
          BuildSync's MVP accepts any https:// image URL (Unsplash,
          GitHub raw, S3, etc.). The URL is persisted to
          Form.settings.coverImageUrl so no schema migration is
          needed. Clear the input to remove the cover. */}
      <Dialog open={coverModalOpen} onOpenChange={setCoverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Cover image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cover-url">Image URL</Label>
              <Input
                id="cover-url"
                type="url"
                value={coverInput}
                onChange={(e) => setCoverInput(e.target.value)}
                placeholder="https://images.unsplash.com/photo-…"
              />
              <p className="text-[12px] text-gray-500">
                Paste a public image URL (https only). Leave blank to remove
                the cover.
              </p>
            </div>
            {coverInput.trim() && /^https?:\/\//i.test(coverInput.trim()) && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverInput.trim()}
                  alt="Cover preview"
                  className="w-full h-32 object-cover"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).style.display = "none")
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCoverModalOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={saveCoverImage}>
              {coverInput.trim() ? "Save cover" : "Remove cover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions inbox — same dialog the Workflow tab uses,
          fed by the project-member-authorized submissions API. */}
      {initial && (
        <FormSubmissionsDialog
          open={submissionsOpen}
          onOpenChange={setSubmissionsOpen}
          form={initial}
          onOpenTask={(taskId) => {
            window.open(`/tasks/${taskId}`, "_blank");
          }}
        />
      )}
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────
// BUILD TAB
// ─────────────────────────────────────────────────────────────────

function BuildTab(props: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  fields: FormField[];
  activeFieldId: string | null;
  setActiveFieldId: (id: string | null) => void;
  updateField: (id: string, patch: Partial<FormField>) => void;
  removeField: (id: string) => void;
  duplicateField: (id: string) => void;
  moveField: (id: string, dir: "up" | "down") => void;
  addField: (type?: FormFieldType) => void;
  coverImageUrl: string | null;
  onOpenCoverModal: () => void;
}) {
  const {
    name,
    setName,
    description,
    setDescription,
    fields,
    activeFieldId,
    setActiveFieldId,
    updateField,
    removeField,
    duplicateField,
    moveField,
    addField,
    coverImageUrl,
    onOpenCoverModal,
  } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* LEFT — Form preview / edit. Mirrors Asana's main canvas
          where the form name, description and questions live. */}
      <div className="space-y-5 min-w-0">
        {/* Cover image — clicking opens a small modal where the
            user pastes a URL. The URL persists inside
            Form.settings.coverImageUrl and renders here on next
            open. Image-set state shows the actual cover with a
            'Change cover' overlay on hover; empty state mirrors
            Asana's diagonal-stripes placeholder. */}
        {coverImageUrl ? (
          <button
            type="button"
            onClick={onOpenCoverModal}
            className="relative w-full h-28 rounded-lg border border-gray-200 overflow-hidden group/cover"
            title="Change cover image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt="Form cover"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/cover:opacity-100">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/90 rounded-md border border-white text-[12px] font-medium text-gray-900">
                Change cover image
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenCoverModal}
            className="relative w-full h-28 rounded-lg border border-gray-200 bg-[repeating-linear-gradient(135deg,#f3f4f6_0_10px,#fafafa_10px_20px)] hover:bg-[repeating-linear-gradient(135deg,#eef0f3_0_10px,#f5f5f5_10px_20px)] flex items-center justify-center text-[12px] font-medium text-gray-600 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur rounded-md border border-gray-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Add a cover image
            </span>
          </button>
        )}

        {/* Form-level name + description */}
        <div className="space-y-1.5">
          <Label htmlFor="form-name">Form name *</Label>
          <Input
            id="form-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. RFI Request"
            className="text-[18px] font-semibold h-auto py-2"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-desc">Description</Label>
          <Textarea
            id="form-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Shown at the top of the public form"
            className="resize-none"
          />
        </div>

        {/* Fields list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">Fields</Label>
            <span className="text-[11px] text-slate-400">
              {fields.length} field{fields.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <FieldRow
                key={field.id}
                field={field}
                index={idx}
                total={fields.length}
                previousFields={fields.slice(0, idx)}
                isActive={activeFieldId === field.id}
                onToggleActive={() =>
                  setActiveFieldId(activeFieldId === field.id ? null : field.id)
                }
                onUpdate={(patch) => updateField(field.id, patch)}
                onRemove={() => removeField(field.id)}
                onDuplicate={() => duplicateField(field.id)}
                onMove={(dir) => moveField(field.id, dir)}
              />
            ))}
          </div>
          {/* Drop-zone hint at the bottom mirroring Asana's
              "Arrastra otra pregunta aquí" blue band. Clicking it
              adds a Short Text field as the easiest default. */}
          <button
            type="button"
            onClick={() => addField("TEXT")}
            className="mt-3 w-full rounded-lg border-2 border-dashed border-[#c9a84c]/40 bg-[#c9a84c]/5 px-4 py-3 text-[13px] font-medium text-[#a8893a] hover:bg-[#c9a84c]/10 transition-colors"
          >
            + Drag or add another question here
          </button>
        </div>
      </div>

      {/* RIGHT — Sidebar with field-type library. Asana exposes
          Email / Attachment / Heading as one-tap buttons and a
          "+ New question" CTA underneath. We list all 10 types so
          the user picks the right input in one click. */}
      <aside className="lg:sticky lg:top-0 lg:self-start space-y-3">
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-3 py-2 border-b text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            Add a question
          </div>
          <div className="p-2 space-y-1">
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => addField(opt.value)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <span className="text-gray-500">{opt.icon}</span>
                <span className="truncate text-left">{opt.label}</span>
              </button>
            ))}
            <div className="border-t border-gray-100 my-1" />
            <button
              type="button"
              onClick={() => addField()}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-[#a8893a] hover:bg-[#c9a84c]/10 rounded-md transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New question
            </button>
          </div>
        </div>

        {/* Quick stats card — gives the editor a sense of size at a
            glance. Asana doesn't have this exact card but the panel
            looked thin without it. */}
        {fields.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-600">
            <div className="flex items-center justify-between">
              <span>Questions</span>
              <span className="font-semibold tabular-nums text-gray-900">
                {fields.length}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>Required</span>
              <span className="font-semibold tabular-nums text-gray-900">
                {fields.filter((f) => f.required).length}
              </span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function FieldRow({
  field,
  index,
  total,
  previousFields,
  isActive,
  onToggleActive,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  previousFields: FormField[];
  isActive: boolean;
  onToggleActive: () => void;
  onUpdate: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const typeLabel =
    FIELD_TYPE_OPTIONS.find((o) => o.value === field.type)?.label ?? field.type;

  return (
    <div
      className={cn(
        "border rounded-md bg-white group",
        isActive ? "border-slate-400 shadow-sm" : "border-slate-200 hover:border-slate-300"
      )}
    >
      {/* Summary row — Asana shows each field as a WYSIWYG preview
          (label on top, real input below) so the editor sees the
          form exactly like a submitter will. Move/duplicate/delete
          buttons surface on hover. Click anywhere in the body opens
          the field editor underneath. */}
      <div
        className={cn(
          "px-4 py-3 cursor-pointer",
          isActive && "border-b"
        )}
        onClick={onToggleActive}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleActive();
          }
        }}
      >
        {/* Top row: label + hover actions */}
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 flex flex-col items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove("up");
              }}
              disabled={index === 0}
              className="text-slate-300 hover:text-slate-700 disabled:opacity-40 leading-none text-[10px]"
              aria-label="Move up"
            >
              ▲
            </button>
            <GripVertical className="w-3 h-3 text-slate-300 my-0.5" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove("down");
              }}
              disabled={index === total - 1}
              className="text-slate-300 hover:text-slate-700 disabled:opacity-40 leading-none text-[10px]"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
          <div className="flex-1 min-w-0">
            {/* Label row + meta badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium text-slate-900">
                {field.label || "Untitled"}
              </span>
              {field.required && (
                <span className="text-[13px] text-rose-600">*</span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                · {typeLabel}
              </span>
              {field.mapTo && (
                <span className="text-[10px] uppercase tracking-wider text-[#a8893a]">
                  → {field.mapTo}
                </span>
              )}
              {field.showWhen && (
                <span className="text-[10px] uppercase tracking-wider text-blue-600">
                  conditional
                </span>
              )}
            </div>
            {/* WYSIWYG preview of the actual input. Mirrors what the
                public form viewer renders so the editor judges the
                form as a submitter would. */}
            <div className="mt-1.5">
              <FieldPreviewControl field={field} />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
              title="Duplicate field"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
              title="Delete field"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Editor (expanded when active) */}
      {isActive && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3 bg-slate-50/40">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                Label
              </Label>
              <Input
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="What's the prompt?"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                Type
              </Label>
              <Select
                value={field.type}
                onValueChange={(v) =>
                  onUpdate({
                    type: v as FormFieldType,
                    // When switching to SELECT/MULTI_SELECT, seed
                    // options. Otherwise clear them.
                    options:
                      v === "SELECT" || v === "MULTI_SELECT"
                        ? field.options && field.options.length > 0
                          ? field.options
                          : ["Option 1"]
                        : undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="inline-flex items-center gap-1.5">
                        {o.icon}
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {field.type !== "HEADING" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                    Placeholder
                  </Label>
                  <Input
                    value={field.placeholder || ""}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    placeholder="Hint text"
                  />
                </div>
                {field.type === "NUMBER" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                      Unit (optional)
                    </Label>
                    <Input
                      value={field.unit || ""}
                      onChange={(e) => onUpdate({ unit: e.target.value })}
                      placeholder="kg, m², $, hours…"
                    />
                  </div>
                )}
                {field.type === "ATTACHMENT" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                      Accept types
                    </Label>
                    <Input
                      value={(field.accept || []).join(", ")}
                      onChange={(e) =>
                        onUpdate({
                          accept: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="image/*, application/pdf"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                  Help text
                </Label>
                <Input
                  value={field.helpText || ""}
                  onChange={(e) => onUpdate({ helpText: e.target.value })}
                  placeholder="Short explanation shown under the field"
                />
              </div>

              {(field.type === "SELECT" || field.type === "MULTI_SELECT") && (
                <OptionsEditor
                  options={field.options || []}
                  onChange={(opts) => onUpdate({ options: opts })}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`req-${field.id}`}
                    checked={field.required}
                    onCheckedChange={(c) => onUpdate({ required: c })}
                  />
                  <Label htmlFor={`req-${field.id}`} className="text-[12px]">
                    Required
                  </Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-slate-500">
                    Maps to Task field
                  </Label>
                  <Select
                    value={field.mapTo || "__none__"}
                    onValueChange={(v) =>
                      onUpdate({
                        mapTo: v === "__none__" ? undefined : (v as FormFieldMapTo),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAP_TO_OPTIONS.map((o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          disabled={
                            o.value === "dueDate" && field.type !== "DATE"
                          }
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Branching — only available when there's a SELECT or
                  MULTI_SELECT field BEFORE this one to depend on. */}
              <BranchingEditor
                previousFields={previousFields.filter(
                  (f) => f.type === "SELECT" || f.type === "MULTI_SELECT"
                )}
                showWhen={field.showWhen}
                onChange={(rule) => onUpdate({ showWhen: rule })}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-slate-500">
        Options
      </Label>
      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={opt}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={`Option ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((_, k) => k !== i))}
              className="p-1 text-slate-400 hover:text-rose-600"
              disabled={options.length <= 1}
              aria-label="Remove option"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add option
      </Button>
    </div>
  );
}

function BranchingEditor({
  previousFields,
  showWhen,
  onChange,
}: {
  previousFields: FormField[];
  showWhen?: FormFieldShowWhen;
  onChange: (rule: FormFieldShowWhen | undefined) => void;
}) {
  const hasCandidates = previousFields.length > 0;
  return (
    <div className="border border-dashed border-slate-300 rounded-md p-3 bg-white">
      <Label className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5 block">
        Conditional visibility
      </Label>
      {!hasCandidates ? (
        <p className="text-[12px] text-slate-400 italic">
          Add a Dropdown or Multi-select field above to enable branching for
          this field.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id={`branch-toggle-${previousFields[0].id}`}
              checked={!!showWhen}
              onCheckedChange={(c) => {
                if (!c) onChange(undefined);
                else {
                  const first = previousFields[0];
                  onChange({
                    fieldId: first.id,
                    equals: first.options?.[0] ?? "",
                  });
                }
              }}
            />
            <span className="text-[12px] text-slate-700">
              Only show this field when…
            </span>
          </div>
          {showWhen && (
            <div className="flex flex-wrap items-center gap-2 pl-8 text-[12px]">
              <Select
                value={showWhen.fieldId}
                onValueChange={(v) => {
                  const f = previousFields.find((x) => x.id === v);
                  onChange({
                    fieldId: v,
                    equals: f?.options?.[0] ?? "",
                  });
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {previousFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-slate-500">equals</span>
              <Select
                value={
                  Array.isArray(showWhen.equals)
                    ? showWhen.equals[0] || ""
                    : showWhen.equals
                }
                onValueChange={(v) =>
                  onChange({ fieldId: showWhen.fieldId, equals: v })
                }
              >
                <SelectTrigger className="w-[180px] h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    previousFields.find((f) => f.id === showWhen.fieldId)
                      ?.options || []
                  ).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FIELD PREVIEW — read-only WYSIWYG render of a field as the
// public form viewer would show it. Matches Asana's left-panel
// preview behavior (label on top, real input below). Inputs are
// disabled because this is preview, not data capture.
// ─────────────────────────────────────────────────────────────────

function FieldPreviewControl({ field }: { field: FormField }) {
  // Headings render as a section divider — no input
  if (field.type === "HEADING") {
    return (
      <div className="text-[15px] font-semibold text-slate-800 border-b border-slate-200 pb-1.5">
        {field.label || "Section"}
      </div>
    );
  }

  const placeholder =
    field.type === "EMAIL"
      ? "name@example.com"
      : field.type === "NUMBER"
        ? "0"
        : field.type === "TEXTAREA"
          ? "Your answer…"
          : field.type === "PEOPLE"
            ? "Search for a person…"
            : "Your answer";

  if (field.type === "TEXTAREA") {
    return (
      <textarea
        disabled
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-md text-slate-400 cursor-pointer resize-none"
      />
    );
  }

  if (field.type === "SELECT") {
    return (
      <div className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-md text-slate-400 cursor-pointer flex items-center justify-between">
        <span>Choose an option…</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (field.type === "MULTI_SELECT") {
    const opts = (field.options ?? []).slice(0, 3);
    return (
      <div className="space-y-1.5">
        {opts.length > 0 ? (
          opts.map((opt, i) => (
            <label
              key={i}
              className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer"
            >
              <input
                type="checkbox"
                disabled
                className="rounded border-slate-300"
              />
              {opt}
            </label>
          ))
        ) : (
          <span className="text-[12px] text-slate-400">
            Add options in the editor below
          </span>
        )}
      </div>
    );
  }

  if (field.type === "ATTACHMENT") {
    return (
      <div className="w-full px-3 py-4 text-[13px] bg-slate-50 border border-dashed border-slate-300 rounded-md text-slate-500 cursor-pointer text-center">
        <span className="inline-flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Click to upload or drag a file here
        </span>
      </div>
    );
  }

  if (field.type === "DATE") {
    return (
      <div className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-md text-slate-400 cursor-pointer flex items-center justify-between">
        <span>mm / dd / yyyy</span>
        <Calendar className="h-3.5 w-3.5" />
      </div>
    );
  }

  // TEXT, EMAIL, NUMBER, PEOPLE — single-line inputs
  return (
    <input
      disabled
      placeholder={placeholder}
      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-md text-slate-400 cursor-pointer"
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────────────────

function SettingsTab(props: {
  sections: ProjectSection[];
  members: ProjectMember[];
  defaultSectionId: string | null;
  setDefaultSectionId: (v: string | null) => void;
  defaultAssigneeId: string | null;
  setDefaultAssigneeId: (v: string | null) => void;
  confirmationMessage: string;
  setConfirmationMessage: (v: string) => void;
  notifyOnSubmission: boolean;
  setNotifyOnSubmission: (v: boolean) => void;
  visibility: "PUBLIC" | "ORGANIZATION";
  setVisibility: (v: "PUBLIC" | "ORGANIZATION") => void;
}) {
  const {
    sections,
    members,
    defaultSectionId,
    setDefaultSectionId,
    defaultAssigneeId,
    setDefaultAssigneeId,
    confirmationMessage,
    setConfirmationMessage,
    notifyOnSubmission,
    setNotifyOnSubmission,
    visibility,
    setVisibility,
  } = props;
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm">Default section</Label>
        <Select
          value={defaultSectionId ?? "__first__"}
          onValueChange={(v) =>
            setDefaultSectionId(v === "__first__" ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__first__">
              First section of the project
            </SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500">
          Where new submission-tasks land. Falls back to the first section
          if the chosen one is later deleted.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Default assignee</Label>
        <Select
          value={defaultAssigneeId ?? "__unassigned__"}
          onValueChange={(v) =>
            setDefaultAssigneeId(v === "__unassigned__" ? null : v)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.email || "Member"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500">
          Auto-assigned on every new submission-task. The assignee also
          gets the submission email when notifications are on.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Visibility</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility("PUBLIC")}
            className={cn(
              "border rounded-md px-3 py-2.5 text-left text-[12px] flex items-start gap-2",
              visibility === "PUBLIC"
                ? "border-black bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <Globe className="w-4 h-4 text-slate-500 mt-px flex-shrink-0" />
            <span>
              <div className="font-medium text-slate-900">Public link</div>
              <div className="text-slate-500">
                Anyone with the URL can submit (clients, contractors).
              </div>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("ORGANIZATION")}
            className={cn(
              "border rounded-md px-3 py-2.5 text-left text-[12px] flex items-start gap-2",
              visibility === "ORGANIZATION"
                ? "border-black bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <Lock className="w-4 h-4 text-slate-500 mt-px flex-shrink-0" />
            <span>
              <div className="font-medium text-slate-900">Organization only</div>
              <div className="text-slate-500">
                Sign-in required — only workspace members can submit.
              </div>
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Confirmation message</Label>
        <Textarea
          value={confirmationMessage}
          onChange={(e) => setConfirmationMessage(e.target.value)}
          rows={3}
          placeholder="Shown to the submitter after they hit Submit. Leave empty for the default."
          className="resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border rounded-md p-3 bg-slate-50/40">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-slate-900">
            Email me on new submissions
          </p>
          <p className="text-[12px] text-slate-500">
            Sends the form owner + default assignee an email each time the
            form is submitted, with a preview of the answers.
          </p>
        </div>
        <Switch
          checked={notifyOnSubmission}
          onCheckedChange={setNotifyOnSubmission}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHARE TAB
// ─────────────────────────────────────────────────────────────────

function ShareTab({
  publicUrl,
  embedSnippet,
  visibility,
}: {
  publicUrl: string;
  embedSnippet: string;
  visibility: "PUBLIC" | "ORGANIZATION";
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm">Public link</Label>
        <div className="flex gap-2">
          <Input value={publicUrl} readOnly className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link copied");
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        {visibility === "ORGANIZATION" && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Visibility is set to Organization. People who follow this link
            must sign in with a workspace account before they can submit.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Embed on your site</Label>
        <Textarea
          value={embedSnippet}
          readOnly
          rows={3}
          className="font-mono text-[11px] resize-none"
        />
        <p className="text-[11px] text-slate-500">
          Drop this iframe snippet into any website. The form will render
          in embed mode without the BuildSync chrome.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(embedSnippet);
            toast.success("Embed snippet copied");
          }}
        >
          <Copy className="w-3.5 h-3.5 mr-1" />
          Copy embed
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TEMPLATE PICKER  (new-form onboarding)
// ─────────────────────────────────────────────────────────────────

const TEMPLATE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  HelpCircle,
  FilePenLine,
  ShieldCheck,
  BadgeCheck,
  FileText,
  Inbox: FileText, // fallback
};

const TEMPLATE_ACCENT: Record<string, string> = {
  amber: "bg-[#fbeed3]/60 border-[#e9d287] text-[#7a5b1b]",
  blue: "bg-[#e1eefc]/60 border-[#bcd6f3] text-[#274a73]",
  violet: "bg-[#ece4f7]/60 border-[#d3c1ee] text-[#4f3a7a]",
  rose: "bg-[#fce4e4]/60 border-[#f1b8b8] text-[#a8323a]",
  emerald: "bg-[#dff1e6]/60 border-[#bce0c9] text-[#1d6b3e]",
  slate: "bg-slate-100 border-slate-300 text-slate-700",
};

function TemplatePicker({
  onPick,
  onSkip,
}: {
  onPick: (template: FormTemplate) => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-600 max-w-prose">
          A form turns an external request (RFI, change order, inspection,
          etc.) into a task inside this project — automatically assigned and
          logged. Pick a template to jumpstart, or start from scratch.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FORM_TEMPLATES.filter((t) => t.id !== "blank").map((template) => {
          const Icon = TEMPLATE_ICON[template.icon] || FileText;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template)}
              className="text-left border rounded-lg p-3 hover:border-slate-400 hover:shadow-sm transition-all bg-white"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border",
                    TEMPLATE_ACCENT[template.accent] || TEMPLATE_ACCENT.slate
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 leading-tight">
                    {template.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    {template.blurb}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {template.fields.length} field
                    {template.fields.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="pt-2 border-t flex items-center justify-between">
        <p className="text-[12px] text-slate-500">
          You can change anything after picking a template.
        </p>
        <Button variant="outline" size="sm" onClick={onSkip}>
          Start from scratch
        </Button>
      </div>
    </div>
  );
}
