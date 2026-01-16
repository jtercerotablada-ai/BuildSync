'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Globe, Building2, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  color?: string;
}

interface AddFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreateForm: (data: { projectId: string; projectName: string; visibility: string }) => void;
  projects?: Project[];
}

const visibilityOptions = [
  {
    value: 'anyone',
    icon: Globe,
    label: 'Anyone can access',
    description: 'Anyone can access and submit the form.',
  },
  {
    value: 'organization',
    icon: Building2,
    label: 'Organization only',
    description: 'Only your organization can access and submit the form.',
  },
];

export function AddFormModal({
  open,
  onClose,
  onCreateForm,
  projects = [],
}: AddFormModalProps) {
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [visibility, setVisibility] = useState<'organization' | 'anyone'>('organization');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const visibilityRef = useRef<HTMLDivElement>(null);

  // Filter projects by search
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (visibilityRef.current && !visibilityRef.current.contains(e.target as Node)) {
        setVisibilityOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setProjectSearch('');
      setSelectedProject(null);
      setVisibility('organization');
      setShowProjectDropdown(false);
      setVisibilityOpen(false);
    }
  }, [open]);

  const handleCreate = () => {
    if (!selectedProject) return;
    onCreateForm({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      visibility,
    });
    onClose();
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setProjectSearch(project.name);
    setShowProjectDropdown(false);
  };

  const selectedVisibility = visibilityOptions.find(o => o.value === visibility);
  const SelectedIcon = selectedVisibility?.icon || Building2;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add form to project</DialogTitle>
          <DialogDescription>
            Responses are saved to a project when a form is submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Select a project */}
          <div className="space-y-2">
            <Label htmlFor="project">Select a project</Label>
            <div className="relative">
              <Input
                ref={projectInputRef}
                id="project"
                value={projectSearch}
                onChange={(e) => {
                  setProjectSearch(e.target.value);
                  setSelectedProject(null);
                  setShowProjectDropdown(true);
                }}
                onFocus={() => setShowProjectDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown items
                  setTimeout(() => setShowProjectDropdown(false), 200);
                }}
                placeholder="Name of the project"
                className="w-full"
              />

              {/* Project dropdown */}
              {showProjectDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      {projectSearch ? 'No projects found' : 'Type to search projects'}
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleProjectSelect(project)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color || '#000' }}
                        />
                        <span className="text-sm">{project.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Select visibility */}
          <div className="space-y-2">
            <Label>
              Select who can view and submit this form (you can change at anytime)
            </Label>
            <div className="relative" ref={visibilityRef}>
              <button
                type="button"
                onClick={() => setVisibilityOpen(!visibilityOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-lg hover:border-gray-400 bg-white"
              >
                <div className="flex items-center gap-2">
                  <SelectedIcon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm">{selectedVisibility?.label}</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-gray-500 transition-transform",
                  visibilityOpen && "rotate-180"
                )} />
              </button>

              {visibilityOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = visibility === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setVisibility(option.value as 'anyone' | 'organization');
                          setVisibilityOpen(false);
                        }}
                        className="w-full px-3 py-3 text-left hover:bg-gray-50 flex items-start gap-3"
                      >
                        <div className="w-4 flex-shrink-0 mt-0.5">
                          {isSelected && <Check className="h-4 w-4 text-gray-900" />}
                        </div>
                        <Icon className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{option.label}</p>
                          <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedProject}
            className="bg-black hover:bg-gray-800"
          >
            Create form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
