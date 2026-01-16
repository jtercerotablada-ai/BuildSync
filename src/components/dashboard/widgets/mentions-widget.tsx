'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  MoreHorizontal,
  Check,
  Trash2,
  Info,
} from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WidgetSize } from '@/types/dashboard';

interface Mention {
  id: string;
  content: string;
  taskId: string;
  taskName: string;
  projectId: string | null;
  createdAt: string;
  author: {
    name: string;
    image: string | null;
  };
}

interface MentionsWidgetProps {
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  onRemove?: () => void;
}

export function MentionsWidget({ size = 'half', onSizeChange, onRemove }: MentionsWidgetProps) {
  const router = useRouter();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMentions() {
      try {
        const res = await fetch('/api/mentions?limit=5');
        if (res.ok) {
          const data = await res.json();
          setMentions(data);
        }
      } catch (error) {
        console.error('Failed to fetch mentions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMentions();
  }, []);

  const formatDate = (date: string) => {
    const now = new Date();
    const d = new Date(date);
    const diff = now.getTime() - d.getTime();

    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Comments mentioning me</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Comments where you are @-mentioned</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* ===== DROPDOWN 3 PUNTOS ===== */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {/* Half size */}
            <DropdownMenuItem
              onClick={() => onSizeChange?.('half')}
              className="cursor-pointer"
            >
              {size === 'half' && <Check className="h-4 w-4 mr-2" />}
              {size !== 'half' && <span className="w-4 mr-2" />}
              Half size
            </DropdownMenuItem>

            {/* Full size */}
            <DropdownMenuItem
              onClick={() => onSizeChange?.('full')}
              className="cursor-pointer"
            >
              {size === 'full' && <Check className="h-4 w-4 mr-2" />}
              {size !== 'full' && <span className="w-4 mr-2" />}
              Full size
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Remove widget */}
            <DropdownMenuItem
              onClick={onRemove}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove widget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ========== CONTENT ========== */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : mentions.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="h-16 w-16 text-gray-200 mb-4" />
            <p className="text-gray-500 text-sm">
              When you are @-mentioned in a comment, it will appear here.
            </p>
          </div>
        ) : (
          /* Lista de menciones */
          <div className="space-y-2">
            {mentions.map((mention) => (
              <button
                key={mention.id}
                className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                onClick={() => {
                  if (mention.projectId) {
                    router.push(`/projects/${mention.projectId}?task=${mention.taskId}`);
                  } else {
                    router.push(`/my-tasks?task=${mention.taskId}`);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={mention.author.image || undefined} />
                    <AvatarFallback className="text-xs bg-gray-900 text-white">
                      {mention.author.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{mention.author.name}</span>
                      <span className="text-xs text-gray-500">{formatDate(mention.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{mention.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      on {mention.taskName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
