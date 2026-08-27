'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Edit3,
  Sparkles,
  AtSign,
  ArrowUp,
  Loader2,
  Search,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultSuggestions = [
  { id: '1', icon: 'search', text: 'Find my recently overdue tasks' },
  { id: '2', icon: 'docs', text: 'How to get started' },
  { id: '3', icon: 'docs', text: 'Summarize my project progress' },
];

export function AIPanel({ isOpen, onClose }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversationTitle, setConversationTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Kept in a ref so the modal effect below can depend on isOpen alone — a new
  // onClose identity from the parent must not re-run it and steal focus mid-typing.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // This panel is a modal overlay drawn over a backdrop that swallows clicks, but it
  // was hand-rolled without any of the modal behaviour: Escape did nothing and Tab
  // walked focus out into the header and sidebar underneath, where nothing is clickable.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // While a request is in flight the input is disabled, which makes the
      // browser blur it and leave focus on <body> — outside the panel, where
      // neither of the wrap-around checks below match and Tab would walk into
      // the header behind the backdrop. Pull focus back in first.
      if (!active || !panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Once the answer lands the input is enabled again, but focus was dropped
  // when it went disabled — put the caret back so the next question can be
  // typed straight away.
  useEffect(() => {
    if (isOpen && !isLoading) inputRef.current?.focus();
  }, [isOpen, isLoading]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    // Set conversation title from first message
    if (messages.length === 0) {
      setConversationTitle(input.length > 40 ? input.slice(0, 40) + '...' : input);
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Answer the following question helpfully and concisely. You are TT AI Assistant, an assistant for project management.',
          text: input,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.result,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // The route explains itself (rate limit, missing API key, text too long);
        // collapsing all of that into "try again" told the user to repeat a call
        // that could never succeed.
        const data = await res.json().catch(() => null);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data?.error || 'Sorry, I couldn\'t process your request. Please try again.',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
  };

  const handleBack = () => {
    setMessages([]);
    setConversationTitle('');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'search':
        return <Search className="h-5 w-5 text-gray-500" />;
      case 'docs':
        return <FileText className="h-5 w-5 text-gray-500" />;
      default:
        return <Search className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="TT AI Assistant"
        className={cn(
          'fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-all duration-300',
          isExpanded ? 'w-full md:w-[600px]' : 'w-full md:w-[420px]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {messages.length > 0 ? (
              <>
                <button
                  onClick={handleBack}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-500" />
                </button>
                <h2 className="font-semibold text-gray-900 truncate max-w-[200px]">
                  {conversationTitle}
                </h2>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" style={{ color: '#D97757' }} />
                <h2 className="font-semibold text-gray-900">TT AI Assistant</h2>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button className="p-2 hover:bg-gray-100 rounded" onClick={() => { setMessages([]); setInput(''); }}>
                <Edit3 className="h-4 w-4 text-gray-500" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4 text-gray-500" />
              ) : (
                <Maximize2 className="h-4 w-4 text-gray-500" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            // Suggestions view
            <div>
              <p className="text-sm text-gray-500 mb-3">For you</p>
              <div className="space-y-2">
                {defaultSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    {getIcon(suggestion.icon)}
                    <span className="text-sm">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Chat view
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3',
                      message.role === 'user'
                        ? 'bg-[#c9a84c] text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    {/* The assistant bubble used to lift the first line into a heading
                        and then print the whole answer underneath, so a reply that opened
                        with a bold line showed that line twice. Nothing here renders
                        markdown, so the bold markers are stripped rather than shown raw. */}
                    <p className="text-sm whitespace-pre-wrap">
                      {message.role === 'assistant'
                        ? message.content.replace(/\*\*/g, '')
                        : message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#D97757' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-black focus-within:border-transparent">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Ask me anything"
              className="flex-1 text-sm outline-none bg-transparent"
              disabled={isLoading}
            />
            <button className="p-1 text-gray-400 hover:text-gray-600" onClick={() => toast.info("Mentions coming soon")}>
              <AtSign className="h-4 w-4" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className={cn(
                'p-1 rounded transition-colors',
                input.trim() && !isLoading
                  ? 'text-gray-900 hover:bg-gray-100'
                  : 'text-gray-300'
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
