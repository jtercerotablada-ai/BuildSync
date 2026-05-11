"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { QuickCreateTaskModal } from "@/components/tasks/quick-create-task-modal";
import { CreateObjectiveDialog } from "@/components/goals/create-objective-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AIPanelProvider, useAIPanel } from "@/contexts/ai-panel-context";
import { AIPanel } from "@/components/ai/ai-panel";
import { SearchDialog } from "./search-dialog";
import { MobileBottomNav } from "./mobile-bottom-nav";

const SIDEBAR_STORAGE_KEY = "buildsync.sidebarCollapsed";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface DashboardShellProps {
  children: ReactNode;
  variant?: "default" | "ttc";
  basePath?: string;
}

function DashboardShellContent({ children, variant = "default", basePath = "" }: DashboardShellProps) {
  const router = useRouter();
  const { isOpen: isAIPanelOpen, closePanel: closeAIPanel } = useAIPanel();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showQuickCreateTask, setShowQuickCreateTask] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  // Start collapsed on both server and client to avoid hydration mismatch.
  // After mount, restore the user's preference or auto-collapse on mobile.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // On mobile, always start collapsed regardless of saved preference
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarCollapsed(true);
      return;
    }

    // Try API first (DB-persisted), fall back to localStorage
    (async () => {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok) {
          const prefs = await res.json();
          const ui = prefs.uiState as { sidebarCollapsed?: boolean } | null;
          if (ui && typeof ui.sidebarCollapsed === "boolean") {
            setSidebarCollapsed(ui.sidebarCollapsed);
            return;
          }
        }
      } catch {
        // network error — fall through to localStorage
      }

      try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        setSidebarCollapsed(stored === "true");
      } catch {
        setSidebarCollapsed(false);
      }
    })();
  }, []);

  // Portfolio creation state
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ name: "", description: "" });

  // Persist sidebar state to BOTH localStorage (offline) and DB (cross-device)
  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {}
      // Fire-and-forget API save
      fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiState: { sidebarCollapsed: next } }),
      }).catch(() => { /* ignore */ });
      return next;
    });
  }

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreatePortfolio() {
    if (!newPortfolio.name.trim()) return;

    setCreatingPortfolio(true);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPortfolio),
      });

      if (res.ok) {
        const portfolio = await res.json();
        setShowCreatePortfolio(false);
        setNewPortfolio({ name: "", description: "" });
        router.push(`${basePath}/portfolios/${portfolio.id}`);
      }
    } catch (error) {
      console.error("Error creating portfolio:", error);
    } finally {
      setCreatingPortfolio(false);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Full-width topbar strip */}
      <Header
        onCreateTask={() => setShowQuickCreateTask(true)}
        onCreateProject={() => setShowCreateProject(true)}
        onCreatePortfolio={() => setShowCreatePortfolio(true)}
        onCreateGoal={() => setShowCreateGoal(true)}
        onSearchOpen={() => setShowSearch(true)}
        onToggleSidebar={toggleSidebar}
      />
      {/* Sidebar + main below topbar */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay when sidebar is open (after mount only to avoid hydration mismatch) */}
        {mounted && !sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={toggleSidebar}
          />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          onCreateProject={() => setShowCreateProject(true)}
          basePath={basePath}
        />
        <main className="flex-1 overflow-auto bg-background transition-[margin] duration-200 ease-out w-full pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onProjectCreated={fetchProjects}
      />
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
      />
      <QuickCreateTaskModal
        open={showQuickCreateTask}
        onOpenChange={setShowQuickCreateTask}
        projects={projects}
      />
      <CreateObjectiveDialog
        open={showCreateGoal}
        onOpenChange={setShowCreateGoal}
      />

      {/* Portfolio Creation Dialog */}
      <Dialog open={showCreatePortfolio} onOpenChange={setShowCreatePortfolio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-name">Portfolio name</Label>
              <Input
                id="portfolio-name"
                placeholder="e.g., Q1 Initiatives"
                value={newPortfolio.name}
                onChange={(e) =>
                  setNewPortfolio({ ...newPortfolio, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio-description">Description (optional)</Label>
              <Textarea
                id="portfolio-description"
                placeholder="What is this portfolio for?"
                value={newPortfolio.description}
                onChange={(e) =>
                  setNewPortfolio({
                    ...newPortfolio,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <Button
              className="w-full bg-black hover:bg-black"
              onClick={handleCreatePortfolio}
              disabled={creatingPortfolio || !newPortfolio.name.trim()}
            >
              {creatingPortfolio ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create portfolio"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <SearchDialog open={showSearch} onOpenChange={setShowSearch} />

      {/* AI Panel */}
      <AIPanel isOpen={isAIPanelOpen} onClose={closeAIPanel} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        onCreateTask={() => setShowQuickCreateTask(true)}
        onToggleSidebar={toggleSidebar}
        basePath={basePath}
      />
    </div>
  );
}

export function DashboardShell({ children, variant = "default", basePath = "" }: DashboardShellProps) {
  return (
    <AIPanelProvider>
      <DashboardShellContent variant={variant} basePath={basePath}>{children}</DashboardShellContent>
    </AIPanelProvider>
  );
}
