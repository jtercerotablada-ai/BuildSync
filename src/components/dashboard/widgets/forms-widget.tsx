'use client';

/**
 * FormsWidget — home dashboard tile.
 *
 * Reads from /api/forms (workspace-scoped list). Click on a form row
 * opens the FormBuilderDialog INLINE on the Home page — the user
 * never has to leave the dashboard to edit a form. Saves persist
 * via /api/projects/[projectId]/forms/[formId], so edits made here
 * are immediately visible in the project's Workflow tab (the two
 * surfaces are connected to the same Form record).
 *
 * The "+ New form" CTA opens a project picker first (forms belong
 * to a project) and then routes to the project's Workflow tab in
 * create mode — new forms need a project context to live in. Edits
 * can happen from either place after creation.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { FormBuilderDialog } from '@/components/views/form-builder-dialog';
import type { FormRow as FullFormRow } from '@/lib/form-types';

interface FormRow {
  id: string;
  name: string;
  projectName: string;
  responsesCount: number;
  /** Unread inbox notifications for this form for the current user.
   *  Drives the gold "N new" pill. Clears when the inbox row is
   *  marked read or archived. */
  newCount?: number;
  isActive?: boolean;
  /** Project id (used to deep-link to the Workflow tab). */
  projectId?: string;
}

interface Project {
  id: string;
  name: string;
  color?: string;
}

