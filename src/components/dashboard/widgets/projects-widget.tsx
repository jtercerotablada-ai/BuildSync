'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  color: string;
  icon?: string;
  status: string;
  _count?: {
    tasks: number;
  };
}

type SortOption = 'recent' | 'alphabetical' | 'status';

interface ProjectsWidgetProps {
  onCreateProject?: () => void;
}

export function ProjectsWidget({ onCreateProject }: ProjectsWidgetProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch(`/api/projects?sort=${sortBy}&limit=4`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [sortBy]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return 'On track';
      case 'AT_RISK': return 'At risk';
      case 'OFF_TRACK': return 'Off track';
      case 'COMPLETE': return 'Complete';
      default: return '';
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'ON_TRACK': return 'bg-white text-black border border-black';
      case 'AT_RISK': return 'bg-white text-black border border-black';
      case 'OFF_TRACK': return 'bg-white text-black border border-black';
      case 'COMPLETE': return 'bg-white text-black border border-black';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Your projects</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-gray-500">
                {sortBy === 'recent' ? 'Recent' : sortBy === 'alphabetical' ? 'A-Z' : 'Status'}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSortBy('recent')}>Recent</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>Alphabetical</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('status')}>Status</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-black hover:text-black gap-1 h-7"
          onClick={onCreateProject}
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FolderKanban className="h-10 w-10 text-gray-300 mb-2" />
            <p className="font-medium text-gray-900 mb-1">No projects yet</p>
            <p className="text-sm text-gray-500 mb-3">Create your first project</p>
            <Button onClick={onCreateProject} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Create project button */}
            <button
              onClick={onCreateProject}
              className="w-full flex items-center gap-3 p-2 rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-gray-500"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm">Create project</span>
            </button>

            {/* Project cards */}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: project.color || '#3B82F6' }}
                >
                  {project.icon || project.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">{project.name}</p>
                  <p className="text-xs text-gray-500">
                    {project._count?.tasks || 0} tasks
                  </p>
                </div>
                {project.status && getStatusLabel(project.status) && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                    getStatusClasses(project.status)
                  )}>
                    {getStatusLabel(project.status)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
