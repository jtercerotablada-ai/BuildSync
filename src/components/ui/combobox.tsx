"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Combobox — searchable select with single- or multi-select mode.
 * Built on cmdk (already installed) + existing Popover. Replaces
 * the bare @radix-ui/react-select usage in pickers like
 * assignee-selector.tsx, project pickers, team pickers where
 * users need to type-to-filter long lists.
 *
 * Multi-select mode shows selected items as inline chips inside
 * the trigger; clicking the chip's x removes that item without
 * closing the popover.
 */

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional element rendered to the left of the label (icon, avatar). */
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ComboboxBaseProps {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Width of the trigger button. Default "w-[220px]". */
  triggerWidth?: string;
  disabled?: boolean;
}

interface ComboboxSingleProps extends ComboboxBaseProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
}

interface ComboboxMultiProps extends ComboboxBaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type ComboboxProps = ComboboxSingleProps | ComboboxMultiProps;

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    emptyMessage = "No results.",
    className,
    triggerWidth = "w-[220px]",
    disabled,
  } = props;
  const [open, setOpen] = React.useState(false);

  const isMulti = props.multiple === true;
  const selectedValues = isMulti ? props.value : props.value ? [props.value] : [];

  // Used in the trigger to display either the single selection label
  // or the chip-style list of selected labels for multi mode.
  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));

  function toggle(value: string) {
    if (isMulti) {
      const next = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      (props as ComboboxMultiProps).onChange(next);
    } else {
      (props as ComboboxSingleProps).onChange(
        selectedValues[0] === value ? null : value
      );
      setOpen(false);
    }
  }

  function removeChip(value: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!isMulti) return;
    (props as ComboboxMultiProps).onChange(selectedValues.filter((v) => v !== value));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            triggerWidth,
            "justify-between font-normal text-[13px] h-9 px-2.5",
            !selectedOptions.length && "text-gray-500",
            className
          )}
        >
          {/* Multi-select renders chips up to a soft cap; single-select
              renders the single label. */}
          {selectedOptions.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : isMulti ? (
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {selectedOptions.slice(0, 2).map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-[11px]"
                >
                  {opt.label}
                  <button
                    type="button"
                    className="hover:bg-gray-200 rounded-full p-px"
                    onClick={(e) => removeChip(opt.value, e)}
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
              {selectedOptions.length > 2 && (
                <span className="text-[11px] text-gray-500">
                  +{selectedOptions.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate flex items-center gap-1.5">
              {selectedOptions[0].icon}
              {selectedOptions[0].label}
            </span>
          )}
          <ChevronsUpDown className="size-3.5 opacity-50 shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", triggerWidth)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    disabled={opt.disabled}
                    onSelect={() => toggle(opt.value)}
                    className="text-[13px]"
                  >
                    <Check
                      className={cn(
                        "mr-1.5 size-3.5",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {opt.icon && (
                      <span className="mr-1.5 inline-flex items-center">
                        {opt.icon}
                      </span>
                    )}
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
