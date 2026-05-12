'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, X, Lock, Info, Sparkles, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WidgetType, WidgetSize, AVAILABLE_WIDGETS } from '@/types/dashboard';

// Custom action for widget menu
export interface WidgetMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface WidgetContainerProps {
  id: WidgetType;
  children: React.ReactNode;
  onHide: (id: WidgetType) => void;
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  hideHeader?: boolean; // For widgets with custom headers (like MyTasksWidget)
  menuActions?: WidgetMenuAction[]; // Custom actions to show at top of menu
}

// Overlay component for drag preview
interface WidgetOverlayProps {
  id: WidgetType;
  size?: WidgetSize;
}

export function WidgetOverlay({ id, size = 'half' }: WidgetOverlayProps) {
  const widget = AVAILABLE_WIDGETS.find(w => w.id === id);

  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 border-black shadow-2xl',
        'h-[320px] flex flex-col',
        size === 'full' ? 'w-full' : 'w-[calc(50%-12px)]',
      )}
      style={{
        transform: 'rotate(2deg) scale(1.02)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Header */}
      <div className="flex items-center px-4 py-3 flex-shrink-0 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{widget?.title}</h3>
      </div>
      {/* Placeholder content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-300 text-sm">Moving widget...</div>
      </div>
    </div>
  );
}

export function WidgetContainer({ id, children, onHide, size = 'half', onSizeChange, hideHeader = false, menuActions }: WidgetContainerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id,
    transition: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // CSS.Translate prevents scale distortion with variable-sized grid items
  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: isDragging ? 'none' : transition,
  };

  const widget = AVAILABLE_WIDGETS.find(w => w.id === id);

  // Render title icon if it exists
  const renderTitleIcon = () => {
    if (!widget?.titleIcon) return null;

    switch (widget.titleIcon) {
      case 'lock':
        return <Lock className="h-3.5 w-3.5 text-gray-400" />;
      case 'info':
        return <Info className="h-3.5 w-3.5 text-gray-400" />;
      case 'sparkles':
        return <Sparkles className="h-3.5 w-3.5 text-[#a8893a]" />;
      default:
        return null;
    }
  };

  // Shared menu — same options whether we render the legacy chrome
  // or the floating "naked" mode for PMI tiles.
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            hideHeader
              ? "bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-gray-500 hover:text-black hover:bg-white"
              : "h-8 w-8 text-gray-400 hover:text-gray-600"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Custom actions */}
        {menuActions && menuActions.length > 0 && (
          <>
            {menuActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={action.onClick}
                className="cursor-pointer"
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {/* Size options */}
        {onSizeChange && (
          <>
            <DropdownMenuItem
              onClick={() => onSizeChange("half")}
              className="cursor-pointer"
            >
              {size === "half" ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <span className="w-4 mr-2" />
              )}
              Half size
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSizeChange("full")}
              className="cursor-pointer"
            >
              {size === "full" ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <span className="w-4 mr-2" />
              )}
              Full size
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Remove widget */}
        <DropdownMenuItem
          onClick={() => onHide(id)}
          className="text-black focus:text-black focus:bg-gray-100 cursor-pointer"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove widget
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative h-full flex flex-col",
        // Size determines column span
        size === "full" ? "col-span-1 md:col-span-2" : "col-span-1",
        // Chrome only when the widget doesn't bring its own (classic
        // Asana widgets). PMI tiles render their own card frame, so we
        // stay invisible and avoid the double-border artifact on the
        // corners.
        !hideHeader &&
          "bg-white rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md",
        // Dragging state
        isDragging &&
          (hideHeader
            ? "opacity-40"
            : "opacity-40 border-2 border-dashed border-gray-400 bg-gray-50 shadow-inner"),
        // Hover-over target during drag
        isOver && !isDragging && "ring-2 ring-black ring-offset-2 rounded-2xl"
      )}
    >
      {!hideHeader ? (
        /* ── Classic widget chrome — header + menu inline ───────── */
        <>
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                {widget?.title}
                {renderTitleIcon()}
              </h3>
            </div>
            {menu}
          </div>
          <div className="flex-1 overflow-hidden px-4 pb-4">{children}</div>
        </>
      ) : (
        /* ── Naked mode — child controls all chrome.
              Drag handle covers the top 56px (leaves 48px on the right
              for the floating menu button). The menu floats absolute. */
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute top-0 left-0 right-12 h-14 cursor-grab active:cursor-grabbing touch-none z-[5]"
          />
          <div className="absolute top-2 right-2 z-10">{menu}</div>
          <div className="flex-1 overflow-hidden">{children}</div>
        </>
      )}
    </div>
  );
}
