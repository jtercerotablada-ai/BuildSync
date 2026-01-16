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

interface Project {
  id: string;
  name: string;
  color: string;
}

interface DashboardShellProps {
  children: ReactNode;
}

function DashboardShellContent({ children }: DashboardShellProps) {
  const router = useRouter();
  const { isOpen: isAIPanelOpen, closePanel: closeAIPanel } = useAIPanel();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showQuickCreateTask, setShowQuickCreateTask] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Portfolio creation state
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ name: "", description: "" });

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
        router.push(`/portfolios/${portfolio.id}`);
      }
    } catch (error) {
      console.error("Error creating portfolio:", error);
    } finally {
      setCreatingPortfolio(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        projects={projects}
        onCreateProject={() => setShowCreateProject(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          onCreateTask={() => setShowQuickCreateTask(true)} 
          onCreateProject={() => setShowCreateProject(true)}
          onCreatePortfolio={() => setShowCreatePortfolio(true)}
          onCreateGoal={() => setShowCreateGoal(true)}
        />
        <main className="flex-1 overflow-auto bg-white">
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

      {/* AI Panel */}
      <AIPanel isOpen={isAIPanelOpen} onClose={closeAIPanel} />
    </div>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <AIPanelProvider>
      <DashboardShellContent>{children}</DashboardShellContent>
    </AIPanelProvider>
  );
}
