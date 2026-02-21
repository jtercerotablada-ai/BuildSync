"use client";

import { useState } from "react";
import { X, FileText, FolderPlus, UserPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
}

interface TeamSetupBannerProps {
  team: {
    id: string;
    description?: string | null;
    _count?: {
      projects: number;
      members: number;
    };
  };
  onStepClick?: (stepId: string) => void;
}

export function TeamSetupBanner({ team, onStepClick }: TeamSetupBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Calculate completed steps
  const steps: SetupStep[] = [
    {
      id: "description",
      title: "Add team description",
      description: "Describe the purpose and responsibilities of your team",
      icon: FileText,
      completed: !!team.description,
    },
    {
      id: "work",
      title: "Add work",
      description: "Link existing projects, portfolios, or templates your team may find useful",
      icon: FolderPlus,
      completed: (team._count?.projects || 0) > 0,
    },
    {
      id: "members",
      title: "Add teammates",
      description: "Invite teammates to your new team to start collaborating",
      icon: UserPlus,
      completed: (team._count?.members || 0) > 1,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  // Don't show if dismissed or all completed
  if (isDismissed || completedCount === steps.length) {
    return null;
  }

  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-medium text-gray-900">Finish setting up your team</h3>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                completedCount === steps.length
                  ? "border-black bg-white"
                  : "border-gray-300"
              )}
            >
              {completedCount === steps.length && (
                <Check className="h-3 w-3 text-black" />
              )}
            </div>
            <span className="text-sm text-gray-500">
              {completedCount} of {steps.length} steps completed
            </span>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "p-4 border rounded-lg text-left hover:border-gray-400 hover:shadow-sm transition-all",
                step.completed
                  ? "bg-white border-black"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    step.completed ? "bg-white border border-black" : "bg-gray-100"
                  )}
                >
                  {step.completed ? (
                    <Check className="h-4 w-4 text-black" />
                  ) : (
                    <Icon className="h-4 w-4 text-gray-500" />
                  )}
                </div>

                <div>
                  <h4
                    className={cn(
                      "font-medium text-sm mb-1",
                      step.completed ? "text-black" : "text-gray-900"
                    )}
                  >
                    {step.title}
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
