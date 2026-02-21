"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Lock,
  Plus,
  Target,
  ChevronDown,
  Calendar,
  Users,
  FileText,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  members: {
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }[];
}

interface ProjectOverviewProps {
  project: Project;
}

interface StatusUpdate {
  id: string;
  title: string;
  summary: string;
  author: {
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  status: "on-track" | "at-risk" | "off-track";
}

interface ActivityItem {
  id: string;
  type: "status_update" | "member_joined" | "project_created" | "task_completed";
  title: string;
  author?: string;
  createdAt: Date;
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const [description, setDescription] = useState(project.description || "");
  const [statusUpdates] = useState<StatusUpdate[]>([
    {
      id: "1",
      title: "The project has started!",
      summary:
        "Use status updates to communicate project progress with your team and stakeholders.",
      author: { name: project.owner.name || "Project Owner" },
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      status: "on-track",
    },
  ]);

  const [activities] = useState<ActivityItem[]>([
    {
      id: "1",
      type: "status_update",
      title: "The project has started!",
      author: project.owner.name || "Project Owner",
      createdAt: new Date(),
    },
    {
      id: "2",
      type: "member_joined",
      title: "Joined My workspace",
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      id: "3",
      type: "member_joined",
      title: "You joined",
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      id: "4",
      type: "project_created",
      title: "Project created",
      author: project.owner.name || "Project Owner",
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  ]);

  const statusColors = {
    ON_TRACK: { bg: "bg-green-500", label: "On track", text: "text-green-700" },
    AT_RISK: { bg: "bg-yellow-500", label: "At risk", text: "text-yellow-700" },
    OFF_TRACK: { bg: "bg-red-500", label: "Off track", text: "text-red-700" },
    ON_HOLD: { bg: "bg-slate-500", label: "On hold", text: "text-slate-700" },
    COMPLETE: { bg: "bg-blue-500", label: "Complete", text: "text-blue-700" },
  };

  const currentStatus = statusColors[project.status as keyof typeof statusColors] || statusColors.ON_TRACK;

  // Get all members including owner (filter out duplicates)
  const memberIds = new Set<string>();
  const allMembers: { id: string; name: string | null; email: string | null; image: string | null; role: string }[] = [];

  // Add owner first
  allMembers.push({
    id: project.owner.id,
    name: project.owner.name,
    email: project.owner.email,
    image: project.owner.image,
    role: "Project owner",
  });
  memberIds.add(project.owner.id);

  // Add other members (skip if already added as owner)
  project.members.forEach((m) => {
    if (!memberIds.has(m.user.id)) {
      allMembers.push({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role === "ADMIN" ? "Admin" : "Member",
      });
      memberIds.add(m.user.id);
    }
  });

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* AI Summary Card */}
        <div className="border rounded-lg p-4 mb-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <span className="font-medium text-slate-900">AI-generated summary</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <Lock className="w-4 h-4" />
              Private to you
            </div>
          </div>

          <div className="space-y-3">
            {/* Recent Activity */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-sm text-slate-900">Recent activity</p>
                <p className="text-sm text-slate-500">
                  Get up to date with what happened in this project recently
                </p>
              </div>
              <Button variant="outline" size="sm">
                Include
              </Button>
            </div>

            {/* Risk Report */}
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-sm text-slate-900">Risk report</p>
                <p className="text-sm text-slate-500">
                  Proactively identify possible risks in this project
                </p>
              </div>
              <Button variant="outline" size="sm">
                Include
              </Button>
            </div>

            {/* Periodic Updates */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Receive periodic updates</span>
              </div>
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800">
                Generate summary
              </Button>
            </div>
          </div>
        </div>

        {/* Project Description */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Project description
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            className="w-full p-3 border rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Project Roles */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Project roles</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <button className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg text-sm text-slate-500 hover:bg-slate-50" onClick={() => toast.info("Add member coming soon")}>
              <Plus className="w-4 h-4" />
              Add member
            </button>

            {allMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-sm font-medium text-white">
                  {member.name?.[0] || member.email?.[0] || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {member.name || member.email}
                  </p>
                  <p className="text-xs text-slate-500">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Goals */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Connected goals</h2>
          <div className="border-2 border-dashed rounded-lg p-8 text-center bg-white">
            <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              Create or connect a goal to link this project to a bigger purpose
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <Plus className="w-4 h-4 mr-2" />
              Add goal
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Status & Activity */}
      <div className="w-80 border-l bg-slate-50 overflow-auto">
        <div className="p-4">
          {/* Current Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn("text-lg font-semibold", currentStatus.text)}>
                {currentStatus.label}
              </h3>
              <Button variant="outline" size="sm">
                Update status
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Latest Status Update */}
            {statusUpdates.length > 0 && (
              <div className="bg-white rounded-lg border-l-4 border-green-500 p-4 shadow-sm">
                <h4 className="font-medium text-slate-900 mb-1">
                  {statusUpdates[0].title}
                </h4>
                <p className="text-sm font-medium text-slate-700 mb-2">Summary</p>
                <p className="text-sm text-slate-600 mb-3">
                  {statusUpdates[0].summary}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs font-medium text-white">
                    {statusUpdates[0].author.name[0]}
                  </div>
                  <span className="text-sm text-slate-600">
                    {statusUpdates[0].author.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatRelativeTime(statusUpdates[0].createdAt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <Calendar className="w-4 h-4" />
              Today - {formatDate(new Date())}
            </div>

            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      activity.type === "status_update"
                        ? "bg-green-500"
                        : "bg-slate-200"
                    )}
                  >
                    {activity.type === "status_update" && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                    {activity.type === "member_joined" && (
                      <Users className="w-3 h-3 text-slate-500" />
                    )}
                    {activity.type === "project_created" && (
                      <FolderOpen className="w-3 h-3 text-slate-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {activity.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activity.author
                        ? `${activity.author} - ${formatRelativeTime(activity.createdAt)}`
                        : formatRelativeTime(activity.createdAt)}
                    </p>

                    {/* Author Avatar for status updates */}
                    {activity.type === "status_update" && activity.author && (
                      <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-xs font-medium text-white mt-2">
                        {activity.author[0]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
