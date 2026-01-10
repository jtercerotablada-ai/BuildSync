"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
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

interface Project {
  id: string;
  name: string;
  color: string;
}

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
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
          onCreateTask={() => setShowCreateTask(true)} 
          onCreateProject={() => setShowCreateProject(true)}
          onCreatePortfolio={() => setShowCreatePortfolio(true)}
          onCreateGoal={() => setShowCreateGoal(true)}
        />
        <main className="flex-1 overflow-auto bg-slate-50">
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
              className="w-full bg-slate-900 hover:bg-slate-800"
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
    </div>
  );
}
