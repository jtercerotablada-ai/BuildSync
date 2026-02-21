'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ChevronDown,
  MoreHorizontal,
  Check,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WidgetSize } from '@/types/dashboard';

interface Person {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role?: string;
}

interface PeopleWidgetProps {
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  onRemove?: () => void;
  onInvite?: () => void;
}

export function PeopleWidget({ size = 'half', onSizeChange, onRemove, onInvite }: PeopleWidgetProps) {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'frequent' | 'all'>('frequent');

  useEffect(() => {
    async function fetchPeople() {
      setLoading(true);
      try {
        const limit = filter === 'all' ? 12 : 6;
        const res = await fetch(`/api/users?limit=${limit}&filter=${filter}`);
        if (res.ok) {
          const data = await res.json();
          setPeople(data);
        }
      } catch (error) {
        console.error('Failed to fetch people:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPeople();
  }, [filter]);

  const handleInvite = () => {
    if (onInvite) {
      onInvite();
    } else {
      router.push('/team?invite=true');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">People</h3>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                {filter === 'frequent' ? 'Frequent collaborators' : 'All'}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilter('frequent')}>
                Frequent collaborators
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('all')}>
                All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ===== DROPDOWN 3 PUNTOS ===== */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {/* Invite */}
            <DropdownMenuItem
              onClick={handleInvite}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Invite
            </DropdownMenuItem>

            <DropdownMenuSeparator />

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
          <div className="flex gap-4 justify-center py-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-12 h-12 rounded-full bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : people.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            {/* People icon */}
            <div className="relative mb-4">
              <div className="flex items-end">
                {/* Person outline (back) */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-300 bg-white" />
                  <div
                    className="w-8 h-4 border-2 border-gray-300 border-t-0 rounded-b-full bg-white mx-auto -mt-1"
                    style={{ marginLeft: '4px' }}
                  />
                </div>
                {/* Person filled (front) */}
                <div className="relative -ml-4">
                  <div className="w-12 h-12 rounded-full bg-gray-300" />
                  <div className="w-12 h-5 bg-gray-300 rounded-b-full -mt-1" />
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-sm mb-4">
              Invite your teammates to collaborate in BuildSync
            </p>

            <Button
              variant="outline"
              onClick={handleInvite}
            >
              Invite teammates
            </Button>
          </div>
        ) : (
          /* Lista de personas */
          <div className="flex flex-wrap gap-4 justify-center py-4">
            {people.map((person) => (
              <button
                key={person.id}
                className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => router.push(`/team`)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={person.image || undefined} />
                  <AvatarFallback className="bg-gray-900 text-white">
                    {person.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-600 max-w-[60px] truncate">
                  {person.name?.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
