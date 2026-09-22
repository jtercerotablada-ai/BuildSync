"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  progress: number;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | null;
}

interface TeamGoalsWidgetProps {
  teamId: string;
  goals: Goal[];
}

const statusColors: Record<string, string> = {
  ON_TRACK: "bg-black",
  AT_RISK: "bg-gray-500",
  OFF_TRACK: "bg-gray-300",
};

export function TeamGoalsWidget({ teamId, goals }: TeamGoalsWidgetProps) {
  const router = useRouter();

  return (
    <div className="bg-white border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Goals</h3>

        {/* There is no /goals/new page — that path is read as an objective
            id and renders "Objective not found". The Goals list opens its
            create dialog on ?new=1; teamId rides along for it to preselect
            the team. A "Connect existing objective" item sat here as a
            permanent "Coming soon" and is gone until a picker exists. */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() =>
            router.push(`/goals?new=1&teamId=${encodeURIComponent(teamId)}`)
          }
        >
          <Plus className="h-3 w-3" />
          Create objective
        </Button>
      </div>

      {/* Goals list or empty state */}
      {goals.length > 0 ? (
        <div className="space-y-3">
          {goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => router.push(`/goals/${goal.id}`)}
              className="w-full text-left group"
            >
              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    statusColors[goal.status || "ON_TRACK"] || "bg-black"
                  )}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 group-hover:text-black transition-colors">
                  {goal.name}
                </span>
                <span className="text-gray-500">{goal.progress}%</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">
            This team hasn't created any objectives yet
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Add an objective so the team can see what you want to achieve.
          </p>

          {/* Placeholder goal */}
          <div className="opacity-30 mb-4">
            <div className="w-full h-2 bg-gray-200 rounded-full mb-2" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-black" />
                <span className="text-gray-400">On track (0%)</span>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
