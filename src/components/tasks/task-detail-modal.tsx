'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import {
  Check,
  User,
  Calendar as CalendarIcon,
  FolderKanban,
  Link,
  Plus,
  ChevronDown,
  Info,
  LogOut,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TaskCommentsSection } from './task-comments-section';
import { AssigneeSelector } from './assignee-selector';
import { DueDatePicker } from './due-date-picker';
import { ProjectSelector } from './project-selector';
import { PrioritySelector, StatusSelector } from './field-selector';
import { TaskDetailToolbar } from './task-detail-toolbar';
import { TaskAttachments } from './task-attachments';

interface TaskDetail {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  taskStatus: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | null;
  assignee: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  creator: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  project: {
    id: string;
    name: string;
    color: string;
  } | null;
  section: {
    id: string;
    name: string;
  } | null;
  subtasks: {
    id: string;
    name: string;
    completed: boolean;
    assignee: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  }[];
  comments: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[];
  activities: {
    id: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }[];
  attachments: {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }[];
  collaborators?: {
    id: string;
    name: string | null;
    image: string | null;
  }[];
  isLiked?: boolean;
  likesCount?: number;
  _count?: {
    likes: number;
  };
}

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDueDate(date: string): { text: string; isSpecial: boolean } {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return { text: 'Today', isSpecial: true };
  if (d.toDateString() === tomorrow.toDateString()) return { text: 'Tomorrow', isSpecial: true };
  if (d.toDateString() === yesterday.toDateString()) return { text: 'Yesterday', isSpecial: false };
  return { text: format(d, 'MMM d'), isSpecial: false };
}

