"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface ProjectProgressCardProps {
  project: {
    id: string;
    name: string;
    status: string;
    color: string;
    progress: number;
    totalTasks: number;
    completedTasks: number;
    startDate: Date | null;
    endDate: Date | null;
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case "ON_TRACK":
      return { ring: "#22c55e", bg: "bg-[#c9a84c]/10", text: "text-[#a8893a]", label: "On Track" };
    case "AT_RISK":
      return { ring: "#eab308", bg: "bg-[#a8893a]/10", text: "text-[#a8893a]", label: "At Risk" };
    case "OFF_TRACK":
      return { ring: "#ef4444", bg: "bg-black/10", text: "text-black", label: "Off Track" };
    case "ON_HOLD":
      return { ring: "#6b7280", bg: "bg-gray-500/10", text: "text-gray-400", label: "On Hold" };
    case "COMPLETE":
      return { ring: "#c9a84c", bg: "bg-[#c9a84c]/10", text: "text-[#c9a84c]", label: "Complete" };
    default:
      return { ring: "#6b7280", bg: "bg-gray-500/10", text: "text-gray-400", label: status };
  }
}

export function ProjectProgressCard({ project }: ProjectProgressCardProps) {
  const statusInfo = getStatusColor(project.status);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (project.progress / 100) * circumference;

  return (
    <Link href={`/client/projects/${project.id}`}>
      <Card className="group border-white/10 bg-[#151515] transition-all hover:border-[#c9a84c]/30 hover:bg-[#1a1a1a] cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {project.name}
              </h3>
              <Badge
                variant="secondary"
                className={`mt-2 ${statusInfo.bg} ${statusInfo.text} border-0 text-[10px] font-medium`}
              >
                {statusInfo.label}
              </Badge>
            </div>

            {/* Progress ring */}
            <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-white/5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke={statusInfo.ring}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-xs font-bold text-white">
                {project.progress}%
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-white/40">
              {project.completedTasks} / {project.totalTasks} tasks
            </p>
            {project.endDate && (
              <p className="text-xs text-white/40">
                Due {new Date(project.endDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1 text-xs text-[#c9a84c] opacity-0 transition-opacity group-hover:opacity-100">
            View details <ArrowRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
