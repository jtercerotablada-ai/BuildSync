"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  LayoutGrid,
  List,
  ChevronDown,
  Trash2,
  MoreHorizontal,
  Pencil,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SectionGuard } from "@/components/access/section-guard";

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  iconColor: string;
  ownerName: string;
  ownerColor: string;
  isDefault?: boolean;
  createdAt: string;
}

const DEFAULT_DASHBOARDS: Dashboard[] = [
  {
    id: "my-organization",
    name: "My organization",
    description: "Organization-wide metrics",
    iconColor: "#000000",
    ownerName: "You",
    ownerColor: "#000000",
    isDefault: true,
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: "my-impact",
    name: "My impact",
    description: "See your work impact here",
    iconColor: "#000000",
    ownerName: "You",
    ownerColor: "#000000",
    isDefault: true,
    createdAt: "1970-01-01T00:00:00.000Z",
  },
];

const COLORS = ["#000000", "#c9a84c", "#a8893a", "#c9a84c", "#0a0a0a", "#a8893a", "#a8893a"];

export default function ReportingPage() {
  return (
    <SectionGuard section="reporting">
      <ReportingPageInner />
    </SectionGuard>
  );
}

function ReportingPageInner() {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dashboards, setDashboards] = useState<Dashboard[]>(DEFAULT_DASHBOARDS);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Dashboard | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    iconColor: COLORS[0],
  });

  // Load dashboards from API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboards");
        if (res.ok && !cancelled) {
          const data = await res.json();
          const ownerName = session?.user?.name || "You";
          const remote: Dashboard[] = data.map((d: {
            id: string;
            name: string;
            description: string | null;
            iconColor: string;
            createdAt: string;
            owner: { name: string | null; email: string };
          }) => ({
            id: d.id,
            name: d.name,
            description: d.description || undefined,
            iconColor: d.iconColor || "#000000",
            ownerName: d.owner.name || d.owner.email || ownerName,
            ownerColor: d.iconColor || "#000000",
            createdAt: d.createdAt,
          }));
          setDashboards([...DEFAULT_DASHBOARDS, ...remote]);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.name]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      iconColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreateOpen(true);
  }

  function openEdit(dashboard: Dashboard) {
    setEditing(dashboard);
    setForm({
      name: dashboard.name,
      description: dashboard.description || "",
      iconColor: dashboard.iconColor,
    });
    setCreateOpen(true);
  }

  async function handleSubmit() {
    const name = form.name.trim();
    if (!name) return;

    try {
      if (editing) {
        const res = await fetch(`/api/dashboards/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: form.description.trim() || null,
            iconColor: form.iconColor,
          }),
        });
        if (!res.ok) throw new Error();
        setDashboards((prev) =>
          prev.map((d) =>
            d.id === editing.id
              ? {
                  ...d,
                  name,
                  description: form.description.trim() || undefined,
                  iconColor: form.iconColor,
                  ownerColor: form.iconColor,
                }
              : d
          )
        );
        toast.success("Dashboard updated");
      } else {
        const res = await fetch("/api/dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: form.description.trim() || undefined,
            iconColor: form.iconColor,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create");
        }
        const created = await res.json();
        const ownerName = session?.user?.name || "You";
        const newDashboard: Dashboard = {
          id: created.id,
          name: created.name,
          description: created.description || undefined,
          iconColor: created.iconColor || "#000000",
          ownerName,
          ownerColor: created.iconColor || "#000000",
          createdAt: created.createdAt,
        };
        setDashboards((prev) => [
          ...prev.filter((d) => d.isDefault),
          newDashboard,
          ...prev.filter((d) => !d.isDefault),
        ]);
        toast.success(`Dashboard "${name}" created`);
      }
      setCreateOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this dashboard?")) return;
    try {
      const res = await fetch(`/api/dashboards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDashboards((prev) => prev.filter((d) => d.id !== id));
      toast.success("Dashboard deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  // Resolve display owner for default dashboards
  const dashboardsForRender = dashboards.map((d) =>
    d.isDefault && session?.user?.name
      ? { ...d, ownerName: session.user.name }
      : d
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900">Reporting</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 md:px-6 border-b">
        <span className="inline-block px-3 md:px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-slate-900">
          Dashboards
        </span>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b gap-2">
        <Button
          onClick={openCreate}
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Create</span>
        </Button>

        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "grid"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === "list"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            )}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-8">
          <button
            onClick={() => setRecentCollapsed(!recentCollapsed)}
            className="flex items-center gap-2 text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wide mb-4 hover:text-slate-700"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                recentCollapsed && "-rotate-90"
              )}
            />
            Dashboards
          </button>

          {!recentCollapsed && (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {/* Create Dashboard Card */}
                  <button
                    onClick={openCreate}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[140px] md:min-h-[160px]"
                  >
                    <Plus className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">
                      Create dashboard
                    </span>
                  </button>

                  {/* Dashboard Cards */}
                  {dashboardsForRender.map((dashboard) => (
                    <div key={dashboard.id} className="relative group">
                      <Link
                        href={`/reporting/${dashboard.id}`}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white min-h-[140px] md:min-h-[160px] flex flex-col"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: dashboard.iconColor }}
                          >
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 truncate group-hover:text-black transition-colors">
                              {dashboard.name}
                            </h3>
                          </div>
                        </div>

                        {dashboard.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-auto break-words">
                            {dashboard.description}
                          </p>
                        )}

                        <div className="mt-auto pt-4 flex items-center gap-2 min-w-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0"
                            style={{ backgroundColor: dashboard.ownerColor }}
                          >
                            {dashboard.ownerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-500 truncate">
                            Owned by {dashboard.ownerName}
                          </span>
                        </div>
                      </Link>
                      {!dashboard.isDefault && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <button className="p-1 bg-white rounded shadow hover:bg-slate-50">
                                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(dashboard)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-black"
                                onClick={() => handleDelete(dashboard.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete dashboard
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg divide-y bg-white">
                  {dashboardsForRender.map((dashboard) => (
                    <div
                      key={dashboard.id}
                      className="flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-slate-50 transition-colors group"
                    >
                      <Link
                        href={`/reporting/${dashboard.id}`}
                        className="flex items-center gap-3 md:gap-4 flex-1 min-w-0"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                          style={{ backgroundColor: dashboard.iconColor }}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-900 truncate text-sm md:text-base">
                            {dashboard.name}
                          </h3>
                          {dashboard.description && (
                            <p className="text-xs text-slate-500 truncate">
                              {dashboard.description}
                            </p>
                          )}
                        </div>
                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                            style={{ backgroundColor: dashboard.ownerColor }}
                          >
                            {dashboard.ownerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-500 truncate max-w-[120px]">
                            {dashboard.ownerName}
                          </span>
                        </div>
                      </Link>
                      {!dashboard.isDefault && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 hover:bg-slate-100 rounded flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4 text-slate-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(dashboard)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-black"
                              onClick={() => handleDelete(dashboard.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete dashboard
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Dashboard Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit dashboard" : "Create dashboard"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dash-name">
                Dashboard name <span className="text-black">*</span>
              </Label>
              <Input
                id="dash-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Q1 metrics"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-desc">Description (optional)</Label>
              <Textarea
                id="dash-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this dashboard track?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, iconColor: color })}
                    className={cn(
                      "w-8 h-8 rounded-lg transition-all",
                      form.iconColor === color
                        ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                        : "hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!form.name.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              {editing ? "Save changes" : "Create dashboard"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
