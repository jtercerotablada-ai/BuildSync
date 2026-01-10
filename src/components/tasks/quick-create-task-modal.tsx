"use client";

import { useState, useEffect } from "react";
import { X, Minus, Plus, Type, Smile, AtSign, Paperclip, Sparkles, Calendar, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "next-auth/react";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface QuickCreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects?: Project[];
}

export function QuickCreateTaskModal({ open, onOpenChange, projects = [] }: QuickCreateTaskModalProps) {
  const { data: session } = useSession();
  const [minimized, setMinimized] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    assigneeId: "",
    projectId: "",
  });

  const [selectedAssignee, setSelectedAssignee] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    }
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
    setMinimized(false);
    setTaskData({ title: "", description: "", assigneeId: "", projectId: "" });
    setSelectedAssignee(null);
    setSelectedProject(null);
  };

  const handleMinimize = () => {
    setMinimized(!minimized);
  };

  const handleSelectAssignee = (user: User) => {
    setSelectedAssignee(user);
    setTaskData({ ...taskData, assigneeId: user.id });
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setTaskData({ ...taskData, projectId: project.id });
  };

  const handleCreateTask = async () => {
    if (!taskData.title.trim() || !taskData.projectId) return;

    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || null,
          assigneeId: taskData.assigneeId || null,
          projectId: taskData.projectId,
          status: "TODO",
        }),
      });

      if (res.ok) {
        handleClose();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <div
      className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 transition-all duration-200 ${
        minimized ? "w-72" : "w-96"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-white rounded-t-lg">
        <span className="text-sm font-medium">Nueva tarea</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <div className="p-4 space-y-3">
          {/* Task Name */}
          <Input
            placeholder="Nombre de la tarea"
            value={taskData.title}
            onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
            className="border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-slate-400"
          />

          {/* Assignee and Project Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assignee Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                  {selectedAssignee ? (
                    <>
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={selectedAssignee.image || ""} />
                        <AvatarFallback className="text-[8px] bg-slate-600 text-white">
                          {selectedAssignee.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedAssignee.name}</span>
                    </>
                  ) : (
                    <>
                      <AtSign className="h-3 w-3" />
                      <span>Asignar</span>
                    </>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {users.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleSelectAssignee(user)}
                    className="cursor-pointer"
                  >
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={user.image || ""} />
                      <AvatarFallback className="text-[10px] bg-slate-600 text-white">
                        {user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {user.name || user.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Project Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                  {selectedProject ? (
                    <>
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: selectedProject.color }}
                      />
                      <span>{selectedProject.name}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Proyecto</span>
                    </>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => handleSelectProject(project)}
                    className="cursor-pointer"
                  >
                    <div
                      className="h-3 w-3 rounded-full mr-2"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          <Textarea
            placeholder="Descripcion (opcional)"
            value={taskData.description}
            onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
            className="min-h-[80px] resize-none border-slate-200"
          />

          {/* Toolbar */}
          <div className="flex items-center gap-1 pt-2 border-t">
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Plus className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Type className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Smile className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <AtSign className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Paperclip className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Sparkles className="h-4 w-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <Calendar className="h-4 w-4" />
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session?.user?.image || ""} />
              <AvatarFallback className="bg-slate-900 text-white text-xs">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <Button
              size="sm"
              className="bg-slate-900 hover:bg-slate-800"
              onClick={handleCreateTask}
              disabled={creating || !taskData.title.trim() || !taskData.projectId}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear tarea"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
