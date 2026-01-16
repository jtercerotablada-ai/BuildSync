'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Globe,
  Star,
  Eye,
  Share2,
  Link2,
  MoreHorizontal,
  GripVertical,
  Mail,
  Paperclip,
  Heading1,
  Plus,
  Trash2,
  Image as ImageIcon,
  AlignLeft,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  FileCode,
  Sparkles,
  TextQuote,
  Smile,
  AtSign,
  Pilcrow,
  Loader2,
  Wand2,
  Minimize2,
  Maximize2,
  CheckCircle,
  Table2,
  Minus,
  Link,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Emoji picker data
const emojiCategories = [
  {
    name: 'Frecuentes',
    emojis: ['😀', '😂', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '✅', '⭐']
  },
  {
    name: 'Caras',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘']
  },
  {
    name: 'Gestos',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋', '🙌', '👏', '🤝', '💪']
  },
  {
    name: 'Objetos',
    emojis: ['💼', '📁', '📋', '📌', '📎', '✏️', '📝', '💡', '🔔', '⏰', '📅', '✅']
  },
];

// AI Assist options
const aiOptions = [
  { id: 'improve', icon: Wand2, label: 'Improve writing', prompt: 'Improve the following text, making it clearer and more professional:' },
  { id: 'summarize', icon: Minimize2, label: 'Summarize', prompt: 'Summarize the following text concisely:' },
  { id: 'expand', icon: Maximize2, label: 'Expand & detail', prompt: 'Expand and add more detail to the following text:' },
  { id: 'fix', icon: CheckCircle, label: 'Fix grammar', prompt: 'Fix any grammar and spelling errors in the following text:' },
];

// Mock users for mentions
const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com' },
];

// Types
interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  connectedField?: string;
  allowMultiple?: boolean;
}

interface FormBuilderModalProps {
  open: boolean;
  onClose: () => void;
  initialFormName?: string;
  projectId?: string;
  projectName?: string;
  visibility?: 'anyone' | 'organization';
  onPublish?: (formData: FormPublishData) => void;
}

interface FormPublishData {
  name: string;
  description: string;
  visibility: 'anyone' | 'organization';
  fields: FormField[];
  projectId?: string;
}

// Import FormFieldItem
import { FormFieldItem } from './form-field-item';
import { FormSettingsTab, FormSettingsState, getDefaultFormSettings } from './form-settings-tab';

