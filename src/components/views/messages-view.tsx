"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Smile,
  Link2,
  Maximize2,
  MoreHorizontal,
  Plus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

interface Task {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  assignee: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface Section {
  id: string;
  name: string;
  tasks: Task[];
}

interface MessagesViewProps {
  sections: Section[];
  projectId: string;
  projectName?: string;
  projectColor?: string;
  projectStatus?: string;
  currentUser?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

interface Reply {
  id: string;
  author: User;
  content: string;
  createdAt: Date;
}

interface StatusUpdate {
  id: string;
  title: string;
  author: User;
  createdAt: Date;
  status: "on-track" | "at-risk" | "off-track" | "on-hold" | "complete";
  projectName: string;
  projectColor: string;
  summary: string;
  content?: string;
  upcomingTasks?: { id: string; name: string; dueDate: Date; assignee?: User }[];
  collaborators: User[];
  replies: Reply[];
}

// ============================================
// STATUS COLORS
// ============================================

const statusConfig = {
  "on-track": { label: "On track", color: "#22C55E", bgColor: "#DCFCE7", borderColor: "#22C55E" },
  "at-risk": { label: "At risk", color: "#F97316", bgColor: "#FEF3C7", borderColor: "#F97316" },
  "off-track": { label: "Off track", color: "#EF4444", bgColor: "#FEE2E2", borderColor: "#EF4444" },
  "on-hold": { label: "On hold", color: "#6B7280", bgColor: "#F3F4F6", borderColor: "#6B7280" },
  "complete": { label: "Complete", color: "#3B82F6", bgColor: "#DBEAFE", borderColor: "#3B82F6" },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function MessagesView({
  sections,
  projectId,
  projectName = "Project",
  projectColor = "#3B82F6",
  projectStatus = "ON_TRACK",
  currentUser: currentUserProp,
}: MessagesViewProps) {
  const router = useRouter();
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Current user from prop with fallback
  const currentUser: User = currentUserProp
    ? {
        id: currentUserProp.id,
        name: currentUserProp.name || "You",
        initials: (currentUserProp.name || "Y").slice(0, 2).toUpperCase(),
        color: "#FBBF24",
      }
    : { id: "1", name: "You", initials: "YO", color: "#FBBF24" };

  // Get upcoming tasks from sections
  const upcomingTasks = sections
    .flatMap((s) => s.tasks)
    .filter((t) => t.dueDate && !t.completed)
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      name: t.name,
      dueDate: new Date(t.dueDate!),
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name || "Unknown",
            initials: (t.assignee.name || "U").slice(0, 2).toUpperCase(),
            color: "#FBBF24",
          }
        : undefined,
    }));

  // Map project status to config key
  const getStatusKey = (status: string): keyof typeof statusConfig => {
    const mapping: Record<string, keyof typeof statusConfig> = {
      ON_TRACK: "on-track",
      AT_RISK: "at-risk",
      OFF_TRACK: "off-track",
      ON_HOLD: "on-hold",
      COMPLETE: "complete",
    };
    return mapping[status] || "on-track";
  };

  // Sample status updates
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([
    {
      id: "1",
      title: "The project has started!",
      author: currentUser,
      createdAt: new Date(),
      status: getStatusKey(projectStatus),
      projectName: projectName,
      projectColor: projectColor,
      summary: "Project status is on track.",
      content:
        "Use status updates to communicate project progress with your team. Skip follow-up meetings and save time for what really matters.",
      upcomingTasks: upcomingTasks,
      collaborators: [
        currentUser,
        { id: "2", name: "Maria Garcia", initials: "MG", color: "#EC4899" },
        { id: "3", name: "Carlos Lopez", initials: "CL", color: "#3B82F6" },
      ],
      replies: [],
    },
  ]);

  // Send new message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const newUpdate: StatusUpdate = {
      id: `update-${Date.now()}`,
      title: newMessage,
      author: currentUser,
      createdAt: new Date(),
      status: getStatusKey(projectStatus),
      projectName: projectName,
      projectColor: projectColor,
      summary: newMessage,
      collaborators: [currentUser],
      replies: [],
    };

    setStatusUpdates((prev) => [newUpdate, ...prev]);
    setNewMessage("");
    toast.success("Message sent");
  };

  // Send reply
  const handleSendReply = (updateId: string) => {
    if (!replyText.trim()) return;

    const newReply: Reply = {
      id: `reply-${Date.now()}`,
      author: currentUser,
      content: replyText,
      createdAt: new Date(),
    };

    setStatusUpdates((prev) =>
      prev.map((update) => {
        if (update.id === updateId) {
          return { ...update, replies: [...update.replies, newReply] };
        }
        return update;
      })
    );

    setReplyText("");
    setReplyingTo(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="max-w-3xl mx-auto py-6 px-4">
        {/* Message Composer */}
        <div className="mb-6">
          <div className="flex items-center gap-3 bg-white rounded-lg border p-3 shadow-sm">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.initials}
            </div>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Send a message to members..."
              className="flex-1 outline-none text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status Updates */}
        <div className="space-y-4">
          {statusUpdates.map((update) => (
            <StatusUpdateCard
              key={update.id}
              update={update}
              currentUser={currentUser}
              replyText={replyingTo === update.id ? replyText : ""}
              onReplyChange={setReplyText}
              onSendReply={() => handleSendReply(update.id)}
              onStartReply={() => setReplyingTo(update.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {statusUpdates.length === 0 && <EmptyState />}

        {/* Promotional Card */}
        <div className="mt-8">
          <PromotionalCard />
        </div>
      </div>
    </div>
  );
}

// ============================================
// STATUS UPDATE CARD
// ============================================

interface StatusUpdateCardProps {
  update: StatusUpdate;
  currentUser: User;
  replyText: string;
  onReplyChange: (text: string) => void;
  onSendReply: () => void;
  onStartReply: () => void;
}

function StatusUpdateCard({
  update,
  currentUser,
  replyText,
  onReplyChange,
  onSendReply,
}: StatusUpdateCardProps) {
  const config = statusConfig[update.status];

  return (
    <div
      className="bg-white rounded-lg border overflow-hidden shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: config.borderColor }}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{update.title}</h3>
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" onClick={() => toast.info("Reactions coming soon")}>
              <Smile className="w-4 h-4 text-slate-400" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
              <Link2 className="w-4 h-4 text-slate-400" />
            </button>
            <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" onClick={() => toast.info("Full screen view coming soon")}>
              <Maximize2 className="w-4 h-4 text-slate-400" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Edit coming soon")}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Delete coming soon")}>Delete</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Pin coming soon")}>Pin</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
            style={{ backgroundColor: update.author.color }}
          >
            {update.author.initials}
          </div>
          <span className="text-sm font-medium text-slate-700">{update.author.name}</span>
          <span className="text-sm text-slate-400">·</span>
          <span className="text-sm text-slate-500">
            {format(update.createdAt, "'Today at' HH:mm")}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 bg-slate-50 border-b">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="font-medium" style={{ color: config.color }}>
                {config.label}
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Project</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-2 h-2 rounded"
                style={{ backgroundColor: update.projectColor }}
              />
              <span className="text-slate-900 font-medium">{update.projectName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="font-semibold text-slate-900 mb-2">Summary</h4>
        <p className="text-sm text-slate-600 mb-4">{update.summary}</p>

        {update.content && (
          <p className="text-sm text-slate-600 mb-4">{update.content}</p>
        )}

        {/* Upcoming Tasks */}
        {update.upcomingTasks && update.upcomingTasks.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold text-slate-900 mb-2">What's next?</h4>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Upcoming tasks in 2 weeks</span>
              <span className="text-slate-400">
                Starting from: {format(new Date(), "MMM d, yyyy")}
              </span>
            </div>

            <div className="space-y-2">
              {update.upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <span className="text-sm text-slate-700">{task.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">
                      {format(task.dueDate, "MMM d")}
                    </span>
                    {task.assignee && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: task.assignee.color }}
                      >
                        {task.assignee.initials}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Replies */}
      {update.replies.length > 0 && (
        <div className="px-4 pb-2 space-y-3">
          {update.replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                style={{ backgroundColor: reply.author.color }}
              >
                {reply.author.initials}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reply.author.name}</span>
                  <span className="text-xs text-slate-400">
                    {format(reply.createdAt, "HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.initials}
          </div>
          <input
            type="text"
            value={replyText}
            onChange={(e) => onReplyChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSendReply()}
            placeholder="Reply to message..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {replyText && (
            <Button size="sm" variant="ghost" onClick={onSendReply}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Collaborators</span>
          <div className="flex -space-x-2">
            {update.collaborators.slice(0, 3).map((collab) => (
              <div
                key={collab.id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white"
                style={{ backgroundColor: collab.color }}
                title={collab.name}
              >
                {collab.initials}
              </div>
            ))}
          </div>
          {update.collaborators.length > 3 && (
            <span className="text-xs text-slate-500">
              +{update.collaborators.length - 3}
            </span>
          )}
          <button className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 transition-colors" onClick={() => toast.info("Add member coming soon")}>
            <Plus className="w-3 h-3 text-slate-500" />
          </button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => toast.info("Left the conversation")}>
          Leave
        </Button>
      </div>
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 mb-2">No messages yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        Send status updates and messages to keep your team informed about project
        progress.
      </p>
    </div>
  );
}

// ============================================
// PROMOTIONAL CARD
// ============================================

function PromotionalCard() {
  return (
    <div className="bg-white rounded-lg border p-6 text-center shadow-sm">
      {/* Chat Bubbles Illustration */}
      <div className="flex justify-center mb-4">
        <div className="relative">
          <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-amber-600" />
          </div>
          <div className="absolute -top-2 -right-3 w-10 h-10 bg-white border border-black rounded-lg flex items-center justify-center rotate-12">
            <MessageSquare className="w-5 h-5 text-black" />
          </div>
          <div className="absolute -bottom-1 -left-2 w-8 h-8 bg-white border border-black rounded-lg flex items-center justify-center -rotate-12">
            <MessageSquare className="w-4 h-4 text-black" />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Connect conversations with your work
      </h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        Keep discussions organized and linked to tasks, so nothing gets lost and
        everyone stays aligned.
      </p>
    </div>
  );
}
