'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
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
  X,
  Undo2,
  Redo2,
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
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'buildsync-private-notepad';
const NOTEPAD_TITLE = '__home_private_notepad__';

// Emoji picker data
const emojiCategories = [
  {
    name: 'Frequent',
    emojis: ['😀', '😂', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '✅', '⭐']
  },
  {
    name: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘']
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋', '🙌', '👏', '🤝', '💪']
  },
  {
    name: 'Objects',
    emojis: ['💼', '📁', '📋', '📌', '📎', '✏️', '📝', '💡', '🔔', '⏰', '📅', '✅']
  },
];

// Size / Remove handled by WidgetContainer — no props needed.
export function PrivateNotepadWidget() {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mentionsError, setMentionsError] = useState<string | null>(null);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  // AI Assist options
  const aiOptions = [
    { id: 'improve', icon: Wand2, label: 'Improve writing', prompt: 'Improve the following text, making it clearer and more professional:' },
    { id: 'summarize', icon: Minimize2, label: 'Summarize', prompt: 'Summarize the following text concisely:' },
    { id: 'expand', icon: Maximize2, label: 'Expand & detail', prompt: 'Expand and add more detail to the following text:' },
    { id: 'fix', icon: CheckCircle, label: 'Fix grammar', prompt: 'Fix any grammar and spelling errors in the following text:' },
  ];

  // Real users for mentions — lazy-loaded the first time the picker opens,
  // since most sessions never mention anyone
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const usersLoadedRef = useRef(false);

  const loadUsers = useCallback(async () => {
    if (usersLoadedRef.current) return;
    usersLoadedRef.current = true;
    setMentionsLoading(true);
    try {
      const res = await fetch('/api/users?limit=20');
      if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
      const data = await res.json();
      setUsers(data.map((u: { id: string; name?: string; email?: string }) => ({
        id: u.id,
        name: u.name || '',
        email: u.email || '',
      })));
      setMentionsError(null);
    } catch (error) {
      console.error('Failed to fetch users for mentions:', error);
      usersLoadedRef.current = false; // allow retry
      setMentionsError("Couldn't load teammates for mentions");
    } finally {
      setMentionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showMentionPicker) loadUsers();
  }, [showMentionPicker, loadUsers]);

  // Track the server-side note ID (for the dedicated home notepad note)
  const noteIdRef = useRef<string | null>(null);
  // Last content confirmed loaded/saved — dirty check so plain loads never PUT
  const lastSavedContentRef = useRef('');
  // In-flight first-save POST, shared so blur + debounce can't create duplicates
  const createInFlightRef = useRef<Promise<void> | null>(null);
  const initialSyncDoneRef = useRef(false);

  // Load saved content from API (with localStorage fallback for offline / unauthenticated)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let apiFailed = false;
      try {
        // Slim opt-in filter: only the notepad note as id+content, not every
        // accessible note with author/collaborator objects
        const res = await fetch(`/api/workspace/notes?title=${encodeURIComponent(NOTEPAD_TITLE)}`);
        if (!res.ok) apiFailed = true;
        if (res.ok && !cancelled) {
          const notes: { id: string; title: string; content: string; updatedAt?: string }[] = await res.json();
          const notepad = notes.find((n) => n.title === NOTEPAD_TITLE);
          if (notepad) {
            noteIdRef.current = notepad.id;
            const serverContent = notepad.content || '';
            lastSavedContentRef.current = serverContent;

            // A per-keystroke localStorage copy may hold unsaved edits made
            // right before a refresh (inside the 2s debounce). Prefer it when
            // it's newer than the server note so those keystrokes survive.
            let content = serverContent;
            const cached = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
            if (cached) {
              try {
                const data = JSON.parse(cached);
                const cachedContent: string = data.content ?? '';
                const cachedAt = data.savedAt ? Date.parse(data.savedAt) : NaN;
                const serverAt = notepad.updatedAt ? Date.parse(notepad.updatedAt) : NaN;
                if (
                  cachedContent &&
                  cachedContent !== serverContent &&
                  !Number.isNaN(cachedAt) &&
                  (Number.isNaN(serverAt) || cachedAt > serverAt)
                ) {
                  content = cachedContent;
                }
              } catch {
                // malformed cache — ignore, keep server content
              }
            }
            setContent(content);
            setIsLoaded(true);
            return;
          }
        }
      } catch {
        // network error — use local fallback
        apiFailed = true;
      }

      if (cancelled) return;

      // Fall back to localStorage if API failed or no note exists yet
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const savedContent = data.content || '';
          lastSavedContentRef.current = savedContent;
          setContent(savedContent);
        } catch {
          lastSavedContentRef.current = saved;
          setContent(saved);
        }
      }
      if (apiFailed) {
        setLoadError(
          saved
            ? "Couldn't load your note from the server — showing the local copy"
            : "Couldn't load your note from the server"
        );
      }
      setIsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // The skeleton early-return keeps the editor unmounted while loading, so
  // push the loaded note into it once it exists (one-shot).
  useEffect(() => {
    if (!isLoaded || initialSyncDoneRef.current || !editorRef.current) return;
    initialSyncDoneRef.current = true;
    if (content) {
      editorRef.current.innerHTML = DOMPurify.sanitize(content);
    }
  }, [isLoaded, content]);

  // Save to API (and localStorage as offline fallback)
  const saveNote = useCallback(async () => {
    if (content === lastSavedContentRef.current) return;

    // Always cache locally so the note isn't lost if the API call fails
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content, savedAt: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
    }

    try {
      // A first-save POST may still be in flight (blur + debounce overlap):
      // wait for it instead of creating a duplicate note
      if (!noteIdRef.current && createInFlightRef.current) {
        await createInFlightRef.current;
        if (content === lastSavedContentRef.current) return;
      }

      if (noteIdRef.current) {
        // Update existing
        setSaveStatus('saving');
        const res = await fetch('/api/workspace/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: noteIdRef.current,
            content,
          }),
        });
        if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      } else {
        // Create new (first save) — only if there's actual content
        if (!content.trim()) return;
        setSaveStatus('saving');
        const createPromise = (async () => {
          const res = await fetch('/api/workspace/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: NOTEPAD_TITLE,
              content,
              visibility: 'PRIVATE',
            }),
          });
          if (!res.ok) throw new Error(`Save failed: ${res.status}`);
          const created = await res.json();
          noteIdRef.current = created.id;
        })();
        createInFlightRef.current = createPromise;
        try {
          await createPromise;
        } finally {
          createInFlightRef.current = null;
        }
      }
      lastSavedContentRef.current = content;
      setSaveStatus('saved');
      setLoadError(null); // server reachable again — the stale-load warning no longer applies
    } catch {
      // network/API error — the localStorage copy above is the fallback
      setSaveStatus('error');
    }
  }, [content]);

  // Auto-save (only when content actually changed since load / last save)
  useEffect(() => {
    if (!isLoaded) return;
    if (content === lastSavedContentRef.current) return;
    const timer = setTimeout(saveNote, 2000);
    return () => clearTimeout(timer);
  }, [content, saveNote, isLoaded]);

  // Flush in-flight edits to the server on navigation/refresh, so keystrokes
  // still inside the 2s debounce aren't lost. keepalive lets the request
  // outlive the page. Only fires for an existing note (needs a noteId; the
  // localStorage copy covers a never-saved note).
  const contentRef = useRef(content);
  contentRef.current = content;
  useEffect(() => {
    const flush = () => {
      const current = contentRef.current;
      if (!noteIdRef.current) return;
      if (current === lastSavedContentRef.current) return;
      try {
        fetch('/api/workspace/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: noteIdRef.current, content: current }),
          keepalive: true,
        });
        lastSavedContentRef.current = current;
      } catch {
        // best-effort — the localStorage copy is the fallback
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Escape dismisses whichever overlay is open (these are hand-rolled
  // popovers/modals, not Radix, so they get no dismissal for free)
  useEffect(() => {
    if (!showEmojiPicker && !showMentionPicker && !showAIAssist && !showLinkPicker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setShowEmojiPicker(false);
      setShowMentionPicker(false);
      setShowAIAssist(false);
      setShowLinkPicker(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showEmojiPicker, showMentionPicker, showAIAssist, showLinkPicker]);

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
      // Synchronous cache — a refresh inside the 2s debounce must not lose keystrokes
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content: newContent, savedAt: new Date().toISOString() })
        );
      } catch {
        // ignore
      }
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
    // Remove the trigger '@' immediately before the caret (typed to open the
    // picker) so the inserted mention doesn't leave a stray '@' behind.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (
        range.collapsed &&
        range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startOffset > 0 &&
        range.startContainer.textContent?.[range.startOffset - 1] === '@'
      ) {
        range.setStart(range.startContainer, range.startOffset - 1);
        range.deleteContents();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.setAttribute('data-user-id', user.id);
    span.style.cssText = 'background-color: #dbeafe; color: #1d4ed8; padding: 2px 4px; border-radius: 4px; font-weight: 500;';
    span.textContent = `@${user.name}`;
    const mentionHTML = span.outerHTML + '&nbsp;';
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

  // Toolbar buttons — matches Asana's order: Undo / Redo first
  // (mirrors "Deshacer / Rehacer" in the Asana toolbar), then the
  // format block, then lists / quote, then link / code, then AI.
  const toolbarButtons = [
    { icon: Undo2, command: 'undo', tooltip: 'Undo (Ctrl+Z)' },
    { icon: Redo2, command: 'redo', tooltip: 'Redo (Ctrl+Shift+Z)' },
    { type: 'separator' as const },
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
        body: JSON.stringify({
          prompt: option.prompt,
          text: selectedText,
        }),
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

  // Apply AI result to editor
  const applyAIResult = useCallback(() => {
    if (!aiResult || !editorRef.current) return;

    restoreSelection();
    document.execCommand('insertText', false, aiResult);
    handleContentChange();
    setShowAIAssist(false);
    setAiResult('');
    setSelectedText('');
  }, [aiResult, restoreSelection, handleContentChange]);

  // Open AI assist modal
  const openAIAssist = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';

    if (!text.trim()) {
      // If no selection, use all content — and select it so 'Replace text'
      // actually replaces instead of inserting at a stale caret
      setSelectedText(editorRef.current?.textContent || '');
      if (editorRef.current) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        savedSelectionRef.current = range;
      }
    } else {
      setSelectedText(text);
      saveSelection();
    }
    setAiResult('');
    setShowAIAssist(true);
  }, [saveSelection]);

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
    if (button.action === 'quote') {
      insertQuote();
      return;
    }
    if (button.action === 'link') {
      // Inline popover instead of the blocking native prompt()
      setLinkUrl('');
      setShowLinkPicker(true);
      return;
    }
    if (button.action === 'inlineCode') {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        // Wrap selection in <code> tags (escape it — insertHTML parses markup)
        const text = selection.toString()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        document.execCommand('insertHTML', false, `<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">${text}</code>`);
      } else {
        // Create empty code element and place cursor inside
        const code = document.createElement('code');
        code.style.backgroundColor = '#f3f4f6';
        code.style.padding = '2px 4px';
        code.style.borderRadius = '3px';
        code.style.fontFamily = 'monospace';
        code.style.fontSize = '0.9em';
        code.innerHTML = '\u200B'; // Zero-width space to keep cursor visible

        document.execCommand('insertHTML', false, code.outerHTML);

        // Move cursor inside the code element
        setTimeout(() => {
          const codeElements = editorRef.current?.querySelectorAll('code');
          if (codeElements && codeElements.length > 0) {
            const lastCode = codeElements[codeElements.length - 1];
            const range = document.createRange();
            range.selectNodeContents(lastCode);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }, 0);
      }
      handleContentChange();
      return;
    }
    if (button.action === 'code') {
      insertCodeBlock();
      return;
    }
    if (button.action === 'ai') {
      openAIAssist();
      return;
    }
    if (button.command) {
      document.execCommand(button.command, false);
      handleContentChange();
    }
  }, [handleContentChange, insertCodeBlock, insertBulletedList, insertNumberedList, insertQuote, openAIAssist]);

  // Apply the link from the inline popover to the saved selection
  const applyLink = useCallback(() => {
    const raw = linkUrl.trim();
    setShowLinkPicker(false);
    setLinkUrl('');
    if (!raw) return;
    const href = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
    restoreSelection();
    document.execCommand('createLink', false, href);
    handleContentChange();
  }, [linkUrl, restoreSelection, handleContentChange]);

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

    // @ for mentions — let the literal '@' insert (so emails like user@x.com
    // still work), then open the picker. Picking a mention deletes the '@'
    // trigger; dismissing the picker leaves the '@' in place.
    if (e.key === '@') {
      // Open the picker on the next tick so the '@' is already inserted and
      // the selection sits right after it (insertMention removes it).
      setTimeout(() => {
        saveSelection();
        setShowMentionPicker(true);
      }, 0);
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
      {/* Title + lock icon + ⋯ menu are provided by WidgetContainer
          above. AVAILABLE_WIDGETS already pairs this widget with
          titleIcon='lock' so the lock badge renders next to the
          container's "Private notepad" title. */}
      {loadError && <p className="text-sm text-amber-600 mb-2">{loadError}</p>}

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
        <div className="flex flex-wrap items-center gap-0.5 pt-2 border-t border-gray-200">
          {/* INSERT MENU (+) */}
          <DropdownMenu open={insertMenuOpen} onOpenChange={setInsertMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Insert"
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
                      // Defer action to avoid blocking UI (INP optimization)
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
                    aria-label={button.tooltip}
                    onMouseDown={saveSelection}
                    onClick={() => {
                      // Defer action to avoid blocking UI (INP optimization)
                      setTimeout(() => handleToolbarClick(button), 0);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <Icon className="h-4 w-4 text-gray-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{button.tooltip}</TooltipContent>
              </Tooltip>
            );
          })}

          {saveStatus && (
            <span
              className={cn(
                'ml-auto pl-2 text-xs whitespace-nowrap',
                saveStatus === 'error' ? 'text-red-600' : 'text-gray-400'
              )}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Couldn’t save'}
            </span>
          )}
        </div>
      </TooltipProvider>

      {/* EMOJI PICKER POPOVER */}
      {showEmojiPicker && (
        <div className="fixed inset-0 z-50" onClick={() => setShowEmojiPicker(false)}>
          <div
            role="dialog"
            aria-label="Emoji picker"
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
                        aria-label={`Insert ${emoji}`}
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
            role="dialog"
            aria-label="Mention a teammate"
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
              {mentionsLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : mentionsError ? (
                <div className="text-center py-2">
                  <p className="text-xs text-amber-600 mb-1">{mentionsError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMentionsError(null);
                      loadUsers();
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredUsers.length === 0 ? (
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

      {/* LINK POPOVER */}
      {showLinkPicker && (
        <div className="fixed inset-0 z-50" onClick={() => setShowLinkPicker(false)}>
          <div
            role="dialog"
            aria-label="Insert link"
            className="absolute bg-white border rounded-lg shadow-lg p-3 w-72"
            style={{ bottom: '80px', left: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyLink();
              }}
            >
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Paste or type a link..."
                className="mb-2"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkPicker(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!linkUrl.trim()}
                  className="px-3 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI ASSIST MODAL */}
      {showAIAssist && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowAIAssist(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="AI assist"
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-black" />
                <h3 className="font-semibold">AI Assist</h3>
              </div>
              <button
                aria-label="Close AI assist"
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

                    // If loading another option, hide this one
                    if (aiLoading && aiLoading !== option.id) return null;

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleAIAssist(option)}
                        disabled={!!aiLoading || !selectedText.trim()}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-black" />
                        ) : (
                          <Icon className="h-5 w-5 text-black" />
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
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-700 max-h-48 overflow-y-auto">
                    {aiResult}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={applyAIResult}
                      className="flex-1 bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
                    >
                      Replace text
                    </button>
                    <button
                      onClick={() => {
                        restoreSelection();
                        // Insert after the selection, don't replace it
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) sel.collapseToEnd();
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
        </div>
      )}
    </div>
  );
}
