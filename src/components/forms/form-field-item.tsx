'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDownSquare,
  CheckSquare,
  User,
  Paperclip,
  GripVertical,
  Copy,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Tipos de campo disponibles
const fieldTypes = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'paragraph', label: 'Paragraph', icon: AlignLeft },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'single-select', label: 'Single-select', icon: ChevronDownSquare },
  { value: 'multi-select', label: 'Multi-select', icon: CheckSquare },
  { value: 'people', label: 'People', icon: User },
  { value: 'attachment', label: 'Attachment', icon: Paperclip },
];

export interface FormFieldData {
  id: string;
  type: string;
  label: string;
  description?: string;
  required: boolean;
  connectedField?: string;
  placeholder?: string;
  allowMultiple?: boolean;
}

interface FormFieldItemProps {
  field: FormFieldData;
  isFirst: boolean;
  isLast: boolean;
  projectFields?: { id: string; name: string }[];
  onUpdate: (updates: Partial<FormFieldData>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

export function FormFieldItem({
  field,
  isFirst,
  isLast,
  projectFields = [],
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  dragHandleProps,
}: FormFieldItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDescription, setShowDescription] = useState(!!field.description);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAttachment = field.type === 'attachment';

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Ignorar clicks en portales de Select (dropdowns)
      if (target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }

      // Ignorar clicks en el overlay de Select
      if (target.closest('[data-radix-select-content]')) {
        return;
      }

      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      // Usar setTimeout para evitar que el click que abre el campo lo cierre inmediatamente
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const currentType = fieldTypes.find(t => t.value === field.type) || fieldTypes[0];
  const TypeIcon = currentType.icon;

  // ========== ATTACHMENT - Estado colapsado ==========
  if (!isExpanded && isAttachment) {
    return (
      <div
        ref={containerRef}
        onClick={() => setIsExpanded(true)}
        className="bg-white border rounded-lg p-4 mb-3 cursor-pointer hover:border-gray-300 transition-colors group"
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            {...dragHandleProps}
            className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>

          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 block mb-3">
              {field.label || 'New question'}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {/* Drop zone preview */}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
              <button
                className="px-4 py-2 border rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50"
                onClick={(e) => e.stopPropagation()}
              >
                Select a file...
              </button>
              <p className="text-sm text-gray-500 mt-3">or drag and drop a file here</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== ATTACHMENT - Estado expandido ==========
  if (isExpanded && isAttachment) {
    return (
      <div
        ref={containerRef}
        className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-3"
      >
        {/* Header con icono */}
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Attachment</span>
        </div>

        {/* Question Name Input */}
        <div className="mb-3">
          <Input
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="text-base font-medium bg-white border-2 border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="New question"
            autoFocus
          />
        </div>

        {/* Question Description */}
        {showDescription ? (
          <Input
            value={field.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="mb-4 text-sm bg-white"
            placeholder="Add question description"
          />
        ) : (
          <button
            onClick={() => setShowDescription(true)}
            className="text-sm text-gray-400 hover:text-gray-600 mb-4 block"
          >
            Add question description
          </button>
        )}

        {/* Attachment Options */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Attachment options</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.allowMultiple || false}
              onChange={(e) => onUpdate({ allowMultiple: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Allow multiple attachments</span>
          </label>
        </div>

        {/* Footer: Required toggle + Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          {/* Required toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={field.required}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
              className="data-[state=checked]:bg-blue-500"
            />
            <span className="text-sm text-gray-600">Required</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Move down */}
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className={cn(
                "p-2 rounded hover:bg-gray-200 transition-colors",
                isLast && "opacity-30 cursor-not-allowed"
              )}
            >
              <ArrowDown className="h-4 w-4 text-gray-500" />
            </button>

            {/* Move up */}
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className={cn(
                "p-2 rounded hover:bg-gray-200 transition-colors",
                isFirst && "opacity-30 cursor-not-allowed"
              )}
            >
              <ArrowUp className="h-4 w-4 text-gray-500" />
            </button>

            {/* Duplicate */}
            {onDuplicate && (
              <button
                onClick={onDuplicate}
                className="p-2 rounded hover:bg-gray-200 transition-colors"
              >
                <Copy className="h-4 w-4 text-gray-500" />
              </button>
            )}

            {/* Delete */}
            <button
              onClick={onDelete}
              className="p-2 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== NORMAL FIELDS - Estado colapsado ==========
  if (!isExpanded) {
    return (
      <div
        ref={containerRef}
        onClick={() => setIsExpanded(true)}
        className="bg-white border rounded-lg p-4 mb-3 cursor-pointer hover:border-gray-300 transition-colors group"
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <button
            {...dragHandleProps}
            className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>

          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {field.description && (
              <p className="text-xs text-gray-500 mt-1">{field.description}</p>
            )}

            {/* Input preview */}
            <div className="mt-2 border rounded-md h-9 bg-gray-50" />
          </div>
        </div>
      </div>
    );
  }

  // Estado expandido
  return (
    <div
      ref={containerRef}
      className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-3"
    >
      {/* Header: Field & Type */}
      <div className="flex gap-4 mb-4">
        {/* Connect to field */}
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">
            Field
          </label>
          <Select
            value={field.connectedField || ''}
            onValueChange={(value) => onUpdate({ connectedField: value })}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Connect to field" />
            </SelectTrigger>
            <SelectContent>
              {projectFields.length === 0 ? (
                <SelectItem value="none" disabled>No fields available</SelectItem>
              ) : (
                projectFields.map((pf) => (
                  <SelectItem key={pf.id} value={pf.id}>
                    {pf.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="w-48">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">
            Type
          </label>
          <Select
            value={field.type}
            onValueChange={(value) => onUpdate({ type: value })}
          >
            <SelectTrigger className="bg-white">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 text-gray-500" />
                  <span>{currentType.label}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span>{type.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Question Name */}
      <div className="mb-3">
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="text-base font-medium bg-white border-2 border-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Question"
          autoFocus
        />
      </div>

      {/* Question Description */}
      {showDescription ? (
        <Input
          value={field.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="mb-4 text-sm bg-white"
          placeholder="Add question description"
        />
      ) : (
        <button
          onClick={() => setShowDescription(true)}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 block"
        >
          Add question description
        </button>
      )}

      {/* Footer: Required toggle + Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        {/* Required toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
            className="data-[state=checked]:bg-blue-500"
          />
          <span className="text-sm text-gray-600">Required</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Move down */}
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={cn(
              "p-2 rounded hover:bg-gray-200 transition-colors",
              isLast && "opacity-30 cursor-not-allowed"
            )}
          >
            <ArrowDown className="h-4 w-4 text-gray-500" />
          </button>

          {/* Move up */}
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={cn(
              "p-2 rounded hover:bg-gray-200 transition-colors",
              isFirst && "opacity-30 cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-4 w-4 text-gray-500" />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-2 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
