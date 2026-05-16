"use client";

/**
 * Emoji picker inside a popover. Wraps `frimousse` with our shadcn
 * popover so the trigger and surface match the rest of the product.
 * The trigger is the children passed in — typically a button rendering
 * the current emoji.
 */

import { type ReactNode, useState } from "react";
import { EmojiPicker } from "frimousse";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EmojiPickerPopoverProps {
  /** Trigger element — typically a button showing the current emoji */
  children: ReactNode;
  /** Called with the new emoji string when the user picks one */
  onSelect: (emoji: string) => void;
  /** Popover alignment relative to trigger */
  align?: "start" | "center" | "end";
}

export function EmojiPickerPopover({
  children,
  onSelect,
  align = "start",
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[320px] p-0 rounded-xl border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        <EmojiPicker.Root
          className="isolate flex h-[360px] w-full flex-col bg-white"
          onEmojiSelect={({ emoji }) => {
            onSelect(emoji);
            setOpen(false);
          }}
        >
          <EmojiPicker.Search
            placeholder="Search"
            className="z-10 mx-3 mt-3 mb-2 appearance-none rounded-lg bg-gray-50 px-3 py-2 text-[13px] outline-none placeholder:text-gray-400 focus:bg-white focus:ring-1 focus:ring-black/10"
          />
          <EmojiPicker.Viewport className="relative flex-1 outline-none">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-[13px] text-gray-400">
              Loading…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-[13px] text-gray-400">
              No emoji found
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="select-none pb-2"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    {...props}
                    className="bg-white px-3 pt-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-400"
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div {...props} className="scroll-my-1.5 px-1.5">
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    {...props}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-[20px] leading-none",
                      "data-[active]:bg-gray-100"
                    )}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