export function TaskDetailModal({
  taskId,
  open,
  onOpenChange,
  onTaskUpdate,
}: TaskDetailModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskName, setEditingSubtaskName] = useState('');

  const fetchTask = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error('Failed to fetch task');
      const data = await response.json();
      setTask(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (error) {
      toast.error('Failed to load task');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [taskId, onOpenChange]);

  useEffect(() => {
    if (open && taskId) {
      fetchTask();
    }
  }, [open, taskId, fetchTask]);

  const updateTask = async (updates: Record<string, unknown>) => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update task');

      const updatedTask = await response.json();
      setTask((prev) => (prev ? { ...prev, ...updatedTask } : null));
      onTaskUpdate?.();
      router.refresh();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleToggleComplete = async () => {
    if (!task) return;
    await updateTask({ completed: !task.completed });
    toast.success(task.completed ? 'Task marked incomplete' : 'Task completed!');
  };

  const handleNameBlur = () => {
    if (name !== task?.name && name.trim()) {
      updateTask({ name });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task?.description || '')) {
      updateTask({ description: description || null });
    }
  };

  const handleSubtaskToggle = async (subtaskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });

      if (!response.ok) throw new Error('Failed to toggle subtask');
      fetchTask();
    } catch (error) {
      toast.error('Failed to update subtask');
    }
  };

  const handleSubtaskAdd = async () => {
    if (!newSubtaskName.trim()) {
      setIsAddingSubtask(false);
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubtaskName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to add subtask');
      toast.success('Subtask added');
      setNewSubtaskName('');
      setIsAddingSubtask(false);
      fetchTask();
    } catch (error) {
      toast.error('Failed to add subtask');
    }
  };

  const handleSubtaskEdit = (subtaskId: string, currentName: string) => {
    setEditingSubtaskId(subtaskId);
    setEditingSubtaskName(currentName);
  };

  const handleSubtaskUpdate = async () => {
    if (!editingSubtaskId || !editingSubtaskName.trim()) {
      setEditingSubtaskId(null);
      setEditingSubtaskName('');
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/${editingSubtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSubtaskName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update subtask');
      setEditingSubtaskId(null);
      setEditingSubtaskName('');
      fetchTask();
    } catch (error) {
      toast.error('Failed to update subtask');
    }
  };

  const handleSubtaskDelete = async (subtaskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete subtask');
      toast.success('Subtask deleted');
      fetchTask();
    } catch (error) {
      toast.error('Failed to delete subtask');
    }
  };

  const handleCommentAdd = async (content: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error('Failed to add comment');
      toast.success('Comment added');
      fetchTask();
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');
      toast.success('Task deleted');
      onOpenChange(false);
      onTaskUpdate?.();
      router.refresh();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleToggleLike = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/like`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to toggle like');
      const data = await response.json();
      setTask((prev) => {
        if (!prev) return null;
        const currentCount = prev.likesCount || prev._count?.likes || 0;
        const newCount = data.liked ? currentCount + 1 : Math.max(0, currentCount - 1);
        return {
          ...prev,
          isLiked: data.liked,
          likesCount: newCount,
          _count: { ...prev._count, likes: newCount }
        };
      });
      toast.success(data.liked ? 'Task liked!' : 'Like removed');
    } catch (error) {
      toast.error('Failed to toggle like');
    }
  };

  const handleAttachFile = async (file: File) => {
    if (!taskId) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to attach file');
      toast.success('File attached!');
      fetchTask();
    } catch (error) {
      toast.error('Failed to attach file');
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete attachment');
      toast.success('Attachment deleted');
      fetchTask();
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const handleDuplicate = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to duplicate task');
      toast.success('Task duplicated!');
      onTaskUpdate?.();
      router.refresh();
    } catch (error) {
      toast.error('Failed to duplicate task');
    }
  };

  const handleArchive = async () => {
    if (!taskId) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/archive`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to archive task');
      toast.success('Task archived');
      onOpenChange(false);
      onTaskUpdate?.();
      router.refresh();
    } catch (error) {
      toast.error('Failed to archive task');
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden',
          isFullscreen
            ? 'fixed inset-0 !max-w-none w-screen h-screen !max-h-none rounded-none !translate-x-0 !translate-y-0 !top-0 !left-0'
            : 'max-w-2xl w-full max-h-[90vh]'
        )}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Task Details</DialogTitle>
        </VisuallyHidden.Root>

        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-8 bg-gray-100 animate-pulse rounded w-1/3" />
            <div className="h-6 bg-gray-100 animate-pulse rounded w-2/3" />
            <div className="h-32 bg-gray-100 animate-pulse rounded" />
          </div>
        ) : !task ? (
          <div className="p-8 text-center text-gray-500">Task not found</div>
        ) : (
          <>
            {/* ========== HEADER TOOLBAR ========== */}
            <TaskDetailToolbar
              taskId={task.id}
              isCompleted={task.completed}
              isLiked={task.isLiked || false}
              likesCount={task.likesCount || task._count?.likes || 0}
              isFullscreen={isFullscreen}
              onToggleComplete={handleToggleComplete}
              onToggleLike={handleToggleLike}
              onAttachFile={handleAttachFile}
              onAddSubtask={() => setIsAddingSubtask(true)}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDeleteTask}
              onClose={() => onOpenChange(false)}
            />

            {/* ========== INFO BANNER ========== */}
            <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 text-sm text-gray-600 flex-shrink-0">
              <Info className="h-4 w-4 text-blue-500" />
              <span>
                This task is visible to members of{' '}
                <span className="text-blue-600 font-medium">
                  {task.project?.name || 'your workspace'}
                </span>
              </span>
            </div>

            {/* ========== CONTENIDO SCROLLEABLE ========== */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {/* 1. TÍTULO CON BORDE */}
                <div className="border rounded-lg">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleNameBlur}
                    className={cn(
                      'text-xl font-semibold border-0 p-3 h-auto focus-visible:ring-0 placeholder:text-gray-400',
                      task.completed && 'line-through text-gray-400'
                    )}
                    placeholder="Task name"
                  />
                </div>

                {/* 2. DESCRIPCIÓN - DESPUÉS DEL TÍTULO */}
                <div className="flex items-start gap-4">
                  <span className="w-28 text-sm text-gray-500 pt-2 flex-shrink-0">
                    Description
                  </span>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="What is this task about?"
                    className="flex-1 resize-none border rounded-lg p-3 min-h-[80px] focus-visible:ring-1 text-gray-600 placeholder:text-gray-400"
                  />
                </div>

                <div className="border-t pt-4" />

                {/* ========== CAMPOS ========== */}
                <div className="space-y-3">
                  {/* Assignee */}
                  <div className="flex items-center min-h-9">
                    <div className="w-28 flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                      <User className="h-4 w-4" />
                      <span>Assignee</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <AssigneeSelector
                        value={task.assignee}
                        onChange={(user) => updateTask({ assigneeId: user?.id || null })}
                        trigger={
                          task.assignee ? (
                            <button className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={task.assignee.image || undefined} />
                                <AvatarFallback className="text-xs bg-blue-600 text-white">
                                  {getInitials(task.assignee.name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assignee.name}</span>
                            </button>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-gray-500 h-8">
                              <Plus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center min-h-9">
                    <div className="w-28 flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Due date</span>
                    </div>
                    <div className="flex-1">
                      <DueDatePicker
                        value={task.dueDate ? new Date(task.dueDate) : null}
                        onChange={(date) => updateTask({ dueDate: date?.toISOString() || null })}
                        trigger={
                          task.dueDate ? (
                            <button className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                              <CalendarIcon className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600 font-medium">
                                {formatDueDate(task.dueDate).text}
                              </span>
                            </button>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-gray-500 h-8 gap-1">
                              No due date <ChevronDown className="h-3 w-3" />
                            </Button>
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="flex items-start">
                    <div className="w-28 flex items-center gap-2 text-sm text-gray-500 pt-2 flex-shrink-0">
                      <FolderKanban className="h-4 w-4" />
                      <span>Projects</span>
                    </div>
                    <div className="flex-1">
                      <ProjectSelector
                        value={task.project ? {
                          id: task.project.id,
                          name: task.project.name,
                          color: task.project.color,
                          owner: task.creator,
                        } : null}
                        onChange={(project) => updateTask({ projectId: project?.id || null })}
                      />
                    </div>
                  </div>

                  {/* Dependencies */}
                  <div className="flex items-center min-h-9">
                    <div className="w-28 flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                      <Link className="h-4 w-4" />
                      <span>Dependencies</span>
                    </div>
                    <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-2 py-1">
                      <Plus className="h-4 w-4" />
                      Add dependency
                    </button>
                  </div>

                  {/* Custom Fields */}
                  <div className="flex items-start">
                    <div className="w-28 text-sm text-gray-500 pt-2 flex-shrink-0">
                      Fields
                    </div>
                    <div className="flex-1 space-y-1">
                      <PrioritySelector
                        value={task.priority}
                        onChange={(priority) => updateTask({ priority })}
                      />
                      <StatusSelector
                        value={task.taskStatus}
                        onChange={(status) => updateTask({ taskStatus: status })}
                        completed={task.completed}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4" />

                {/* ========== SUBTASKS ========== */}
                <div className="space-y-2">
                  {/* Label + botón inline */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Subtasks</span>
                    {!isAddingSubtask && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-7"
                        onClick={() => setIsAddingSubtask(true)}
                      >
                        <Plus className="h-3 w-3" />
                        Add subtask
                      </Button>
                    )}
                  </div>

                  {/* Lista de subtasks existentes */}
                  {task.subtasks?.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 py-1 group">
                      <button
                        onClick={() => handleSubtaskToggle(subtask.id, subtask.completed)}
                        className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0',
                          subtask.completed
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-green-500'
                        )}
                      >
                        {subtask.completed && <Check className="h-2.5 w-2.5 text-white" />}
                      </button>
                      {editingSubtaskId === subtask.id ? (
                        <Input
                          value={editingSubtaskName}
                          onChange={(e) => setEditingSubtaskName(e.target.value)}
                          className="flex-1 h-7 text-sm border-0 p-0 focus-visible:ring-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubtaskUpdate();
                            if (e.key === 'Escape') {
                              setEditingSubtaskId(null);
                              setEditingSubtaskName('');
                            }
                          }}
                          onBlur={handleSubtaskUpdate}
                        />
                      ) : (
                        <span
                          onClick={() => handleSubtaskEdit(subtask.id, subtask.name)}
                          className={cn(
                            'text-sm flex-1 cursor-pointer hover:text-blue-600',
                            subtask.completed && 'line-through text-gray-400'
                          )}
                        >
                          {subtask.name}
                        </span>
                      )}
                      {subtask.assignee && (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={subtask.assignee.image || undefined} />
                          <AvatarFallback className="text-[10px] bg-gray-200">
                            {getInitials(subtask.assignee.name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <button
                        onClick={() => handleSubtaskDelete(subtask.id)}
                        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Input para agregar subtask */}
                  {isAddingSubtask && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      <Input
                        value={newSubtaskName}
                        onChange={(e) => setNewSubtaskName(e.target.value)}
                        placeholder="Subtask name"
                        className="flex-1 h-7 text-sm border-0 p-0 focus-visible:ring-0"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSubtaskAdd();
                          if (e.key === 'Escape') {
                            setIsAddingSubtask(false);
                            setNewSubtaskName('');
                          }
                        }}
                        onBlur={handleSubtaskAdd}
                      />
                    </div>
                  )}
                </div>

                {/* ========== ATTACHMENTS ========== */}
                {task.attachments && task.attachments.length > 0 && (
                  <TaskAttachments
                    taskId={task.id}
                    attachments={task.attachments}
                    onUpload={handleAttachFile}
                    onDelete={handleDeleteAttachment}
                  />
                )}
              </div>

              {/* ========== COMMENTS SECTION ========== */}
              <TaskCommentsSection
                taskId={task.id}
                comments={task.comments || []}
                activities={task.activities || []}
                onCommentAdd={handleCommentAdd}
              />
            </div>

            {/* ========== FOOTER ========== */}
            <div className="flex items-center justify-between px-6 py-3 border-t bg-white flex-shrink-0">
              {/* Colaboradores */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Collaborators</span>
                <div className="flex -space-x-2">
                  {(task.collaborators || [task.assignee, task.creator])
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((collab: any, i: number) => (
                      <Avatar key={collab?.id || i} className="h-6 w-6 border-2 border-white">
                        <AvatarImage src={collab?.image || undefined} />
                        <AvatarFallback className="text-xs bg-gray-300 text-gray-600">
                          {getInitials(collab?.name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Leave task */}
              <Button variant="ghost" size="sm" className="text-gray-500 gap-2">
                <LogOut className="h-4 w-4" />
                Leave task
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
