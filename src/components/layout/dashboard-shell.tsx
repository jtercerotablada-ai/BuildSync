"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        projects={projects}
        onCreateProject={() => setShowCreateProject(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onCreateTask={() => setShowCreateTask(true)} />
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
    </div>
  );
}
