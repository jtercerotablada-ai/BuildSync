"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_TYPES, type FieldTypeConfig } from "@/lib/field-types";

interface AddColumnDropdownProps {
  onSelectType: (fieldType: FieldTypeConfig, fieldName: string) => void;
  onFromLibrary: () => void;
}

export function AddColumnDropdown({
  onSelectType,
  onFromLibrary,
}: AddColumnDropdownProps) {
  const [open, setOpen] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small delay so the DOM is painted before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleSelectType(ft: FieldTypeConfig) {
    setOpen(false);
    onSelectType(ft, fieldName.trim());
    setFieldName("");
  }

  function handleFromLibrary() {
    setOpen(false);
    onFromLibrary();
    setFieldName("");
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="p-1 hover:bg-slate-100 rounded"
        title="Add column"
      >
        <Plus className="w-4 h-4 text-slate-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-[calc(100%+4px)] w-[280px] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/60 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Input */}
          <div className="p-2.5">
            <input
              ref={inputRef}
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="New field"
              className="w-full h-8 px-3 text-[13px] border-2 border-black rounded-md bg-white focus:outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Section title */}
          <div className="px-3 pb-1.5">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              Field types
            </span>
          </div>

          {/* Field type list */}
          <div className="max-h-[320px] overflow-y-auto">
            {FIELD_TYPES.map((ft) => {
              const Icon = ft.icon;
              return (
                <button
                  key={ft.id}
                  onClick={() => handleSelectType(ft)}
                  className="w-full flex items-center gap-2.5 px-3 h-9 text-[13px] text-gray-700 hover:bg-black/[0.04] transition-colors text-left cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{ft.label}</span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="mx-3 border-t border-gray-200" />

          {/* From library */}
          <div className="py-1.5">
            <button
              onClick={handleFromLibrary}
              className="w-full flex items-center gap-2.5 px-3 h-9 text-[13px] text-gray-700 hover:bg-black/[0.04] transition-colors text-left cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>From library</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
