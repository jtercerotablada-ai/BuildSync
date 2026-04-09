"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Users,
  BarChart3,
  Clock,
} from "lucide-react";

interface ProjectDetailViewProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    color: string;
    startDate: string | null;
    endDate: string | null;
    progress: number;
    totalTasks: number;
    completedTasks: number;
    ownerName: string;
  };
  milestones: {
    id: string;
    name: string;
    dueDate: string | null;
    completed: boolean;
  }[];
  teamMembers: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    jobTitle: string | null;
  }[];
  documents: {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
    uploaderName: string;
  }[];
}

type Tab = "overview" | "timeline" | "documents" | "team";

const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "timeline", label: "Timeline", icon: Calendar },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "team", label: "Team", icon: Users },
];

function getStatusStyle(status: string) {
  switch (status) {
    case "ON_TRACK":
      return { bg: "bg-green-500/10", text: "text-green-400", label: "On Track" };
    case "AT_RISK":
      return { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "At Risk" };
    case "OFF_TRACK":
      return { bg: "bg-red-500/10", text: "text-red-400", label: "Off Track" };
    case "ON_HOLD":
      return { bg: "bg-gray-500/10", text: "text-gray-400", label: "On Hold" };
    case "COMPLETE":
      return { bg: "bg-[#c9a84c]/10", text: "text-[#c9a84c]", label: "Complete" };
    default:
      return { bg: "bg-gray-500/10", text: "text-gray-400", label: status };
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ProjectDetailView({
  project,
  milestones,
  teamMembers,
  documents,
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const statusStyle = getStatusStyle(project.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/client/projects">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {project.name}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0`}>
              {statusStyle.label}
            </Badge>
            <span className="text-sm text-white/40">
              Managed by {project.ownerName}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <Card className="border-white/10 bg-[#151515]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Overall Progress</span>
            <span className="text-sm font-bold text-[#c9a84c]">{project.progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-[#c9a84c] transition-all duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            {project.completedTasks} of {project.totalTasks} tasks completed
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[#151515] p-1 border border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-[#151515]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-white/70">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.description && (
                <p className="text-sm text-white/60">{project.description}</p>
              )}
              <div className="space-y-2">
                {project.startDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-white/30" />
                    <span className="text-white/50">Start:</span>
                    <span className="text-white">{new Date(project.startDate).toLocaleDateString()}</span>
                  </div>
                )}
                {project.endDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-white/30" />
                    <span className="text-white/50">Due:</span>
                    <span className="text-white">{new Date(project.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#151515]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-white/70">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Total Tasks</span>
                <span className="text-white font-medium">{project.totalTasks}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Completed</span>
                <span className="text-green-400 font-medium">{project.completedTasks}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Remaining</span>
                <span className="text-white font-medium">{project.totalTasks - project.completedTasks}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Team Members</span>
                <span className="text-white font-medium">{teamMembers.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Documents</span>
                <span className="text-white font-medium">{documents.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "timeline" && (
        <Card className="border-white/10 bg-[#151515]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/70">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Clock className="h-8 w-8 text-white/20 mb-2" />
                <p className="text-white/50 text-sm">No milestones set for this project.</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {milestones.map((milestone, idx) => (
                  <div key={milestone.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      {milestone.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-[#c9a84c] flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-white/30 flex-shrink-0" />
                      )}
                      {idx < milestones.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 my-1" />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-medium ${milestone.completed ? "text-white/50 line-through" : "text-white"}`}>
                        {milestone.name}
                      </p>
                      {milestone.dueDate && (
                        <p className="text-xs text-white/40 mt-0.5">
                          {new Date(milestone.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card className="border-white/10 bg-[#151515]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/70">Project Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FileText className="h-8 w-8 text-white/20 mb-2" />
                <p className="text-white/50 text-sm">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c9a84c]/10">
                      <FileText className="h-4 w-4 text-[#c9a84c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{doc.name}</p>
                      <p className="text-xs text-white/40">
                        {formatSize(doc.size)} &middot; {doc.uploaderName} &middot;{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/50 hover:text-[#c9a84c] hover:bg-white/5"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "team" && (
        <Card className="border-white/10 bg-[#151515]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white/70">Project Team</CardTitle>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Users className="h-8 w-8 text-white/20 mb-2" />
                <p className="text-white/50 text-sm">No team members listed.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {teamMembers.map((member) => {
                  const initials = member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <div key={member.id} className="flex items-center gap-3 py-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.image || undefined} />
                        <AvatarFallback className="bg-white/10 text-white text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{member.name}</p>
                        <p className="text-xs text-white/40">
                          {member.jobTitle || member.email}
                        </p>
                      </div>
                      <Badge className="bg-white/5 text-white/50 border-0 text-[10px]">
                        {member.role}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
