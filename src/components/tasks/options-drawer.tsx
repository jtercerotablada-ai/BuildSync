"use client";

import { useEffect, useRef } from "react";
import {
  ChevronRight,
  Columns,
  Filter,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OptionsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onOpenGroups: () => void;
  hiddenColumnsCount?: number;
}

const optionRows = [
  {
    id: "columns",
    label: "Show/hide columns",
    icon: Columns,
    action: "columns" as const,
  },
  {
    id: "filters",
    label: "Filters",
    icon: Filter,
    action: "filters" as const,
  },
  {
    id: "sort",
    label: "Sort",
    icon: ArrowUpDown,
    action: "sort" as const,
  },
  {
    id: "groups",
    label: "Groups",
    icon: LayoutGrid,
    action: "groups" as const,
  },
];

export function OptionsDrawer({
  open,
  onClose,
  onOpenFilters,
  onOpenSort,
  onOpenGroups,
  hiddenColumnsCount = 7,
}: OptionsDrawerProps) {
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

  function handleRowClick(action: string) {
    switch (action) {
      case "columns":
        toast.info("Column settings coming soon");
        break;
      case "filters":
        onOpenFilters();
        break;
      case "sort":
        onOpenSort();
        break;
      case "groups":
        onOpenGroups();
        break;
    }
  }

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
            <h2 className="text-[18px] font-semibold text-gray-900">List</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>

          {/* Icon + View Name section */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[12px] font-medium text-gray-500 mb-1.5">Icon</p>
                <button className="flex items-center justify-center h-9 w-9 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-[18px]">
                  📋
                </button>
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-gray-500 mb-1.5">View name</p>
                <input
                  type="text"
                  defaultValue="List"
                  className="w-full h-9 px-3 text-[14px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-black/10"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Option rows */}
          <div className="px-2 py-2">
            {optionRows.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleRowClick(item.action)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f3f4f6] transition-colors group text-left"
                >
                  <div className="flex items-center justify-center w-6 flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="flex-1 text-[14px] font-medium text-gray-800">
                    {item.label}
                  </span>
                  {item.id === "columns" && (
                    <span className="text-[12px] text-gray-400 mr-1">
                      {hiddenColumnsCount} hidden
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-auto border-t border-gray-200 px-5 py-4">
            <button
              onClick={() => toast.info("Send feedback coming soon")}
              className="text-[13px] text-blue-600 hover:underline"
            >
              Send feedback
            </button>
          </div>
        </>
      )}
    </div>
  );
}
