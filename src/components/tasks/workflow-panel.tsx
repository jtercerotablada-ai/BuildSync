"use client";

import { useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Zap,
  CircleDot,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WorkflowPanelProps {
  open: boolean;
  onClose: () => void;
}

const organizeItems = [
  {
    id: "fields",
    label: "Fields",
    icon: CircleDot,
    description: "Customize fields for this project",
  },
];

const automateItems = [
  {
    id: "rules",
    label: "Rules",
    icon: Zap,
    description: "Automate actions with rules",
  },
  {
    id: "apps",
    label: "Apps",
    icon: LayoutGrid,
    description: "Connect your favorite apps",
  },
];

export function WorkflowPanel({ open, onClose }: WorkflowPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full bg-white border-l border-gray-200 flex flex-col flex-shrink-0 transition-[width,opacity] duration-200 ease-out overflow-hidden",
        open ? "w-[380px] opacity-100" : "w-0 opacity-0"
      )}
    >
      {open && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-[18px] font-semibold text-gray-900">Workflow</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* This project section */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">This project</p>
                <p className="text-[12px] text-gray-400 mt-0.5">View and edit rules in this project</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                    <Plus className="w-3 h-3" />
                    Add
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => toast.info("Add field coming soon")}
                    className="cursor-pointer text-[13px]"
                  >
                    <CircleDot className="mr-2 h-4 w-4 text-gray-500" />
                    Add field
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toast.info("Add rule coming soon")}
                    className="cursor-pointer text-[13px]"
                  >
                    <Zap className="mr-2 h-4 w-4 text-gray-500" />
                    Add rule
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toast.info("Connect app coming soon")}
                    className="cursor-pointer text-[13px]"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4 text-gray-500" />
                    Connect app
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* Organize group */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Organize
              </p>
              <div className="space-y-1">
                {organizeItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => toast.info(`${item.label} settings coming soon`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors group text-left"
                    >
                      <div className="flex items-center justify-center w-6 flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="flex-1 text-[14px] font-medium text-gray-800">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Automate group */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Automate
              </p>
              <div className="space-y-1">
                {automateItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => toast.info(`${item.label} settings coming soon`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors group text-left"
                    >
                      <div className="flex items-center justify-center w-6 flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="flex-1 text-[14px] font-medium text-gray-800">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
