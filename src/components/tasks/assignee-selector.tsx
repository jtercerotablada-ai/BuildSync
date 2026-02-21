'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Mail, Users, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface AssigneeSelectorProps {
  value: User | null;
  onChange: (user: User | null) => void;
  trigger: React.ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AssigneeSelector({ value, onChange, trigger }: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value?.name || '');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch users when search changes
  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 200);
    return () => clearTimeout(debounce);
  }, [search, open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open]);

  // Update search when value changes
  useEffect(() => {
    if (value) {
      setSearch(value.name || '');
    }
  }, [value]);

  const handleSelect = (user: User) => {
    onChange(user);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  const handleInviteByEmail = () => {
    toast.info('Email invitation coming soon');
    setOpen(false);
  };

  const handleAssignMultiple = () => {
    toast.info('Multiple assignees coming soon');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* ========== INPUT DE BÚSQUEDA ========== */}
        <div className="flex items-center border-b p-2 gap-2">
          {value ? (
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={value.image || undefined} />
              <AvatarFallback className="text-xs bg-blue-600 text-white">
                {getInitials(value.name || 'U')}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          )}

          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a name or email"
            className="flex-1 border-0 p-0 h-7 focus-visible:ring-0 text-sm"
          />

          {(value || search) && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ========== LISTA DE USUARIOS ========== */}
        <div className="max-h-[200px] overflow-y-auto">
          {loading && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              Searching...
            </div>
          )}

          {!loading && users.length === 0 && search && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No users found
            </div>
          )}

          {!loading && users.map((user: User) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left',
                value?.id === user.id && 'bg-blue-50'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="text-xs bg-blue-600 text-white">
                  {getInitials(user.name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* ========== OPCIONES ADICIONALES ========== */}
        <div className="border-t">
          <button
            onClick={handleInviteByEmail}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
          >
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm text-blue-600">
              Invite teammates by email
            </span>
          </button>

          <button
            onClick={handleAssignMultiple}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
          >
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm text-blue-600">
              Assign to multiple people
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
