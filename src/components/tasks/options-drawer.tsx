"use client";

import { useEffect, useRef } from "react";
import {
  ChevronRight,
  Filter,
  ArrowUpDown,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenFilters: () => void;
  onOpenSort: () => void;
  onOpenGroups: () => void;
}

// "Show/hide columns" was here but routed to a "coming soon" toast.
// Removed until the columns settings actually exist — the rest of
// the rows (Filters, Sort, Groups) all open real panels.
const optionRows = [
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
        "absolute top-0 right-0 bottom-0 w-[380px] bg-white border-l border-gray-200 flex flex-col overflow-hidden z-30 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.08)]",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
      aria-hidden={!open}
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
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Footer — "Send feedback" link removed; was a stub
              toast. We'll wire it to a real channel (Crisp/email)
              when there's something behind it. */}
          <div className="mt-auto border-t border-gray-200 px-5 py-4">
            <span className="text-[12px] text-gray-400">
              Tip: press Esc to close
            </span>
          </div>
        </>
      )}
    </div>
  );
}
