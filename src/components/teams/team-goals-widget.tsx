"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ON_TRACK: "bg-green-500",
  AT_RISK: "bg-yellow-500",
  OFF_TRACK: "bg-red-500",
};

export function TeamGoalsWidget({ teamId, goals }: TeamGoalsWidgetProps) {
  const router = useRouter();

  return (
    <div className="bg-white border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Objetivos</h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Crear objetivo
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/goals/new?teamId=${teamId}`)}
            >
              <Target className="h-4 w-4 mr-2" />
              Nuevo objetivo
            </DropdownMenuItem>
            <DropdownMenuItem>Conectar objetivo existente</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                    statusColors[goal.status || "ON_TRACK"] || "bg-blue-500"
                  )}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 group-hover:text-blue-600 transition-colors">
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
            Este equipo aun no ha creado ningun objetivo
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Agrega un objetivo para que el equipo pueda ver lo que quieres
            lograr.
          </p>

          {/* Placeholder goal */}
          <div className="opacity-30 mb-4">
            <div className="w-full h-2 bg-gray-200 rounded-full mb-2" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-400">En curso (0%)</span>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
