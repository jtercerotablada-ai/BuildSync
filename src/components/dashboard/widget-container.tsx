'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, GripVertical, X, Settings, Lock, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WidgetType, AVAILABLE_WIDGETS } from '@/types/dashboard';

interface WidgetContainerProps {
  id: WidgetType;
  children: React.ReactNode;
  onHide: (id: WidgetType) => void;
}

export function WidgetContainer({ id, children, onHide }: WidgetContainerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const widget = AVAILABLE_WIDGETS.find(w => w.id === id);

  // Renderizar icono del título si existe
  const renderTitleIcon = () => {
    if (!widget?.titleIcon) return null;

    switch (widget.titleIcon) {
      case 'lock':
        return <Lock className="h-3.5 w-3.5 text-gray-400" />;
      case 'info':
        return <Info className="h-3.5 w-3.5 text-gray-400" />;
      case 'sparkles':
        return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm group',
        'transition-all duration-200 hover:shadow-md',
        // TODOS LOS WIDGETS DEL MISMO TAMAÑO - altura fija cuadrada
        'h-[320px] flex flex-col',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-blue-500 z-50',
      )}
    >
      {/* Widget Header - Estilo Asana */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Drag Handle - 6 puntos como Asana, visible solo en hover */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Título con icono opcional */}
          <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
            {widget?.title}
            {renderTitleIcon()}
          </h3>
        </div>

        {/* Widget Menu - Tres puntos */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              Widget settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onHide(id)}
              className="text-red-600 focus:text-red-600"
            >
              <X className="h-4 w-4 mr-2" />
              Remove widget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Widget Content - Flex grow para llenar espacio, con overflow hidden */}
      <div className="flex-1 px-4 pb-4 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
