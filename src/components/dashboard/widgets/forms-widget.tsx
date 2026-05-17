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
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/forms?limit=20');
        if (res.ok && !cancelled) {
          const data = (await res.json()) as FormRow[];
          setForms(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch forms:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="relative mb-3">
            <div className="w-12 h-14 border-2 border-gray-200 rounded-lg flex items-end justify-center pb-1.5">
              <div className="w-6 h-1.5 bg-gray-200 rounded" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No forms yet</p>
          <p className="text-xs text-gray-500 mb-3 max-w-[260px]">
            Create an intake form to turn requests into project tasks
            automatically.
          </p>
          <DropdownMenu
            open={showProjectPicker}
            onOpenChange={setShowProjectPicker}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New form
              </Button>
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
                  <span className="text-[11px] text-gray-500 tabular-nums flex-shrink-0">
                    {form.responsesCount}{' '}
                    {form.responsesCount === 1 ? 'response' : 'responses'}
                  </span>
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