export function FormsWidget() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  // Inline edit dialog state — opening a form from the widget now
  // pops the FormBuilderDialog right on the Home page so the user
  // never leaves the dashboard context. Saves persist to the same
  // Form record the Workflow tab edits.
  const [editingForm, setEditingForm] = useState<FullFormRow | null>(null);
  const [editingFetching, setEditingFetching] = useState<string | null>(null);
  // Create-inline state — clicking "+ New form" and picking a
  // project opens the builder INLINE on Home (same dialog the
  // Workflow tab uses). Previously this routed the user away to
  // /projects/[id]?view=workflow&form=new, which broke the
  // "edit & create from either surface" promise.
  const [creatingForProjectId, setCreatingForProjectId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch('/api/forms?limit=20');
        if (res.ok && !cancelled) {
          const data = (await res.json()) as FormRow[];
          setForms(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch forms:', err);
      } finally {
        if (showSpinner && !cancelled) setLoading(false);
      }
    };

    // Initial fetch shows the spinner; polls do not (silent refresh).
    void load(true);

    // Refresh the "N new" badge every 30s while visible — same
    // cadence as the inbox so the two stay in sync. Pauses on
    // tab-hidden to keep idle costs near-zero.
    const tick = () => {
      if (document.hidden) return;
      void load(false);
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(tick, 30000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Lazy-load projects only when the user opens the "New form" picker
  // — most home loads never need this list.
  useEffect(() => {
    if (!showProjectPicker || projects.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok && !cancelled) {
          const data = (await res.json()) as Project[];
          setProjects(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showProjectPicker, projects.length]);

  async function openFormInline(form: FormRow) {
    if (!form.projectId) {
      // No project context — fall back to the public preview.
      router.push(`/forms/${form.id}`);
      return;
    }
    // Fetch the full Form record (the widget list only has summary
    // fields) and open the builder dialog inline.
    setEditingFetching(form.id);
    try {
      const res = await fetch(`/api/forms/${form.id}?settings=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const full = (await res.json()) as FullFormRow;
      setEditingForm(full);
    } catch (err) {
      console.error('Failed to fetch form:', err);
      toast.error("Couldn't open the form. Try again.");
    } finally {
      setEditingFetching(null);
    }
  }

  function startNewForm(projectId: string) {
    // Open the FormBuilderDialog inline on Home (no redirect). The
    // dialog will POST to /api/forms with this projectId on save and
    // the new form will appear in BOTH this widget AND the project's
    // Workflow tab — same Form record either way.
    setShowProjectPicker(false);
    setCreatingForProjectId(projectId);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Title + ⋯ menu provided by WidgetContainer. */}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : forms.length === 0 ? (
        // Educational empty state — most users have never used a Forms
        // feature before. Concrete examples teach what it's for.
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4 px-2">
          <div className="relative mb-3">
            <div className="w-12 h-14 border-2 border-gray-200 rounded-lg flex items-end justify-center pb-1.5">
              <div className="w-6 h-1.5 bg-gray-200 rounded" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">
            Turn requests into tasks
          </p>
          <p className="text-xs text-gray-500 mb-3 max-w-[280px] leading-snug">
            Build an intake form, share its public link with clients or
            contractors. Each submission auto-creates a task in the
            project — assigned, scheduled, ready.
          </p>
          <ul className="text-[11px] text-gray-600 space-y-0.5 mb-3 inline-block text-left">
            <li>· RFI Request</li>
            <li>· Change Order</li>
            <li>· Inspection Request</li>
            <li>· Recertification Intake</li>
          </ul>
          <DropdownMenu
            open={showProjectPicker}
            onOpenChange={setShowProjectPicker}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Create your first form
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  Create a project first — forms belong to a project.
                </div>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b">
                    Pick a project for the form
                  </div>
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => startNewForm(p.id)}
                      className="cursor-pointer"
                    >
                      <span
                        className="h-3 w-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: p.color || '#c9a84c' }}
                      />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto -mx-1">
          <ul className="space-y-1.5 px-1">
            {forms.map((form) => (
              <li key={form.id}>
                <button
                  type="button"
                  onClick={() => openFormInline(form)}
                  disabled={editingFetching === form.id}
                  className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center justify-between gap-3 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {editingFetching === form.id ? (
                      <Loader2 className="h-4 w-4 text-gray-400 flex-shrink-0 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {form.name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {form.projectName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(form.newCount ?? 0) > 0 && (
                      <span
                        className="bg-[#a8893a] text-white text-[10px] leading-none px-1.5 py-[3px] rounded-full min-w-[20px] text-center font-semibold"
                        title={`${form.newCount} new submission${(form.newCount ?? 0) === 1 ? '' : 's'} — open the inbox to clear`}
                      >
                        {form.newCount} new
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 tabular-nums">
                      {form.responsesCount}{' '}
                      {form.responsesCount === 1 ? 'response' : 'responses'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {/* "+ New form" footer link */}
          <DropdownMenu
            open={showProjectPicker}
            onOpenChange={setShowProjectPicker}
          >
            <DropdownMenuTrigger asChild>
              <button className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors">
                <Plus className="h-4 w-4" />
                New form
                <ChevronDown className="h-3.5 w-3.5 ml-auto" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  No projects yet
                </div>
              ) : (
                projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => startNewForm(p.id)}
                    className="cursor-pointer"
                  >
                    <span
                      className="h-3 w-3 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: p.color || '#c9a84c' }}
                    />
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Inline form editor — opens when the user clicks a form row.
          Saves persist via the dialog's own PATCH to /api/projects/
          [id]/forms/[formId], so the project's Workflow tab shows
          the same edits next time it's opened. */}
      {editingForm && (
        <FormBuilderDialog
          open={!!editingForm}
          onOpenChange={(open) => {
            if (!open) setEditingForm(null);
          }}
          projectId={editingForm.projectId}
          initial={editingForm}
          onSaved={(saved) => {
            // Update the local list so the row reflects the new name/
            // active state without a full refetch.
            setForms((prev) =>
              prev.map((f) =>
                f.id === saved.id
                  ? { ...f, name: saved.name, isActive: saved.isActive }
                  : f
              )
            );
            setEditingForm(null);
          }}
        />
      )}

      {/* Inline form CREATE — opens when the user picks a project
          from the "+ New form" dropdown. Same FormBuilderDialog the
          Workflow tab uses (no initial → create mode). On save the
          new form gets prepended to the widget list so it's visible
          immediately without a refetch. The form also shows up in
          the project's Workflow tab because both surfaces read from
          the same Form record. */}
      {creatingForProjectId && (
        <FormBuilderDialog
          open={!!creatingForProjectId}
          onOpenChange={(open) => {
            if (!open) setCreatingForProjectId(null);
          }}
          projectId={creatingForProjectId}
          initial={null}
          onSaved={(saved) => {
            const proj = projects.find((p) => p.id === creatingForProjectId);
            setForms((prev) => [
              {
                id: saved.id,
                name: saved.name,
                projectId: creatingForProjectId,
                projectName: proj?.name || '',
                responsesCount: 0,
                isActive: saved.isActive ?? true,
                newCount: 0,
              },
              ...prev,
            ]);
            setCreatingForProjectId(null);
            toast.success('Form created');
          }}
        />
      )}
    </div>
  );
}
