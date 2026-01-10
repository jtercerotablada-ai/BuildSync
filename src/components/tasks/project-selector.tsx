'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectOwner {
  id: string;
  name: string | null;
  image?: string | null;
}

interface Project {
  id: string;
  name: string;
  color?: string | null;
  owner?: ProjectOwner | null;
}

interface ProjectSelectorProps {
  value: Project | null;
  onChange: (project: Project | null) => void;
  excludeIds?: string[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ProjectSelector({ value, onChange, excludeIds = [] }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch projects when search changes
  useEffect(() => {
    if (!open) return;

    const fetchProjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProjects, 200);
    return () => clearTimeout(debounce);
  }, [search, open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Filter out excluded and already selected projects
  const availableProjects = projects.filter(
    (p) => !excludeIds.includes(p.id) && p.id !== value?.id
  );

  const handleSelect = (project: Project) => {
    onChange(project);
    setSearch('');
    setOpen(false);
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* Proyecto asignado */}
      {value && (
        <div className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded group">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: value.color || '#22C55E' }}
            />
            <span className="text-sm font-medium">{value.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {value.owner && (
              <Avatar className="h-6 w-6">
                <AvatarImage src={value.owner.image || undefined} />
                <AvatarFallback className="text-xs bg-blue-600 text-white">
                  {getInitials(value.owner.name || 'U')}
                </AvatarFallback>
              </Avatar>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRemove}>
                  Remove from project
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Open project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Sin proyecto: mostrar link "+ Add to projects" */}
      {/* Con proyecto: mostrar input para agregar más */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {value ? (
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add this task to a project..."
              className="h-9 text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          ) : (
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <Plus className="h-4 w-4" />
              <span>Add to projects</span>
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-0"
          align="start"
          sideOffset={4}
        >
          {/* Lista de proyectos disponibles */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Searching...
              </div>
            )}

            {!loading && availableProjects.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {search ? 'No projects found' : 'No projects available'}
              </div>
            )}

            {!loading && availableProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: project.color || '#22C55E' }}
                  />
                  <span className="text-sm">{project.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {project.owner && (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={project.owner.image || undefined} />
                      <AvatarFallback className="text-xs bg-blue-600 text-white">
                        {getInitials(project.owner.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="p-1">
                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
