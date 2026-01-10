"use client";

import { useState } from "react";
import { Plus, LayoutGrid, List, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

export default function ReportingPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dashboards, setDashboards] = useState<Dashboard[]>([
    {
      id: "my-organization",
      name: "My organization",
      description: "Organization-wide metrics",
      iconColor: "#3B82F6",
      ownerId: "current-user",
      ownerName: "You",
      ownerColor: "#FBBF24",
      isDefault: true,
      createdAt: new Date(),
    },
    {
      id: "my-impact",
      name: "My impact",
      description: "See your work impact here",
      iconColor: "#8B5CF6",
      ownerId: "current-user",
      ownerName: "You",
      ownerColor: "#FBBF24",
      isDefault: true,
      createdAt: new Date(),
    },
  ]);
  const [recentCollapsed, setRecentCollapsed] = useState(false);

  const handleCreateDashboard = () => {
    const newDashboard: Dashboard = {
      id: `dashboard-${Date.now()}`,
      name: "New dashboard",
      iconColor: "#8B5CF6",
      ownerId: "current-user",
      ownerName: "You",
      ownerColor: "#FBBF24",
      createdAt: new Date(),
    };
    setDashboards([newDashboard, ...dashboards]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-slate-900">Reporting</h1>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b">
        <button className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-slate-900">
          Dashboards
        </button>
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
                    <Link
                      key={dashboard.id}
                      href={`/reporting/${dashboard.id}`}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white min-h-[160px] flex flex-col group"
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
                          <h3 className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
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
