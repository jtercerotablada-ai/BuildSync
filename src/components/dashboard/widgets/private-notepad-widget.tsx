'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MoreHorizontal,
  Check,
  Trash2,
  Lock,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  IndentDecrease,
  Link2,
  Code,
  ClipboardList,
  Sparkles,
  TextQuote,
  Smile,
  AtSign,
  Pilcrow,
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
import { WidgetSize } from '@/types/dashboard';

const STORAGE_KEY = 'buildsync-private-notepad';

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

interface PrivateNotepadWidgetProps {
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  onRemove?: () => void;
}

export function PrivateNotepadWidget({
  size = 'half',
  onSizeChange,
  onRemove
}: PrivateNotepadWidgetProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  // Mock users for mentions
  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com' },
  ];

  // Load saved content
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const savedContent = data.content || '';
        setContent(savedContent);
        if (editorRef.current) {
          editorRef.current.innerHTML = savedContent;
        }
      } catch {
        setContent(saved);
        if (editorRef.current) {
          editorRef.current.innerHTML = saved;
        }
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveNote = useCallback(() => {
    const data = {
      content: content,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [content]);

  // Auto-save
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(saveNote, 2000);
    return () => clearTimeout(timer);
  }, [content, saveNote, isLoaded]);

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
      setContent(newContent);
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

  // ==========================================
  // INSERT FUNCTIONS
  // ==========================================

  // 1. PARAGRAPH
  const insertParagraph = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertParagraph', false);
    handleContentChange();
    setInsertMenuOpen(false);
  }, [handleContentChange]);

  // 2. BULLETED LIST - uses native execCommand for proper Enter behavior
  const insertBulletedList = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection) return;

    // Check if already in a list
    const currentNode = selection.anchorNode;
    const listItem = currentNode?.parentElement?.closest('li');

    if (listItem) {
      // Already in a list, toggle off
      document.execCommand('insertUnorderedList', false);
    } else {
      // Create new list
      document.execCommand('insertUnorderedList', false);

      // Ensure cursor is inside the li
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

  // 3. NUMBERED LIST - uses native execCommand for proper Enter behavior
  const insertNumberedList = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const selection = window.getSelection();
    if (!selection) return;

    // Check if already in a list
    const currentNode = selection.anchorNode;
    const listItem = currentNode?.parentElement?.closest('li');

    if (listItem) {
      // Already in a list, toggle off
      document.execCommand('insertOrderedList', false);
    } else {
      // Create new list
      document.execCommand('insertOrderedList', false);

      // Ensure cursor is inside the li
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

  // 4. QUOTE
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

  // 5. CODE BLOCK
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

  // 6. EMOJI
  const insertEmoji = useCallback((emoji: string) => {
    insertText(emoji);
    setShowEmojiPicker(false);
    setInsertMenuOpen(false);
  }, [insertText]);

  // 7. MENTION
  const insertMention = useCallback((user: { id: string; name: string }) => {
    restoreSelection();
    const mentionHTML = `<span contenteditable="false" data-user-id="${user.id}" style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 4px; border-radius: 4px; font-weight: 500;">@${user.name}</span>&nbsp;`;
    document.execCommand('insertHTML', false, mentionHTML);
    handleContentChange();
    setShowMentionPicker(false);
    setMentionSearch('');
    setInsertMenuOpen(false);
  }, [restoreSelection, handleContentChange]);

  // Filter users
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Insert menu items
  const insertMenuItems = [
    { icon: Pilcrow, label: 'Paragraph', action: insertParagraph },
    { type: 'separator' as const },
    { icon: List, label: 'Bulleted list', action: insertBulletedList },
    { icon: ListOrdered, label: 'Numbered list', action: insertNumberedList },
    { type: 'separator' as const },
    { icon: TextQuote, label: 'Quote', action: insertQuote },
    { icon: Code, label: 'Code block', action: insertCodeBlock },
    { type: 'separator' as const },
    {
      icon: Smile,
      label: 'Emoji',
      action: () => {
        setShowEmojiPicker(true);
        setInsertMenuOpen(false);
      }
    },
    {
      icon: AtSign,
      label: 'Mention',
      action: () => {
        setShowMentionPicker(true);
        setInsertMenuOpen(false);
      }
    },
  ];

  // Toolbar buttons
  const toolbarButtons = [
    { icon: Bold, command: 'bold', tooltip: 'Bold (Ctrl+B)' },
    { icon: Italic, command: 'italic', tooltip: 'Italic (Ctrl+I)' },
    { icon: Underline, command: 'underline', tooltip: 'Underline (Ctrl+U)' },
    { icon: Strikethrough, command: 'strikeThrough', tooltip: 'Strikethrough' },
    { type: 'separator' as const },
    { icon: List, tooltip: 'Bullet list', action: 'bulletList' },
    { icon: IndentDecrease, command: 'outdent', tooltip: 'Decrease indent' },
    { icon: ListOrdered, tooltip: 'Numbered list', action: 'numberedList' },
    { type: 'separator' as const },
    { icon: Link2, tooltip: 'Insert link', action: 'link' },
    { type: 'separator' as const },
    { icon: Code, tooltip: 'Code block', action: 'code' },
    { icon: ClipboardList, tooltip: 'Insert template', action: 'template' },
    { icon: Sparkles, tooltip: 'AI assist', action: 'ai' },
  ];

  const handleToolbarClick = useCallback((button: any) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (button.action === 'bulletList') {
      insertBulletedList();
      return;
    }
    if (button.action === 'numberedList') {
      insertNumberedList();
      return;
    }
    if (button.action === 'link') {
      const url = prompt('Enter URL:');
      if (url) {
        document.execCommand('createLink', false, url);
        handleContentChange();
      }
      return;
    }
    if (button.action === 'code') {
      insertCodeBlock();
      return;
    }
    if (button.action === 'template') {
      // TODO: Open template modal
      return;
    }
    if (button.action === 'ai') {
      // TODO: Open AI assist
      return;
    }
    if (button.command) {
      document.execCommand(button.command, false);
      handleContentChange();
    }
  }, [handleContentChange, insertCodeBlock, insertBulletedList, insertNumberedList]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    // ENTER in lists - exit list on empty item
    if (e.key === 'Enter' && !e.shiftKey) {
      const currentNode = selection.anchorNode;
      const listItem = currentNode?.parentElement?.closest('li') ||
        (currentNode?.nodeType === Node.ELEMENT_NODE &&
          (currentNode as Element).closest('li'));

      if (listItem) {
        const li = listItem as HTMLLIElement;
        const textContent = li.textContent || '';

        // If li is empty, exit the list
        if (!textContent.trim()) {
          e.preventDefault();

          // Find parent list
          const list = li.closest('ul, ol');

          if (list) {
            // Create new paragraph after the list
            const p = document.createElement('p');
            p.innerHTML = '<br>';

            // If it's the only item, replace the entire list
            if (list.children.length === 1) {
              list.replaceWith(p);
            } else {
              // Remove the empty li
              li.remove();
              // Insert paragraph after the list
              list.after(p);
            }

            // Move cursor to the new paragraph
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

            handleContentChange();
          }
          return;
        }
        // If there's content, let browser handle Enter (creates new li)
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
        case 'b':
          e.preventDefault();
          document.execCommand('bold', false);
          handleContentChange();
          break;
        case 'i':
          e.preventDefault();
          document.execCommand('italic', false);
          handleContentChange();
          break;
        case 'u':
          e.preventDefault();
          document.execCommand('underline', false);
          handleContentChange();
          break;
      }
    }

    // @ for mentions
    if (e.key === '@') {
      saveSelection();
      setShowMentionPicker(true);
    }
  }, [handleContentChange, saveSelection]);

  // Check if editor is empty
  const isEmpty = !content || content === '<br>' || content === '<div><br></div>';

  if (!isLoaded) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-32 bg-gray-100 animate-pulse rounded" />
        </div>
        <div className="flex-1 bg-gray-50 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Private notepad</h3>
          <Lock className="h-4 w-4 text-gray-400" />
        </div>

        {/* DROPDOWN 3 PUNTOS */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => onSizeChange?.('half')}
              className="cursor-pointer"
            >
              {size === 'half' && <Check className="h-4 w-4 mr-2" />}
              {size !== 'half' && <span className="w-4 mr-2" />}
              Half size
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSizeChange?.('full')}
              className="cursor-pointer"
            >
              {size === 'full' && <Check className="h-4 w-4 mr-2" />}
              {size !== 'full' && <span className="w-4 mr-2" />}
              Full size
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto relative min-h-[120px] mb-2">
        {isEmpty && (
          <p className="text-gray-400 pointer-events-none absolute top-0 left-0 text-sm">
            Jot down a quick note or add a link to a resource.
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          className={cn(
            'min-h-[120px] outline-none text-gray-700 text-sm',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
            '[&_li]:my-1'
          )}
          onInput={handleContentChange}
          onFocus={saveSelection}
          onBlur={saveNote}
          onKeyDown={handleKeyDown}
          onMouseUp={saveSelection}
          suppressContentEditableWarning
        />
      </div>

      {/* TOOLBAR */}
      <TooltipProvider>
        <div className="flex items-center gap-0.5 pt-2 border-t border-gray-200">
          {/* INSERT MENU (+) */}
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
                      item.action?.();
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

          {/* Format buttons */}
          {toolbarButtons.map((button, index) => {
            if ('type' in button && button.type === 'separator') {
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

      {/* EMOJI PICKER POPOVER */}
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

      {/* MENTION PICKER POPOVER */}
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
    </div>
  );
}
