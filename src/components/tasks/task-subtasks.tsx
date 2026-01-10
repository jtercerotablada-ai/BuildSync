'use client';

import { useState } from 'react';
import { Check, Plus, GripVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Subtask {
  id: string;
  name: string;
  completed: boolean;
  assignee?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface TaskSubtasksProps {
  taskId: string;
  subtasks: Subtask[];
  onSubtaskToggle: (subtaskId: string, completed: boolean) => void;
  onSubtaskAdd: (name: string) => void;
  onRefresh: () => void;
}

export function TaskSubtasks({
  taskId,
  subtasks,
  onSubtaskToggle,
  onSubtaskAdd,
  onRefresh,
}: TaskSubtasksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskName, setNewSubtaskName] = useState('');

  const handleAddSubtask = async () => {
    if (!newSubtaskName.trim()) {
      setIsAdding(false);
      return;
    }

    try {
      onSubtaskAdd(newSubtaskName);
      setNewSubtaskName('');
      setIsAdding(false);
    } catch (error) {
      toast.error('Failed to add subtask');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewSubtaskName('');
    }
  };

  const completedCount = subtasks.filter(s => s.completed).length;

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-700">Subtasks</h3>
          {subtasks.length > 0 && (
            <span className="text-xs text-gray-500">
              {completedCount}/{subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Subtasks List */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded hover:bg-gray-50 group"
          >
            {/* Drag Handle */}
            <GripVertical className="h-4 w-4 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab" />

            {/* Circular Checkbox */}
            <button
              onClick={() => onSubtaskToggle(subtask.id, subtask.completed)}
              className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                subtask.completed
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              {subtask.completed && (
                <Check className="h-2.5 w-2.5 text-white" />
              )}
            </button>

            {/* Subtask Name */}
            <span
              className={cn(
                'flex-1 text-sm',
                subtask.completed && 'line-through text-gray-400'
              )}
            >
              {subtask.name}
            </span>

            {/* Assignee Avatar */}
            {subtask.assignee && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={subtask.assignee.image || undefined} />
                <AvatarFallback className="text-[10px] bg-gray-200">
                  {subtask.assignee.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {/* Add Subtask Input */}
        {isAdding ? (
          <div className="flex items-center gap-2 py-1.5">
            <div className="w-4" /> {/* Spacer for drag handle */}
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
            <Input
              value={newSubtaskName}
              onChange={(e) => setNewSubtaskName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAddSubtask}
              placeholder="Write a subtask name"
              className="h-7 text-sm border-none shadow-none focus-visible:ring-0 px-0"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 py-1.5 text-gray-500 hover:text-gray-700 text-sm w-full"
          >
            <div className="w-4" /> {/* Spacer for drag handle */}
            <Plus className="h-4 w-4" />
            <span>Add subtask</span>
          </button>
        )}
      </div>
    </div>
  );
}
