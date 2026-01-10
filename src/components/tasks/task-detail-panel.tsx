"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  X,
  Calendar as CalendarIcon,
  User,
  Flag,
  MoreHorizontal,
  MessageSquare,
  Plus,
  Paperclip,
  Link2,
  ThumbsUp,
  Send,
  Clock,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}

interface TaskDetail {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  dueDate: string | null;
  startDate: string | null;
  priority: string;
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
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
    likes: number;
  };
}

const PRIORITY_OPTIONS = [
  { value: "NONE", label: "No priority", color: "" },
  { value: "LOW", label: "Low", color: "text-blue-600" },
  { value: "MEDIUM", label: "Medium", color: "text-yellow-600" },
  { value: "HIGH", label: "High", color: "text-red-600" },
];

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newComment, setNewComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch task");
      const data = await response.json();
      setTask(data);
      setName(data.name);
      setDescription(data.description || "");
    } catch (error) {
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async (updates: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update task");

      const updatedTask = await response.json();
      setTask((prev) => (prev ? { ...prev, ...updatedTask } : null));
      router.refresh();
    } catch (error) {
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameBlur = () => {
    if (name !== task?.name && name.trim()) {
      updateTask({ name });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task?.description || "")) {
      updateTask({ description: description || null });
    }
  };

  const handleComplete = () => {
    if (task) {
      updateTask({ completed: !task.completed });
      toast.success(task.completed ? "Task marked incomplete" : "Task completed");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) throw new Error("Failed to add comment");

      setNewComment("");
      fetchTask();
      toast.success("Comment added");
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };

  if (loading) {
    return (
      <div className="w-[480px] border-l bg-white flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="w-[480px] border-l bg-white flex items-center justify-center">
        <div className="text-slate-500">Task not found</div>
      </div>
    );
  }

  return (
    <div className="w-[480px] border-l bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={task.completed}
            onClick={handleComplete}
            className="rounded-full h-5 w-5"
          />
          {task.project && (
            <Badge variant="outline" className="gap-1">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: task.project.color }}
              />
              {task.project.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon">
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Link2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Task Name */}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            className={cn(
              "text-lg font-semibold border-none px-0 focus-visible:ring-0",
              task.completed && "line-through text-slate-400"
            )}
          />

          {/* Metadata */}
          <div className="space-y-3">
            {/* Assignee */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500 w-20">Assignee</span>
              <div className="flex items-center gap-2">
                {task.assignee ? (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee.image || ""} />
                      <AvatarFallback className="text-xs">
                        {task.assignee.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{task.assignee.name}</span>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="text-slate-500">
                    No assignee
                  </Button>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500 w-20">Due date</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-600">
                    {task.dueDate
                      ? format(parseISO(task.dueDate), "MMM d, yyyy")
                      : "No due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={task.dueDate ? parseISO(task.dueDate) : undefined}
                    onSelect={(date) =>
                      updateTask({ dueDate: date?.toISOString() || null })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <Flag className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500 w-20">Priority</span>
              <Select
                value={task.priority}
                onValueChange={(value) => updateTask({ priority: value })}
              >
                <SelectTrigger className="w-32 h-8 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section */}
            {task.section && (
              <div className="flex items-center gap-3">
                <CheckSquare className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-500 w-20">Section</span>
                <span className="text-sm">{task.section.name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">
                Subtasks ({task._count.subtasks})
              </h4>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add subtask
              </Button>
            </div>
            {task.subtasks.length > 0 ? (
              <div className="space-y-2">
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={subtask.completed}
                      className="rounded-full"
                    />
                    <span
                      className={cn(
                        "text-sm flex-1",
                        subtask.completed && "line-through text-slate-400"
                      )}
                    >
                      {subtask.name}
                    </span>
                    {subtask.assignee && (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={subtask.assignee.image || ""} />
                        <AvatarFallback className="text-xs">
                          {subtask.assignee.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No subtasks</p>
            )}
          </div>

          <Separator />

          {/* Comments & Activity Tabs */}
          <Tabs defaultValue="comments">
            <TabsList className="w-full">
              <TabsTrigger value="comments" className="flex-1">
                Comments ({task._count.comments})
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="mt-4">
              {/* Add Comment */}
              <div className="flex gap-2 mb-4">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[60px] resize-none"
                />
                <Button
                  size="icon"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {task.comments.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No comments yet
                  </p>
                ) : (
                  task.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.author.image || ""} />
                        <AvatarFallback className="text-xs">
                          {comment.author.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {comment.author.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {format(parseISO(comment.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="space-y-3">
                {task.activities.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No activity yet
                  </p>
                ) : (
                  task.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={activity.user.image || ""} />
                        <AvatarFallback className="text-xs">
                          {activity.user.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <span className="font-medium">{activity.user.name}</span>{" "}
                        <span className="text-slate-600">
                          {formatActivityType(activity.type)}
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {format(parseISO(activity.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

function formatActivityType(type: string): string {
  const labels: Record<string, string> = {
    TASK_CREATED: "created this task",
    TASK_COMPLETED: "completed this task",
    TASK_UNCOMPLETED: "marked this task incomplete",
    TASK_ASSIGNED: "assigned this task",
    TASK_UNASSIGNED: "unassigned this task",
    TASK_MOVED: "moved this task",
    TASK_RENAMED: "renamed this task",
    TASK_DESCRIPTION_CHANGED: "updated the description",
    DUE_DATE_CHANGED: "changed the due date",
    COMMENT_ADDED: "added a comment",
    ATTACHMENT_ADDED: "added an attachment",
    SUBTASK_ADDED: "added a subtask",
  };

  return labels[type] || type.toLowerCase().replace(/_/g, " ");
}
