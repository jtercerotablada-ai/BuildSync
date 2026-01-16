'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  Link2,
  Code,
  ClipboardList,
  Sparkles,
  TextQuote,
  Smile,
  AtSign,
  Pilcrow,
  Heading1,
  Heading2,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Emoji categories
const emojiCategories = [
  {
    name: 'Frequent',
    emojis: ['😀', '😂', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '✅', '⭐'],
  },
  {
    name: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋', '🙌', '👏', '🤝', '💪'],
  },
  {
    name: 'Objects',
    emojis: ['💼', '📁', '📋', '📌', '📎', '✏️', '📝', '💡', '🔔', '⏰', '📅', '✅'],
  },
];

export interface RichTextEditorUser {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
}

export interface RichTextEditorProps {
  /** Initial HTML content */
  initialContent?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when editor loses focus */
  onBlur?: () => void;
  /** Minimum height of the editor */
  minHeight?: string;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Show/hide insert menu (+) */
  showInsertMenu?: boolean;
  /** Show/hide formatting toolbar */
  showToolbar?: boolean;
  /** Custom toolbar buttons to show */
  toolbarButtons?: ToolbarButtonType[];
  /** Custom insert menu items to show */
  insertMenuItems?: InsertMenuItemType[];
  /** Users available for @mentions */
  mentionUsers?: RichTextEditorUser[];
  /** Fetch users for mentions (for async loading) */
  onFetchMentionUsers?: (search: string) => Promise<RichTextEditorUser[]>;
  /** Show AI assist button */
  showAIAssist?: boolean;
  /** Callback for AI assist */
  onAIAssist?: () => void;
  /** Show template button */
  showTemplates?: boolean;
  /** Callback for template selection */
  onSelectTemplate?: () => void;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the editor area */
  editorClassName?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export type ToolbarButtonType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'separator'
  | 'bulletList'
  | 'numberedList'
  | 'indent'
  | 'outdent'
  | 'link'
  | 'code'
  | 'template'
  | 'ai'
  | 'heading1'
  | 'heading2';

export type InsertMenuItemType =
  | 'paragraph'
  | 'separator'
  | 'bulletList'
  | 'numberedList'
  | 'quote'
  | 'codeBlock'
  | 'emoji'
  | 'mention'
  | 'heading1'
  | 'heading2';

interface ToolbarButton {
  type?: 'separator';
  icon?: any;
  command?: string;
  value?: string;
  tooltip?: string;
  needsValue?: boolean;
  action?: string;
}

interface InsertMenuItem {
  type?: 'separator';
  icon?: any;
  label?: string;
  command?: string;
  value?: string;
  action?: string;
}

const defaultToolbarButtons: ToolbarButtonType[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'separator',
  'bulletList',
  'outdent',
  'numberedList',
  'separator',
  'link',
  'separator',
  'code',
];

const defaultInsertMenuItems: InsertMenuItemType[] = [
  'paragraph',
  'separator',
  'bulletList',
  'numberedList',
  'separator',
  'quote',
  'codeBlock',
  'separator',
  'emoji',
  'mention',
];

export function RichTextEditor({
  initialContent = '',
  placeholder = 'Start typing...',
  onChange,
  onBlur,
  minHeight = '100px',
  maxHeight = '400px',
  showInsertMenu = true,
  showToolbar = true,
  toolbarButtons = defaultToolbarButtons,
  insertMenuItems = defaultInsertMenuItems,
  mentionUsers = [],
  onFetchMentionUsers,
  showAIAssist = false,
  onAIAssist,
  showTemplates = false,
  onSelectTemplate,
  className,
  editorClassName,
  readOnly = false,
  autoFocus = false,
}: RichTextEditorProps) {
  const [isEmpty, setIsEmpty] = useState(!initialContent);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [asyncUsers, setAsyncUsers] = useState<RichTextEditorUser[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<string>(initialContent);
  const savedSelectionRef = useRef<Range | null>(null);

  // Users for mentions (either provided directly or fetched async)
  const users = onFetchMentionUsers ? asyncUsers : mentionUsers;

  // Load initial content
  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      contentRef.current = initialContent;
      setIsEmpty(!initialContent || initialContent === '<br>');
    }
  }, []);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  // Fetch users for mentions
  useEffect(() => {
    if (showMentionPicker && onFetchMentionUsers) {
      onFetchMentionUsers(mentionSearch).then(setAsyncUsers);
    }
  }, [showMentionPicker, mentionSearch, onFetchMentionUsers]);

  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      contentRef.current = newContent;
      setIsEmpty(!newContent || newContent === '<br>');
      onChange?.(newContent);
    }
  }, [onChange]);

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Save current selection
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  // Restore selection (or place cursor at end if no saved selection)
  const restoreSelection = useCallback(() => {
    editorRef.current?.focus();
    const selection = window.getSelection();

    if (selection && savedSelectionRef.current) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
        return;
      } catch {
        // Selection might be invalid, fall through to place at end
      }
    }

    // If no saved selection, place cursor at end
    if (selection && editorRef.current) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false); // collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // Execute formatting command
  const execCommand = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      document.execCommand(command, false, value);
      handleContentChange();
    },
    [restoreSelection, handleContentChange]
  );

  // Insert text at cursor
  const insertText = useCallback(
    (text: string) => {
      restoreSelection();
      document.execCommand('insertText', false, text);
      handleContentChange();
    },
    [restoreSelection, handleContentChange]
  );

  // Insert HTML at cursor
  const insertHTML = useCallback(
    (html: string) => {
      restoreSelection();
      document.execCommand('insertHTML', false, html);
      handleContentChange();
    },
    [restoreSelection, handleContentChange]
  );

  // Insert functions
  const insertParagraph = useCallback(() => {
    restoreSelection();
    document.execCommand('insertParagraph', false);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  // Insert list using Range API (modern approach, execCommand is deprecated)
  const insertListAtCursor = useCallback((listType: 'ul' | 'ol') => {
    editorRef.current?.focus();

    const selection = window.getSelection();
    if (!selection) return;

    // Get or create a range
    let range: Range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      // Create range at end of editor if no selection
      range = document.createRange();
      if (editorRef.current) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
    }

    // Get selected text (if any)
    const selectedText = range.toString().trim();

    // Create the list element
    const list = document.createElement(listType);
    list.style.paddingLeft = '24px';
    list.style.margin = '8px 0';
    if (listType === 'ul') {
      list.style.listStyleType = 'disc';
    } else {
      list.style.listStyleType = 'decimal';
    }

    // Create list item(s)
    if (selectedText) {
      // Split by newlines if multiple lines selected
      const lines = selectedText.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        lines.forEach(line => {
          const li = document.createElement('li');
          li.textContent = line.trim();
          list.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        list.appendChild(li);
      }
      // Delete the selected content
      range.deleteContents();
    } else {
      // Create empty list item
      const li = document.createElement('li');
      li.innerHTML = '<br>';
      list.appendChild(li);
    }

    // Insert the list at cursor position
    range.insertNode(list);

    // Move cursor inside the first list item
    const firstLi = list.querySelector('li');
    if (firstLi) {
      const newRange = document.createRange();
      newRange.selectNodeContents(firstLi);
      newRange.collapse(true); // collapse to start
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  const insertBulletedList = useCallback(() => {
    insertListAtCursor('ul');
  }, [insertListAtCursor]);

  const insertNumberedList = useCallback(() => {
    insertListAtCursor('ol');
  }, [insertListAtCursor]);

  const insertQuote = useCallback(() => {
    restoreSelection();
    const quoteHTML = `<blockquote style="border-left: 3px solid #d1d5db; padding-left: 12px; margin: 8px 0; color: #6b7280; font-style: italic;">&nbsp;</blockquote>`;
    document.execCommand('insertHTML', false, quoteHTML);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  const insertCodeBlock = useCallback(() => {
    restoreSelection();
    const codeHTML = `<pre style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; overflow-x: auto; margin: 8px 0;"><code>&nbsp;</code></pre>`;
    document.execCommand('insertHTML', false, codeHTML);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  const insertHeading = useCallback(
    (level: 1 | 2) => {
      restoreSelection();
      document.execCommand('formatBlock', false, `h${level}`);
      handleContentChange();
      setInsertMenuOpen(false);
    },
    [restoreSelection, handleContentChange]
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      insertText(emoji);
      setShowEmojiPicker(false);
    },
    [insertText]
  );

  const insertMention = useCallback(
    (user: RichTextEditorUser) => {
      restoreSelection();
      const mentionHTML = `<span contenteditable="false" data-user-id="${user.id}" style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 4px; border-radius: 4px; font-weight: 500;">@${user.name}</span>&nbsp;`;
      document.execCommand('insertHTML', false, mentionHTML);
      handleContentChange();
      setShowMentionPicker(false);
      setMentionSearch('');
    },
    [restoreSelection, handleContentChange]
  );

  // Filter users for mentions
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(mentionSearch.toLowerCase()))
  );

  // Build toolbar buttons config
  const getToolbarConfig = useCallback((): ToolbarButton[] => {
    const config: ToolbarButton[] = [];

    toolbarButtons.forEach((buttonType) => {
      switch (buttonType) {
        case 'separator':
          config.push({ type: 'separator' });
          break;
        case 'bold':
          config.push({ icon: Bold, command: 'bold', tooltip: 'Bold (Ctrl+B)' });
          break;
        case 'italic':
          config.push({ icon: Italic, command: 'italic', tooltip: 'Italic (Ctrl+I)' });
          break;
        case 'underline':
          config.push({ icon: Underline, command: 'underline', tooltip: 'Underline (Ctrl+U)' });
          break;
        case 'strikethrough':
          config.push({ icon: Strikethrough, command: 'strikeThrough', tooltip: 'Strikethrough' });
          break;
        case 'bulletList':
          config.push({ icon: List, command: 'insertUnorderedList', tooltip: 'Bullet list' });
          break;
        case 'numberedList':
          config.push({ icon: ListOrdered, command: 'insertOrderedList', tooltip: 'Numbered list' });
          break;
        case 'indent':
          config.push({ icon: IndentIncrease, command: 'indent', tooltip: 'Increase indent' });
          break;
        case 'outdent':
          config.push({ icon: IndentDecrease, command: 'outdent', tooltip: 'Decrease indent' });
          break;
        case 'link':
          config.push({
            icon: Link2,
            command: 'createLink',
            tooltip: 'Insert link',
            needsValue: true,
          });
          break;
        case 'code':
          config.push({ icon: Code, tooltip: 'Code block', action: 'code' });
          break;
        case 'heading1':
          config.push({ icon: Heading1, tooltip: 'Heading 1', action: 'heading1' });
          break;
        case 'heading2':
          config.push({ icon: Heading2, tooltip: 'Heading 2', action: 'heading2' });
          break;
      }
    });

    // Add optional buttons
    if (showTemplates) {
      config.push({ icon: ClipboardList, tooltip: 'Insert template', action: 'template' });
    }
    if (showAIAssist) {
      config.push({ icon: Sparkles, tooltip: 'AI assist', action: 'ai' });
    }

    return config;
  }, [toolbarButtons, showTemplates, showAIAssist]);

  // Build insert menu config
  const getInsertMenuConfig = useCallback((): InsertMenuItem[] => {
    const config: InsertMenuItem[] = [];

    insertMenuItems.forEach((itemType) => {
      switch (itemType) {
        case 'separator':
          config.push({ type: 'separator' });
          break;
        case 'paragraph':
          config.push({ icon: Pilcrow, label: 'Paragraph', action: 'paragraph' });
          break;
        case 'bulletList':
          config.push({ icon: List, label: 'Bulleted list', action: 'bullet' });
          break;
        case 'numberedList':
          config.push({ icon: ListOrdered, label: 'Numbered list', action: 'number' });
          break;
        case 'quote':
          config.push({ icon: TextQuote, label: 'Quote', action: 'quote' });
          break;
        case 'codeBlock':
          config.push({ icon: Code, label: 'Code block', action: 'code' });
          break;
        case 'emoji':
          config.push({ icon: Smile, label: 'Emoji', action: 'emoji' });
          break;
        case 'mention':
          config.push({ icon: AtSign, label: 'Mention', action: 'mention' });
          break;
        case 'heading1':
          config.push({ icon: Heading1, label: 'Heading 1', action: 'heading1' });
          break;
        case 'heading2':
          config.push({ icon: Heading2, label: 'Heading 2', action: 'heading2' });
          break;
      }
    });

    return config;
  }, [insertMenuItems]);

  const handleInsertClick = useCallback(
    (item: InsertMenuItem) => {
      switch (item.action) {
        case 'paragraph':
          insertParagraph();
          break;
        case 'bullet':
          insertBulletedList();
          break;
        case 'number':
          insertNumberedList();
          break;
        case 'quote':
          insertQuote();
          break;
        case 'code':
          insertCodeBlock();
          break;
        case 'heading1':
          insertHeading(1);
          break;
        case 'heading2':
          insertHeading(2);
          break;
        case 'emoji':
          setInsertMenuOpen(false);
          setTimeout(() => setShowEmojiPicker(true), 100);
          break;
        case 'mention':
          setInsertMenuOpen(false);
          setTimeout(() => setShowMentionPicker(true), 100);
          break;
      }
    },
    [insertParagraph, insertBulletedList, insertNumberedList, insertQuote, insertCodeBlock, insertHeading]
  );

  const handleToolbarClick = useCallback(
    (button: ToolbarButton) => {
      if (button.action === 'code') {
        insertCodeBlock();
        return;
      }
      if (button.action === 'heading1') {
        insertHeading(1);
        return;
      }
      if (button.action === 'heading2') {
        insertHeading(2);
        return;
      }
      if (button.action === 'template') {
        onSelectTemplate?.();
        return;
      }
      if (button.action === 'ai') {
        onAIAssist?.();
        return;
      }
      // Handle lists with modern Range API instead of execCommand
      if (button.command === 'insertUnorderedList') {
        insertBulletedList();
        return;
      }
      if (button.command === 'insertOrderedList') {
        insertNumberedList();
        return;
      }
      if (button.needsValue) {
        const url = prompt('Enter URL:');
        if (url) execCommand(button.command!, url);
        return;
      }
      if (button.command) {
        execCommand(button.command);
      }
    },
    [execCommand, insertCodeBlock, insertHeading, insertBulletedList, insertNumberedList, onSelectTemplate, onAIAssist]
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        execCommand('bold');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        execCommand('italic');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        execCommand('underline');
      }
      // Detect @ key for mentions
      if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
        // Could trigger mention picker inline - for now just allow typing
      }
    },
    [execCommand]
  );

  const toolbarConfig = getToolbarConfig();
  const insertConfig = getInsertMenuConfig();

  if (readOnly) {
    return (
      <div
        className={cn('rich-text-editor-readonly', className)}
        dangerouslySetInnerHTML={{ __html: initialContent }}
      />
    );
  }

  return (
    <div className={cn('rich-text-editor flex flex-col', className)}>
      {/* ========== EDITOR AREA ========== */}
      <div
        className="relative flex-1 overflow-y-auto"
        style={{ minHeight, maxHeight }}
      >
        {isEmpty && (
          <div className="absolute top-0 left-0 text-gray-400 text-sm pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          className={cn(
            'outline-none text-gray-700 text-sm whitespace-pre-wrap break-words w-full h-full',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
            '[&_li]:my-1',
            editorClassName
          )}
          onInput={handleContentChange}
          onBlur={handleBlur}
          onFocus={saveSelection}
          onMouseUp={saveSelection}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* ========== TOOLBAR ========== */}
      {showToolbar && (
        <TooltipProvider>
          <div className="flex items-center gap-0.5 pt-2 border-t border-gray-200 mt-2">
            {/* ===== INSERT MENU (+) ===== */}
            {showInsertMenu && (
              <>
                <DropdownMenu open={insertMenuOpen} onOpenChange={setInsertMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 hover:bg-gray-100 rounded"
                      onMouseDown={saveSelection}
                    >
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
                      Insert
                    </DropdownMenuLabel>

                    {insertConfig.map((item, index) => {
                      if (item.type === 'separator') {
                        return <DropdownMenuSeparator key={index} />;
                      }
                      const Icon = item.icon!;
                      return (
                        <DropdownMenuItem
                          key={index}
                          onSelect={(e) => {
                            e.preventDefault();
                            handleInsertClick(item);
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

                <div className="w-px h-5 bg-gray-200 mx-1" />
              </>
            )}

            {/* Format buttons */}
            {toolbarConfig.map((button, index) => {
              if (button.type === 'separator') {
                return <div key={index} className="w-px h-5 bg-gray-200 mx-1" />;
              }

              const Icon = button.icon!;
              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <button
                      onMouseDown={saveSelection}
                      onClick={() => handleToolbarClick(button)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                    >
                      <Icon className="h-4 w-4 text-gray-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{button.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* ========== EMOJI PICKER ========== */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-50" onClick={() => setShowEmojiPicker(false)}>
          <div
            className="absolute bg-white border rounded-lg shadow-lg p-3 w-72"
            style={{ bottom: '80px', left: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* ========== MENTION PICKER ========== */}
      {showMentionPicker && (
        <div className="fixed inset-0 z-50" onClick={() => setShowMentionPicker(false)}>
          <div
            className="absolute bg-white border rounded-lg shadow-lg p-3 w-64"
            style={{ bottom: '80px', left: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              value={mentionSearch}
              onChange={(e) => setMentionSearch(e.target.value)}
              placeholder="Search people..."
              className="mb-2"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">No users found</p>
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
                      {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper to get plain text from HTML content
export function getPlainTextFromHTML(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Export helper to extract mentions from content
export function extractMentionsFromContent(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const mentions = div.querySelectorAll('[data-user-id]');
  return Array.from(mentions).map((el) => el.getAttribute('data-user-id') || '');
}
