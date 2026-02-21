'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  MoreHorizontal,
  Check,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WidgetSize } from '@/types/dashboard';
import { AddFormModal } from '@/components/forms/add-form-modal';
import { FormBuilderModal } from '@/components/forms/form-builder-modal';
import { toast } from 'sonner';

interface Form {
  id: string;
  name: string;
  projectName: string;
  responsesCount: number;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  color?: string;
}

interface FormsWidgetProps {
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  onRemove?: () => void;
}

export function FormsWidget({ size = 'half', onSizeChange, onRemove }: FormsWidgetProps) {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recents' | 'all'>('recents');
  const [showAddFormModal, setShowAddFormModal] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [formBuilderData, setFormBuilderData] = useState<{
    projectId: string;
    projectName: string;
    visibility: 'anyone' | 'organization';
  } | null>(null);

  // Fetch projects once on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    }
    fetchProjects();
  }, []);

  // Fetch forms whenever filter changes
  useEffect(() => {
    async function fetchForms() {
      setLoading(true);
      try {
        const limit = filter === 'recents' ? 5 : 50;
        const res = await fetch(`/api/forms?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setForms(data);
        }
      } catch (error) {
        console.error('Failed to fetch forms:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchForms();
  }, [filter]);

  const handleCreateForm = () => {
    setShowAddFormModal(true);
  };

  const handleFormCreated = (data: { projectId: string; projectName: string; visibility: string }) => {
    // Open form builder modal instead of navigating
    setFormBuilderData({
      projectId: data.projectId,
      projectName: data.projectName,
      visibility: data.visibility as 'anyone' | 'organization',
    });
    setShowFormBuilder(true);
  };

  const handleFormPublished = async (formData: {
    name: string;
    description: string;
    visibility: 'anyone' | 'organization';
    fields: unknown[];
    projectId?: string;
  }) => {
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          fields: formData.fields,
          projectId: formData.projectId,
          visibility: formData.visibility,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create form');
      }

      toast.success('Form created successfully');

      // Refresh forms list
      const refreshLimit = filter === 'recents' ? 5 : 50;
      const formsRes = await fetch(`/api/forms?limit=${refreshLimit}`);
      if (formsRes.ok) {
        const formsData = await formsRes.json();
        setForms(formsData);
      }
    } catch (error) {
      console.error('Failed to save form:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create form');
    } finally {
      setShowFormBuilder(false);
      setFormBuilderData(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ========== HEADER ========== */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Forms</h3>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                {filter === 'recents' ? 'Recents' : 'All'}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilter('recents')}>
                Recents
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
            {/* New form */}
            <DropdownMenuItem
              onClick={handleCreateForm}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              New form
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
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : forms.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            {/* Form icon */}
            <div className="relative mb-4">
              <div className="w-16 h-20 border-2 border-gray-200 rounded-lg flex items-end justify-center pb-2">
                <div className="w-8 h-2 bg-gray-200 rounded" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-2 border-gray-200 rounded bg-white" />
            </div>

            <p className="text-gray-500 text-sm max-w-xs mb-4">
              Simplify how you manage work requests. Create a form to prioritize and track incoming work.
            </p>

            <Button
              variant="outline"
              onClick={handleCreateForm}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add new form
            </Button>
          </div>
        ) : (
          /* Lista de forms */
          <div className="space-y-2">
            {forms.map((form) => (
              <button
                key={form.id}
                className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                onClick={() => toast.info("Form details coming soon")}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{form.name}</p>
                    <p className="text-xs text-gray-500">{form.projectName}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {form.responsesCount} responses
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Form Modal */}
      <AddFormModal
        open={showAddFormModal}
        onClose={() => setShowAddFormModal(false)}
        onCreateForm={handleFormCreated}
        projects={projects}
      />

      {/* Form Builder Modal */}
      <FormBuilderModal
        open={showFormBuilder}
        onClose={() => {
          setShowFormBuilder(false);
          setFormBuilderData(null);
        }}
        initialFormName={formBuilderData?.projectName}
        projectId={formBuilderData?.projectId}
        projectName={formBuilderData?.projectName}
        visibility={formBuilderData?.visibility}
        onPublish={handleFormPublished}
      />
    </div>
  );
}
