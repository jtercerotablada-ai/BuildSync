"use client";

import { useState, useEffect } from "react";
import { Plus, LayoutGrid, List, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  iconColor: string;
  ownerId: string;
  ownerName: string;
  ownerColor: string;
  isDefault?: boolean;
  createdAt: Date;
}

const DEFAULT_DASHBOARDS: Dashboard[] = [
  {
    id: "my-organization",
    name: "My organization",
    description: "Organization-wide metrics",
    iconColor: "#000000",
    ownerId: "current-user",
    ownerName: "You",
    ownerColor: "#000000",
    isDefault: true,
    createdAt: new Date(),
  },
  {
    id: "my-impact",
    name: "My impact",
    description: "See your work impact here",
    iconColor: "#000000",
    ownerId: "current-user",
    ownerName: "You",
    ownerColor: "#000000",
    isDefault: true,
    createdAt: new Date(),
  },
];

const COLORS = ["#000000", "#4573D2", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2"];

export default function ReportingPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dashboards, setDashboards] = useState<Dashboard[]>(DEFAULT_DASHBOARDS);
  const [recentCollapsed, setRecentCollapsed] = useState(false);

  // Load dashboards from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("buildsync-dashboards");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDashboards([...DEFAULT_DASHBOARDS, ...parsed]);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save custom dashboards to localStorage
  function saveDashboards(all: Dashboard[]) {
    const custom = all.filter((d) => !d.isDefault);
    localStorage.setItem("buildsync-dashboards", JSON.stringify(custom));
  }

  const handleCreateDashboard = () => {
    const name = prompt("Dashboard name:", "New dashboard");
    if (!name?.trim()) return;

    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      name: name.trim(),
      iconColor: color,
      ownerId: "current-user",
      ownerName: "You",
      ownerColor: color,
      createdAt: new Date(),
    };
    const updated = [newDashboard, ...dashboards];
    setDashboards(updated);
    saveDashboards(updated);
    toast.success(`Dashboard "${name.trim()}" created`);
  };

  const handleDeleteDashboard = (id: string) => {
    const updated = dashboards.filter((d) => d.id !== id);
    setDashboards(updated);
    saveDashboards(updated);
    toast.success("Dashboard deleted");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-slate-900">Reporting</h1>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b">
        <span className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-slate-900">
          Dashboards
        </span>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <Button
          onClick={handleCreateDashboard}
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create
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
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Section: Recent */}
        <div className="mb-8">
          <button
            onClick={() => setRecentCollapsed(!recentCollapsed)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wide mb-4 hover:text-slate-700"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                recentCollapsed && "-rotate-90"
              )}
            />
            Recent
          </button>

          {!recentCollapsed && (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {/* Create Dashboard Card */}
                  <button
                    onClick={handleCreateDashboard}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center min-h-[160px]"
                  >
                    <Plus className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">
                      Create dashboard
                    </span>
                  </button>

                  {/* Dashboard Cards */}
                  {dashboards.map((dashboard) => (
                    <div key={dashboard.id} className="relative group">
                      <Link
                        href={`/reporting/${dashboard.id}`}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white min-h-[160px] flex flex-col"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                            style={{ backgroundColor: dashboard.iconColor }}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 truncate group-hover:text-black transition-colors">
                              {dashboard.name}
                            </h3>
                          </div>
                        </div>

                        {dashboard.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-auto">
                            {dashboard.description}
                          </p>
                        )}

                        <div className="mt-auto pt-4 flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                            style={{ backgroundColor: dashboard.ownerColor }}
                          >
                            {dashboard.ownerName.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-500">
                            Owned by {dashboard.ownerName.toLowerCase()}
                          </span>
                        </div>
                      </Link>
                      {!dashboard.isDefault && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <button className="p-1 bg-white rounded shadow hover:bg-slate-50">
                                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDashboard(dashboard.id)}>
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
                <div className="border rounded-lg divide-y">
                  {dashboards.map((dashboard) => (
                    <Link
                      key={dashboard.id}
                      href={`/reporting/${dashboard.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: dashboard.iconColor }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900">
                          {dashboard.name}
                        </h3>
                        {dashboard.description && (
                          <p className="text-xs text-slate-500">
                            {dashboard.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                          style={{ backgroundColor: dashboard.ownerColor }}
                        >
                          {dashboard.ownerName.charAt(0)}
                        </div>
                        <span className="text-xs text-slate-500">
                          Owned by {dashboard.ownerName.toLowerCase()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
