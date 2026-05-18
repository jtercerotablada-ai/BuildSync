'use client';

/**
 * FormsWidget — home dashboard tile.
 *
 * Reads from /api/forms (workspace-scoped list). Each row deep-links
 * to the form's PROJECT Workflow tab with `?form=<id>` so the unified
 * Form Builder opens for inspection/edit. The "+ New form" CTA opens
 * the project picker first (since a form belongs to a project) and
 * then routes to that project's Workflow tab with `?form=new`.
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

  function openFormInWorkflow(form: FormRow) {
    if (!form.projectId) {
      // Fallback: hit the public form when we don't know the project.
      router.push(`/forms/${form.id}`);
      return;
    }
    router.push(
      `/projects/${form.projectId}?view=workflow&form=${form.id}`
    );
  }

  function startNewForm(projectId: string) {
    router.push(`/projects/${projectId}?view=workflow&form=new`);
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
                  onClick={() => openFormInWorkflow(form)}
                  className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
    </div>
  );
}