// Sortable field wrapper component
function SortableFormField({
  field,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  field: FormField;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50")}
    >
      <FormFieldItem
        field={field}
        isFirst={isFirst}
        isLast={isLast}
        onUpdate={onUpdate}
        onDelete={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDuplicate={onDuplicate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}


export function FormBuilderModal({
  open,
  onClose,
  initialFormName = '',
  projectId,
  projectName,
  visibility: initialVisibility = 'anyone',
  onPublish,
}: FormBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
  const [isFavorite, setIsFavorite] = useState(false);
  const [formName, setFormName] = useState(initialFormName || projectName || 'Untitled form');
  const [formDescription, setFormDescription] = useState('');
  const [visibility, setVisibility] = useState<'anyone' | 'organization'>(initialVisibility);
  const [fields, setFields] = useState<FormField[]>([
    { id: '1', type: 'text', label: 'Name', required: true, placeholder: '' },
    { id: '2', type: 'email', label: 'Email address', required: true, placeholder: '' },
  ]);
  const [formSettings, setFormSettings] = useState<FormSettingsState>(() =>
    getDefaultFormSettings(projectId)
  );

  // Rich text editor state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showEmbedLink, setShowEmbedLink] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 2, cols: 2 });
  const [hoveredCell, setHoveredCell] = useState({ row: 0, col: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter users for mentions
  const filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // ==========================================
  // RICH TEXT EDITOR FUNCTIONS
  // ==========================================

  // Save selection
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  // Restore selection
  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && savedSelectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
    }
    editorRef.current?.focus();
  }, []);

  // Handle content change
  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setFormDescription(newContent);
    }
  }, []);

  // Insert text at cursor
  const insertText = useCallback((text: string) => {
    restoreSelection();
    document.execCommand('insertText', false, text);
    handleContentChange();
  }, [restoreSelection, handleContentChange]);

  // Execute command
  const execCommand = useCallback((command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    handleContentChange();
  }, [restoreSelection, handleContentChange]);

  // Insert Paragraph
  const insertParagraph = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertParagraph', false);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Bulleted List
  const insertBulletedList = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const currentNode = selection.anchorNode;
    const listItem = currentNode?.parentElement?.closest('li');
    if (listItem) {
      document.execCommand('insertUnorderedList', false);
    } else {
      document.execCommand('insertUnorderedList', false);
      setTimeout(() => {
        const li = editorRef.current?.querySelector('ul li:last-child');
        if (li && selection) {
          const newRange = document.createRange();
          newRange.setStart(li, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }, 0);
    }
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Numbered List
  const insertNumberedList = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const currentNode = selection.anchorNode;
    const listItem = currentNode?.parentElement?.closest('li');
    if (listItem) {
      document.execCommand('insertOrderedList', false);
    } else {
      document.execCommand('insertOrderedList', false);
      setTimeout(() => {
        const li = editorRef.current?.querySelector('ol li:last-child');
        if (li && selection) {
          const newRange = document.createRange();
          newRange.setStart(li, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }, 0);
    }
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Quote
  const insertQuote = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    let range: Range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    const blockquote = document.createElement('blockquote');
    blockquote.style.borderLeft = '3px solid #d1d5db';
    blockquote.style.paddingLeft = '12px';
    blockquote.style.margin = '8px 0';
    blockquote.style.color = '#6b7280';
    blockquote.style.fontStyle = 'italic';
    blockquote.innerHTML = '<br>';
    range.insertNode(blockquote);
    const newRange = document.createRange();
    newRange.selectNodeContents(blockquote);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Code Block
  const insertCodeBlock = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;
    let range: Range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    const pre = document.createElement('pre');
    pre.style.backgroundColor = '#f3f4f6';
    pre.style.padding = '12px';
    pre.style.borderRadius = '6px';
    pre.style.fontFamily = 'monospace';
    pre.style.fontSize = '13px';
    pre.style.overflowX = 'auto';
    pre.style.margin = '8px 0';
    const code = document.createElement('code');
    code.innerHTML = '<br>';
    pre.appendChild(code);
    range.insertNode(pre);
    const newRange = document.createRange();
    newRange.selectNodeContents(code);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Emoji
  const insertEmoji = useCallback((emoji: string) => {
    insertText(emoji);
    setShowEmojiPicker(false);
    setInsertMenuOpen(false);
  }, [insertText]);

  // Insert Mention
  const insertMention = useCallback((user: { id: string; name: string }) => {
    restoreSelection();
    const mentionHTML = `<span contenteditable="false" data-user-id="${user.id}" style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 4px; border-radius: 4px; font-weight: 500;">@${user.name}</span>&nbsp;`;
    document.execCommand('insertHTML', false, mentionHTML);
    handleContentChange();
    setShowMentionPicker(false);
    setMentionSearch('');
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  // Insert Table
  const insertTable = useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;

    let range: Range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.margin = '12px 0';

    for (let i = 0; i < rows; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < cols; j++) {
        const td = document.createElement('td');
        td.style.border = '1px solid #d1d5db';
        td.style.padding = '8px 12px';
        td.style.minWidth = '80px';
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    range.insertNode(table);

    // Move cursor into first cell
    const firstCell = table.querySelector('td');
    if (firstCell) {
      const newRange = document.createRange();
      newRange.selectNodeContents(firstCell);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    handleContentChange();
    setShowTablePicker(false);
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Section Break (horizontal line)
  const insertSectionBreak = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection) return;

    let range: Range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }

    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #e5e7eb';
    hr.style.margin = '16px 0';

    // Add a paragraph after the hr for cursor placement
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    const fragment = document.createDocumentFragment();
    fragment.appendChild(hr);
    fragment.appendChild(p);

    range.insertNode(fragment);

    // Move cursor to the paragraph after hr
    const newRange = document.createRange();
    newRange.selectNodeContents(p);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // Insert Image from URL
  const insertImageFromUrl = useCallback((url: string) => {
    if (!editorRef.current || !url.trim()) return;
    editorRef.current.focus();
    restoreSelection();

    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '8px';
    img.style.margin = '8px 0';
    img.alt = 'Inserted image';

    document.execCommand('insertHTML', false, img.outerHTML + '<p><br></p>');
    handleContentChange();
    setShowImagePicker(false);
    setImageUrl('');
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  // Insert Image from file
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        editorRef.current?.focus();
        restoreSelection();

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        img.alt = file.name;

        document.execCommand('insertHTML', false, img.outerHTML + '<p><br></p>');
        handleContentChange();
        setShowImagePicker(false);
        setInsertMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [restoreSelection, handleContentChange]);

  // Insert Embed Link (iframe for videos, etc)
  const insertEmbedLinkContent = useCallback((url: string) => {
    if (!editorRef.current || !url.trim()) return;
    editorRef.current.focus();
    restoreSelection();

    // Check if it's a YouTube URL and convert to embed
    let embedHtml = '';
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);

    if (youtubeMatch) {
      embedHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 12px 0; border-radius: 8px;">
        <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>
      </div>`;
    } else if (vimeoMatch) {
      embedHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 12px 0; border-radius: 8px;">
        <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>
      </div>`;
    } else if (loomMatch) {
      embedHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 12px 0; border-radius: 8px;">
        <iframe src="https://www.loom.com/embed/${loomMatch[1]}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;" allowfullscreen></iframe>
      </div>`;
    } else {
      // Generic link card
      embedHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 8px 0; text-decoration: none; color: inherit;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span style="color: #3b82f6; font-size: 14px;">${url}</span>
        </div>
      </a>`;
    }

    document.execCommand('insertHTML', false, embedHtml + '<p><br></p>');
    handleContentChange();
    setShowEmbedLink(false);
    setEmbedUrl('');
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  // Insert menu items
  const insertMenuItems = [
    { icon: Pilcrow, label: 'Paragraph', action: insertParagraph },
    { type: 'separator' as const },
    { icon: List, label: 'Bulleted list', action: insertBulletedList },
    { icon: ListOrdered, label: 'Numbered list', action: insertNumberedList },
    { type: 'separator' as const },
    { icon: TextQuote, label: 'Quote', action: insertQuote },
    { icon: Code, label: 'Code block', action: insertCodeBlock },
    { icon: Table2, label: 'Table', action: () => { setShowTablePicker(true); setInsertMenuOpen(false); } },
    { icon: Minus, label: 'Section break', action: insertSectionBreak },
    { type: 'separator' as const },
    { icon: Smile, label: 'Emoji', action: () => { setShowEmojiPicker(true); setInsertMenuOpen(false); } },
    { icon: ImageIcon, label: 'Image', action: () => { setShowImagePicker(true); setInsertMenuOpen(false); } },
    { icon: AtSign, label: 'Mention', action: () => { setShowMentionPicker(true); setInsertMenuOpen(false); } },
    { icon: Link, label: 'Embed link', action: () => { setShowEmbedLink(true); setInsertMenuOpen(false); } },
  ];

  // Toolbar buttons
  const toolbarButtons = [
    { icon: Bold, command: 'bold', tooltip: 'Bold (Ctrl+B)' },
    { icon: Italic, command: 'italic', tooltip: 'Italic (Ctrl+I)' },
    { icon: Underline, command: 'underline', tooltip: 'Underline (Ctrl+U)' },
    { icon: Strikethrough, command: 'strikeThrough', tooltip: 'Strikethrough' },
    { type: 'separator' as const },
    { icon: List, tooltip: 'Bullet list', action: 'bulletList' },
    { icon: ListOrdered, tooltip: 'Numbered list', action: 'numberedList' },
    { icon: TextQuote, tooltip: 'Quote', action: 'quote' },
    { type: 'separator' as const },
    { icon: Link2, tooltip: 'Insert link', action: 'link' },
    { icon: Code, tooltip: 'Inline code', action: 'inlineCode' },
    { icon: FileCode, tooltip: 'Code block', action: 'code' },
    { type: 'separator' as const },
    { icon: Sparkles, tooltip: 'AI assist (select text)', action: 'ai' },
  ];

  // AI Assist function
  const handleAIAssist = useCallback(async (option: typeof aiOptions[0]) => {
    if (!selectedText.trim()) return;
    setAiLoading(option.id);
    setAiResult('');
    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: option.prompt, text: selectedText }),
      });
      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      setAiResult(data.result);
    } catch (error) {
      console.error('AI assist error:', error);
      setAiResult('Error: Could not process your request. Please try again.');
    } finally {
      setAiLoading(null);
    }
  }, [selectedText]);

  // Apply AI result
  const applyAIResult = useCallback(() => {
    if (!aiResult || !editorRef.current) return;
    restoreSelection();
    document.execCommand('insertText', false, aiResult);
    handleContentChange();
    setShowAIAssist(false);
    setAiResult('');
    setSelectedText('');
  }, [aiResult, restoreSelection, handleContentChange]);

  // Open AI Assist modal
  const openAIAssist = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (!text.trim()) {
      setSelectedText(editorRef.current?.textContent || '');
    } else {
      setSelectedText(text);
      saveSelection();
    }
    setAiResult('');
    setShowAIAssist(true);
  }, [saveSelection]);

  // Handle toolbar click
  const handleToolbarClick = useCallback((button: typeof toolbarButtons[0]) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if ('action' in button) {
      if (button.action === 'bulletList') { insertBulletedList(); return; }
      if (button.action === 'numberedList') { insertNumberedList(); return; }
      if (button.action === 'quote') { insertQuote(); return; }
      if (button.action === 'link') {
        const url = prompt('Enter URL:');
        if (url) { document.execCommand('createLink', false, url); handleContentChange(); }
        return;
      }
      if (button.action === 'inlineCode') {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          const text = selection.toString();
          document.execCommand('insertHTML', false, `<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">${text}</code>`);
        } else {
          const code = document.createElement('code');
          code.style.backgroundColor = '#f3f4f6';
          code.style.padding = '2px 4px';
          code.style.borderRadius = '3px';
          code.style.fontFamily = 'monospace';
          code.style.fontSize = '0.9em';
          code.innerHTML = '\u200B';
          document.execCommand('insertHTML', false, code.outerHTML);
        }
        handleContentChange();
        return;
      }
      if (button.action === 'code') { insertCodeBlock(); return; }
      if (button.action === 'ai') { openAIAssist(); return; }
    }
    if ('command' in button && button.command) {
      document.execCommand(button.command, false);
      handleContentChange();
    }
  }, [handleContentChange, insertCodeBlock, insertBulletedList, insertNumberedList, insertQuote, openAIAssist]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;
    // ENTER in lists - exit list on empty item
    if (e.key === 'Enter' && !e.shiftKey) {
      const currentNode = selection.anchorNode;
      const listItem = currentNode?.parentElement?.closest('li') ||
        (currentNode?.nodeType === Node.ELEMENT_NODE && (currentNode as Element).closest('li'));
      if (listItem) {
        const li = listItem as HTMLLIElement;
        const textContent = li.textContent || '';
        if (!textContent.trim()) {
          e.preventDefault();
          const list = li.closest('ul, ol');
          if (list) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            if (list.children.length === 1) {
              list.replaceWith(p);
            } else {
              li.remove();
              list.after(p);
            }
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            handleContentChange();
          }
          return;
        }
      }
    }
    // TAB for indent in lists
    if (e.key === 'Tab') {
      const currentNode = selection.anchorNode;
      const listItem = currentNode?.parentElement?.closest('li');
      if (listItem) {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          document.execCommand('indent', false);
        }
        handleContentChange();
        return;
      }
    }
    // Format shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); document.execCommand('bold', false); handleContentChange(); break;
        case 'i': e.preventDefault(); document.execCommand('italic', false); handleContentChange(); break;
        case 'u': e.preventDefault(); document.execCommand('underline', false); handleContentChange(); break;
      }
    }
    // @ for mentions
    if (e.key === '@') {
      saveSelection();
      setShowMentionPicker(true);
    }
  }, [handleContentChange, saveSelection]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((prev) => {
        const oldIndex = prev.findIndex((f) => f.id === active.id);
        const newIndex = prev.findIndex((f) => f.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const addField = (type: string) => {
    const newField: FormField = {
      id: Date.now().toString(),
      type: type as FormField['type'],
      label: type === 'email' ? 'Email address' :
             type === 'heading' ? 'Heading' :
             type === 'attachment' ? 'Attachment' : 'New question',
      required: false,
      placeholder: '',
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f) =>
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === fieldId);
      if (direction === 'up' && index > 0) {
        const newFields = [...prev];
        [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
        return newFields;
      }
      if (direction === 'down' && index < prev.length - 1) {
        const newFields = [...prev];
        [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
        return newFields;
      }
      return prev;
    });
  };

  const duplicateField = (fieldId: string) => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === fieldId);
      if (index === -1) return prev;
      const fieldToDuplicate = prev[index];
      const duplicatedField: FormField = {
        ...fieldToDuplicate,
        id: Date.now().toString(),
        label: `${fieldToDuplicate.label} (copy)`,
      };
      const newFields = [...prev];
      newFields.splice(index + 1, 0, duplicatedField);
      return newFields;
    });
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard this form?')) {
      onClose();
    }
  };

  const handlePublish = () => {
    onPublish?.({
      name: formName,
      description: formDescription,
      visibility,
      fields,
      projectId,
    });
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1200px] sm:max-w-[1200px] h-[85vh] p-0 flex flex-col gap-0 [&>button]:hidden" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-xl font-semibold">Add form</DialogTitle>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              {visibility === 'anyone'
                ? 'Anyone can access and submit the form.'
                : 'Only your organization can access.'}
            </span>
            <button
              onClick={() => setVisibility(visibility === 'anyone' ? 'organization' : 'anyone')}
              className="text-sm text-blue-600 hover:underline"
            >
              Change
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <Star className={cn(
                "h-4 w-4",
                isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
              )} />
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-600">
              <Eye className="h-4 w-4" />
              View form
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-600">
              <Share2 className="h-4 w-4" />
              Share form
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded text-sm text-gray-600">
              <Link2 className="h-4 w-4" />
              Copy link
            </button>

            <button className="p-2 hover:bg-gray-100 rounded transition-colors">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel - Form preview */}
          <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
            <div className="max-w-2xl mx-auto">
              {/* Cover image area */}
              <div className="bg-gray-200 rounded-t-xl h-28 flex items-center justify-center">
                <Button variant="outline" size="sm" className="bg-white shadow-sm">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Add cover image
                </Button>
              </div>

              {/* Form header */}
              <div className="bg-white px-6 py-5 border-x border-gray-200">
                {/* Form title */}
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-2xl font-bold border-none outline-none bg-transparent placeholder:text-gray-300"
                  placeholder="Form title"
                />

                {/* Description with Rich Text Editor */}
                <div className="mt-4 border rounded-lg overflow-hidden">
                  {/* Editor area */}
                  <div
                    ref={editorRef}
                    contentEditable
                    className={cn(
                      "min-h-[80px] px-3 py-3 outline-none text-sm",
                      "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
                      "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
                      "[&_li]:my-1",
                      "empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
                    )}
                    data-placeholder="Type / for menu"
                    onInput={handleContentChange}
                    onFocus={saveSelection}
                    onKeyDown={handleKeyDown}
                    onMouseUp={saveSelection}
                    suppressContentEditableWarning
                  />

                  {/* Toolbar */}
                  <TooltipProvider>
                    <div className="flex items-center gap-0.5 px-2 py-2 border-t bg-gray-50">
                      {/* INSERT MENU (+) */}
                      <DropdownMenu open={insertMenuOpen} onOpenChange={setInsertMenuOpen}>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1.5 hover:bg-gray-200 rounded"
                            onMouseDown={saveSelection}
                          >
                            <Plus className="h-4 w-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
                            Insert
                          </DropdownMenuLabel>
                          {insertMenuItems.map((item, index) => {
                            if ('type' in item && item.type === 'separator') {
                              return <DropdownMenuSeparator key={index} />;
                            }
                            const Icon = item.icon!;
                            return (
                              <DropdownMenuItem
                                key={index}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => item.action?.(), 0);
                                }}
                                className="cursor-pointer"
                              >
                                <Icon className="h-4 w-4 mr-2 text-gray-500" />
                                {item.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="w-px h-5 bg-gray-300 mx-1" />

                      {/* Format buttons */}
                      {toolbarButtons.map((button, index) => {
                        if ('type' in button && button.type === 'separator') {
                          return <div key={index} className="w-px h-5 bg-gray-300 mx-1" />;
                        }
                        const Icon = button.icon!;
                        return (
                          <Tooltip key={index}>
                            <TooltipTrigger asChild>
                              <button
                                onMouseDown={saveSelection}
                                onClick={() => setTimeout(() => handleToolbarClick(button), 0)}
                                className="p-1.5 hover:bg-gray-200 rounded"
                              >
                                <Icon className="h-4 w-4 text-gray-500" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{'tooltip' in button ? button.tooltip : ''}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </div>
              </div>

              {/* Form fields */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="bg-white px-6 py-4 border-x border-gray-200">
                    {fields.map((field, index) => (
                      <SortableFormField
                        key={field.id}
                        field={field}
                        isFirst={index === 0}
                        isLast={index === fields.length - 1}
                        onUpdate={(updates) => updateField(field.id, updates)}
                        onRemove={() => removeField(field.id)}
                        onMoveUp={() => moveField(field.id, 'up')}
                        onMoveDown={() => moveField(field.id, 'down')}
                        onDuplicate={() => duplicateField(field.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Drop zone */}
              <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-b-xl p-8 text-center">
                <p className="text-blue-500 text-sm">Drag another question here</p>
              </div>
            </div>
          </div>

          {/* Right panel - Questions/Settings */}
          <div className="w-72 border-l bg-white flex flex-col shrink-0">
            {/* Tabs */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => setActiveTab('questions')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === 'questions'
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Questions
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === 'settings'
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Settings
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'questions' ? (
                <div className="space-y-2">
                  {/* Fields from project */}
                  <button className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <AlignLeft className="h-5 w-5 text-gray-400" />
                      <span className="text-sm">Fields</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-sm">0</span>
                      <span>›</span>
                    </div>
                  </button>

                  {/* Email address */}
                  <button
                    onClick={() => addField('email')}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Mail className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">Email address</span>
                  </button>

                  {/* Attachment */}
                  <button
                    onClick={() => addField('attachment')}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Paperclip className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">Attachment</span>
                  </button>

                  {/* Heading */}
                  <button
                    onClick={() => addField('heading')}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Heading1 className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">Heading</span>
                  </button>

                  {/* New question */}
                  <button
                    onClick={() => addField('text')}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">New question</span>
                  </button>
                </div>
              ) : (
                <FormSettingsTab
                  formId={projectId}
                  settings={formSettings}
                  onSettingsChange={setFormSettings}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-white shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleDiscard}
              className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
            >
              Discard form
            </Button>
            <button className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
              Send feedback
            </button>
          </div>

          <Button
            onClick={handlePublish}
            className="bg-blue-600 hover:bg-blue-700 px-6"
          >
            Publish
          </Button>
        </div>

        {/* EMOJI PICKER POPOVER */}
        {showEmojiPicker && (
          <div className="fixed inset-0 z-[100]" onClick={() => setShowEmojiPicker(false)}>
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-3 w-72"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Emojis</span>
                <button onClick={() => setShowEmojiPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {emojiCategories.map((category) => (
                  <div key={category.name}>
                    <p className="text-xs text-gray-500 mb-1">{category.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {category.emojis.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => insertEmoji(emoji)}
                          className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MENTION PICKER POPOVER */}
        {showMentionPicker && (
          <div className="fixed inset-0 z-[100]" onClick={() => setShowMentionPicker(false)}>
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-3 w-64"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Mention someone</span>
                <button onClick={() => setShowMentionPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <Input
                value={mentionSearch}
                onChange={(e) => setMentionSearch(e.target.value)}
                placeholder="Search people..."
                className="mb-2"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No users found
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-medium">
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI ASSIST MODAL */}
        {showAIAssist && (
          <>
            {/* Invisible overlay to close on click outside */}
            <div
              className="fixed inset-0"
              style={{ zIndex: 9999 }}
              onClick={() => setShowAIAssist(false)}
            />
            {/* Modal */}
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border w-full max-w-lg mx-4"
              style={{ zIndex: 10000 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" style={{ color: '#D97757' }} />
                  <h3 className="font-semibold">AI Assist</h3>
                </div>
                <button
                  onClick={() => setShowAIAssist(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Selected text preview */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Selected text:</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-24 overflow-y-auto">
                    {selectedText || 'No text selected'}
                  </div>
                </div>

                {/* AI Options */}
                {!aiResult && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">What would you like to do?</p>
                    {aiOptions.map((option) => {
                      const Icon = option.icon;
                      const isLoading = aiLoading === option.id;
                      if (aiLoading && aiLoading !== option.id) return null;
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleAIAssist(option)}
                          disabled={!!aiLoading || !selectedText.trim()}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                        >
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#D97757' }} />
                          ) : (
                            <Icon className="h-5 w-5" style={{ color: '#D97757' }} />
                          )}
                          <span className="font-medium text-sm">{option.label}</span>
                          {isLoading && (
                            <span className="ml-auto text-xs text-gray-400">Processing...</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* AI Result */}
                {aiResult && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Result:</p>
                    <div className="rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto" style={{ backgroundColor: '#FDF4F1', border: '1px solid #F5D9D0' }}>
                      {aiResult}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={applyAIResult}
                        className="flex-1 text-white py-2 px-4 rounded-lg transition-colors font-medium text-sm"
                        style={{ backgroundColor: '#D97757' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C4674A'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#D97757'}
                      >
                        Replace text
                      </button>
                      <button
                        onClick={() => {
                          restoreSelection();
                          document.execCommand('insertText', false, '\n\n' + aiResult);
                          handleContentChange();
                          setShowAIAssist(false);
                          setAiResult('');
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                      >
                        Insert below
                      </button>
                    </div>
                    <button
                      onClick={() => setAiResult('')}
                      className="w-full text-gray-500 text-sm hover:text-gray-700"
                    >
                      Try another option
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TABLE PICKER */}
        {showTablePicker && (
          <div className="fixed inset-0 z-[100]" onClick={() => setShowTablePicker(false)}>
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-4 w-72"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Insert Table</span>
                <button onClick={() => setShowTablePicker(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-2">Select table size</p>

              {/* Table size grid */}
              <div className="grid grid-cols-6 gap-1 mb-3">
                {Array.from({ length: 36 }).map((_, i) => {
                  const row = Math.floor(i / 6);
                  const col = i % 6;
                  const isHovered = row < hoveredCell.row && col < hoveredCell.col;
                  return (
                    <button
                      key={i}
                      className={cn(
                        "w-6 h-6 border rounded transition-colors",
                        isHovered ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300 hover:border-blue-400"
                      )}
                      onMouseEnter={() => setHoveredCell({ row: row + 1, col: col + 1 })}
                      onClick={() => insertTable(row + 1, col + 1)}
                    />
                  );
                })}
              </div>

              <p className="text-xs text-gray-500 text-center">
                {hoveredCell.row > 0 && hoveredCell.col > 0
                  ? `${hoveredCell.row} × ${hoveredCell.col}`
                  : 'Hover to select size'}
              </p>

              {/* Quick size options */}
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <button
                  onClick={() => insertTable(2, 2)}
                  className="flex-1 text-xs py-1.5 border rounded hover:bg-gray-50"
                >
                  2×2
                </button>
                <button
                  onClick={() => insertTable(3, 3)}
                  className="flex-1 text-xs py-1.5 border rounded hover:bg-gray-50"
                >
                  3×3
                </button>
                <button
                  onClick={() => insertTable(4, 4)}
                  className="flex-1 text-xs py-1.5 border rounded hover:bg-gray-50"
                >
                  4×4
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGE PICKER */}
        {showImagePicker && (
          <div className="fixed inset-0 z-[100]" onClick={() => setShowImagePicker(false)}>
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-4 w-80"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Insert Image</span>
                <button onClick={() => setShowImagePicker(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Upload option */}
              <div className="mb-4">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Click to upload</span>
                  <span className="text-xs text-gray-400">or drag and drop</span>
                </label>
              </div>

              {/* URL option */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Or paste image URL</p>
                <div className="flex gap-2">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        insertImageFromUrl(imageUrl);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => insertImageFromUrl(imageUrl)}
                    disabled={!imageUrl.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EMBED LINK MODAL */}
        {showEmbedLink && (
          <div className="fixed inset-0 z-[100]" onClick={() => setShowEmbedLink(false)}>
            <div
              className="absolute bg-white border rounded-lg shadow-lg p-4 w-96"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Embed Link</span>
                <button onClick={() => setShowEmbedLink(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Paste a URL to embed. Supports YouTube, Vimeo, Loom, and other links.
              </p>

              <div className="space-y-3">
                <Input
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or any URL"
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      insertEmbedLinkContent(embedUrl);
                    }
                  }}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowEmbedLink(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => insertEmbedLinkContent(embedUrl)}
                    disabled={!embedUrl.trim()}
                  >
                    Embed
                  </Button>
                </div>

                {/* Supported platforms */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400 mb-2">Supported platforms:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">YouTube</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Vimeo</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Loom</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">Any URL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
