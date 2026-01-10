'use client';

import { useRef } from 'react';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Plus,
  Download,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
}

function getFileIcon(mimeType: string) {
  const iconClass = "h-8 w-8";
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime === 'application/pdf') {
    return <FileText className={cn(iconClass, "text-red-500")} />;
  }
  if (lowerMime.startsWith('image/')) {
    return <Image className={cn(iconClass, "text-blue-500")} />;
  }
  if (lowerMime.includes('spreadsheet') || lowerMime.includes('excel') || lowerMime === 'text/csv') {
    return <FileSpreadsheet className={cn(iconClass, "text-green-600")} />;
  }
  if (lowerMime.includes('word') || lowerMime.includes('document')) {
    return <FileText className={cn(iconClass, "text-blue-600")} />;
  }
  return <File className={cn(iconClass, "text-gray-500")} />;
}

function getFileBgColor(mimeType: string) {
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime === 'application/pdf') return 'bg-red-50';
  if (lowerMime.startsWith('image/')) return 'bg-blue-50';
  if (lowerMime.includes('spreadsheet') || lowerMime.includes('excel') || lowerMime === 'text/csv') return 'bg-green-50';
  if (lowerMime.includes('word') || lowerMime.includes('document')) return 'bg-blue-50';
  return 'bg-gray-50';
}

function getFileExtension(fileName: string) {
  const ext = fileName.split('.').pop()?.toUpperCase() || '';
  return ext;
}

export function TaskAttachments({ taskId, attachments, onUpload, onDelete }: TaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = '';
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(attachment.url, '_blank');
  };

  const handleDelete = (attachmentId: string) => {
    if (confirm('Are you sure you want to delete this attachment?')) {
      onDelete(attachmentId);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-gray-700">Attachments</span>
      <div className="flex flex-wrap gap-3">
        {attachments.map((attachment) => (
          <DropdownMenu key={attachment.id}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all min-w-[200px]',
                  getFileBgColor(attachment.mimeType)
                )}
              >
                <div className="flex-shrink-0">
                  {getFileIcon(attachment.mimeType)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getFileExtension(attachment.name)} · Download
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleDownload(attachment)}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(attachment.url, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(attachment.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}

        <button
          onClick={handleFileSelect}
          className="flex items-center justify-center w-[80px] h-[72px] rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <Plus className="h-6 w-6 text-gray-400" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
      </div>
    </div>
  );
}
