'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Paperclip, AtSign, Smile, Send, ArrowUpDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Activity {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface TaskCommentsSectionProps {
  taskId: string;
  comments: Comment[];
  activities: Activity[];
  onCommentAdd: (content: string) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatActivityDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (d.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

function renderActivityText(activity: Activity): React.ReactNode {
  const data = activity.data as Record<string, string> | undefined;

  switch (activity.type) {
    case 'TASK_CREATED':
      return 'created this task';
    case 'TASK_COMPLETED':
      return 'completed this task';
    case 'TASK_UNCOMPLETED':
      return 'marked this task incomplete';
    case 'TASK_ASSIGNED':
      return 'assigned this task';
    case 'TASK_UNASSIGNED':
      return 'unassigned this task';
    case 'TASK_MOVED':
      return 'moved this task';
    case 'TASK_RENAMED':
      return (
        <>
          renamed this task to <span className="font-medium">{data?.newName}</span>
        </>
      );
    case 'TASK_DESCRIPTION_CHANGED':
      return 'updated the description';
    case 'DUE_DATE_CHANGED':
      return (
        <>
          changed due date to{' '}
          <span className="text-blue-600">
            {data?.dueDate ? new Date(data.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'none'}
          </span>
        </>
      );
    case 'COMMENT_ADDED':
      return 'added a comment';
    case 'SUBTASK_ADDED':
      return (
        <>
          added subtask <span className="font-medium">{data?.subtaskName}</span>
        </>
      );
    default:
      return activity.type.toLowerCase().replace(/_/g, ' ');
  }
}

export function TaskCommentsSection({ taskId, comments, activities, onCommentAdd }: TaskCommentsSectionProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('activity');
  const [newComment, setNewComment] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('oldest');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const currentUser = {
    name: session?.user?.name || 'User',
    image: session?.user?.image || null,
  };

  // Combine comments and activities for "All activity" tab
  const allItems = activeTab === 'comments'
    ? comments.map(c => ({
        id: c.id,
        type: 'comment' as const,
        content: c.content,
        createdAt: c.createdAt,
        user: c.author,
      }))
    : [
        ...activities.map(a => ({
          id: a.id,
          type: a.type,
          content: null as string | null,
          createdAt: a.createdAt,
          user: a.user,
          data: a.data,
        })),
        ...comments.map(c => ({
          id: c.id,
          type: 'comment' as const,
          content: c.content,
          createdAt: c.createdAt,
          user: c.author,
          data: undefined,
        })),
      ];

  const sortedItems = [...allItems].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      onCommentAdd(newComment.trim());
      setNewComment('');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t">
      {/* ========== TABS HEADER ========== */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('comments')}
            className={cn(
              'text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors',
              activeTab === 'comments'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              'text-sm font-medium pb-2 -mb-3 border-b-2 transition-colors',
              activeTab === 'activity'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            All activity
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-gray-500 gap-1 h-7">
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOrder('newest')}>Newest first</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('oldest')}>Oldest first</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ========== ACTIVITY/COMMENTS LIST (PRIMERO) ========== */}
      <div className="px-6 py-4 space-y-3 min-h-[100px]">
        {sortedItems.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No activity yet
          </div>
        ) : (
          <>
            {/* Show first 2 items or all if expanded */}
            {(showAllActivity ? sortedItems : sortedItems.slice(0, 2)).map((item, index) => (
              <div key={item.id} className="flex items-start gap-3">
                {(index === 0 || item.type === 'comment') ? (
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarImage src={item.user.image || undefined} />
                    <AvatarFallback className="text-xs bg-blue-600 text-white">
                      {getInitials(item.user.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-7 flex-shrink-0" />
                )}
                <div className="flex-1 text-sm">
                  <span className="font-medium text-gray-900">{item.user.name}</span>
                  {' '}
                  {item.type === 'comment' ? (
                    <span className="text-gray-700">{item.content}</span>
                  ) : (
                    <span className="text-gray-600">
                      {renderActivityText({ ...item, data: ("data" in item ? item.data : undefined) } as Activity)}
                    </span>
                  )}
                  {' · '}
                  <span className="text-gray-400">{formatActivityDate(item.createdAt)}</span>
                </div>
              </div>
            ))}
            {/* Show "Show X previous updates" button */}
            {!showAllActivity && sortedItems.length > 2 && (
              <button
                onClick={() => setShowAllActivity(true)}
                className="text-sm text-blue-600 hover:underline pl-10"
              >
                Show {sortedItems.length - 2} previous updates
              </button>
            )}
          </>
        )}
      </div>

      {/* ========== COMMENT INPUT (DESPUÉS del activity) ========== */}
      <div className="px-6 py-4 border-t">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={currentUser.image || undefined} />
            <AvatarFallback className="text-xs bg-blue-600 text-white">
              {getInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            {/* Input con borde */}
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              className="min-h-[80px] resize-none border border-gray-200 rounded-lg"
            />
            {/* Toolbar visible siempre */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                  <AtSign className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Press Ctrl + Enter to send</span>
                <Button
                  size="sm"
                  disabled={!newComment.trim() || isSubmitting}
                  onClick={handleSubmit}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
