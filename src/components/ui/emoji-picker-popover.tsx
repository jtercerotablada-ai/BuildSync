"use client";

/**
 * Emoji picker inside a popover. Wraps `frimousse` with our shadcn
 * popover so the trigger and surface match the rest of the product.
 * The trigger is the children passed in — typically a button rendering
 * the current emoji.
 *
 * Perf notes — frimousse fetches ~700 KB of emoji metadata from jsdelivr
 * on the very first open (subsequent opens read from localStorage and
 * feel instant). We mitigate the first-open lag two ways:
 *
 *   1. `prewarmEmojiData()` fires a background request to the CDN as
 *      soon as the trigger mounts, so the data is already in the
 *      browser's HTTP cache (and frimousse's localStorage) by the time
 *      the user actually clicks. It only runs once per session.
 *   2. We override the default shadcn popover animation (zoom + slide)
 *      with a 100 ms fade — the heavy spring felt "stuck" against the
 *      picker content settling. Matches Asana's snappier vibe.
 */

import { type ReactNode, useEffect, useState } from "react";
import { EmojiPicker } from "frimousse";
import { Ban } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CDN = "https://cdn.jsdelivr.net/npm/emojibase-data";

let prewarmed = false;
function prewarmEmojiData(locale = "en") {
  if (typeof window === "undefined" || prewarmed) return;
  prewarmed = true;
  // No-await — fire and forget. Two parallel fetches because frimousse
  // pulls both data.json and messages.json on first open.
  Promise.all([
    fetch(`${CDN}/${locale}/data.json`, { cache: "force-cache" }).catch(() => {}),
    fetch(`${CDN}/${locale}/messages.json`, { cache: "force-cache" }).catch(() => {}),
  ]);
}

interface EmojiPickerPopoverProps {
  /** Trigger element — typically a button showing the current emoji */
  children: ReactNode;
  /** Called with the new emoji string when the user picks one */
  onSelect: (emoji: string) => void;
  /** Optional: when provided, a "No icon" row clears the icon. */
  onClear?: () => void;
  /** Popover alignment relative to trigger */
  align?: "start" | "center" | "end";
}

export function EmojiPickerPopover({
  children,
  onSelect,
  onClear,
  align = "start",
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  // Prewarm the emoji dataset as soon as the trigger is in the DOM, so
  // by the time the user clicks the icon button the data is cached.
  useEffect(() => {
    prewarmEmojiData();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        // Override the default zoom+slide animation with a tight fade.
        // The picker content settling (rows, search input) on top of a
        // spring animation is what felt sluggish.
        className={cn(
          "w-[320px] p-0 rounded-xl border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden",
          "duration-100 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100",
          "data-[side=bottom]:slide-in-from-top-0 data-[side=top]:slide-in-from-bottom-0",
          "data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0"
        )}
      >
        <EmojiPicker.Root
          className="isolate flex h-[400px] w-full flex-col bg-white"
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
          {onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
            >
              <Ban className="h-3.5 w-3.5" />
              No icon
            </button>
          )}
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
