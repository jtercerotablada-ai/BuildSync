'use client';

import { useRef } from 'react';
import {
  ThumbsUp,
  Paperclip,
  ListPlus,
  Link2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  XCircle,
  Check,
  Trash2,
  Copy,
  Archive,
  Flag,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskDetailToolbarProps {
  taskId: string;
  isCompleted: boolean;
  isLiked: boolean;
  likesCount: number;
  isFullscreen: boolean;
  onToggleComplete: () => void;
  onToggleLike: () => void;
  onAttachFile: (file: File) => void;
  onAddSubtask: () => void;
  onToggleFullscreen: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailToolbar({
  taskId,
  isCompleted,
  isLiked,
  likesCount,
  isFullscreen,
  onToggleComplete,
  onToggleLike,
  onAttachFile,
  onAddSubtask,
  onToggleFullscreen,
  onDuplicate,
  onArchive,
  onDelete,
  onClose,
}: TaskDetailToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachFile(file);
    }
    e.target.value = '';
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/tasks/${taskId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      onDelete();
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        {/* Mark Complete Button */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-2 rounded-full px-4',
            isCompleted && 'bg-green-50 border-green-300 text-green-700'
          )}
          onClick={onToggleComplete}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full border-2 flex items-center justify-center',
              isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-400'
            )}
          >
            {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
          {isCompleted ? 'Completed' : 'Mark complete'}
        </Button>

        {/* Action Icons */}
        <div className="flex items-center gap-0.5">
          {/* Like/Approve with counter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 px-2 gap-1',
                  likesCount > 0 ? 'text-blue-600' : 'text-gray-500'
                )}
                onClick={onToggleLike}
              >
                {likesCount > 0 && (
                  <span className="text-sm font-medium">{likesCount}</span>
                )}
                <ThumbsUp className={cn('h-4 w-4', likesCount > 0 && 'fill-current')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isLiked ? 'Remove like' : 'Like this task'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Attach File */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={handleAttachClick}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Attach file</p>
            </TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />

          {/* Add subtask */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={onAddSubtask}
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add subtask</p>
            </TooltipContent>
          </Tooltip>

          {/* Copy link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={handleCopyLink}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy task link</p>
            </TooltipContent>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</p>
            </TooltipContent>
          </Tooltip>

          {/* More options */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>More actions</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="h-4 w-4 mr-2" />
                Copy task link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserPlus className="h-4 w-4 mr-2" />
                Add collaborators
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Calendar className="h-4 w-4 mr-2" />
                Add to calendar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Flag className="h-4 w-4 mr-2" />
                Mark as milestone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                onClick={onClose}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Close</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
