"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/**
 * One drag-to-reorder slot in the project view tab strip.
 *
 * The slot — not the tab button inside it — carries the drag listeners, so the
 * button keeps every bit of its own behaviour: Enter/Space still opens the
 * view, and clicking the already-active tab still opens its context menu.
 *
 * dnd-kit's `attributes` are deliberately NOT spread here. They set
 * role="button" + tabIndex=0 on this wrapper, which would put a second tab
 * stop around a real button and nest one button role inside another, and their
 * aria-describedby advertises keyboard-drag instructions for a KeyboardSensor
 * this strip cannot register: that sensor activates on Space/Enter, which on a
 * tab button already means "open this view". Keyboard reordering is Alt+Arrow
 * instead, handled on the button in ProjectContent.
 */
export function SortableViewTab({
  viewKey,
  className,
  disabled = false,
  children,
}: {
  viewKey: string;
  /** Responsive display class for the slot ("flex" / "hidden md:flex"). */
  className?: string;
  /** True while this tab is being renamed — dragging a text field is not a drag. */
  disabled?: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: viewKey, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        // The strip is a single horizontal row: drop the y component so a drag
        // that wanders vertically never lifts a tab out of the row.
        transform: CSS.Transform.toString(
          transform ? { ...transform, y: 0 } : null
        ),
        transition,
        // NOT `touch-action: none`. The strip is the only scrollable thing at
        // this width, so killing the browser's pan gesture would leave the
        // overflowing tabs unreachable on the iPad. The TouchSensor's
        // long-press activation is what separates "scroll" from "drag" here.
        touchAction: "manipulation",
      }}
      {...listeners}
      className={cn(
        // `relative` anchors the active tab's context menu to the slot.
        "relative items-center",
        // Keep the dragged tab legible above the neighbours shifting past it.
        isDragging && "z-10 opacity-70",
        className
      )}
    >
      {children}
    </div>
  );
}
