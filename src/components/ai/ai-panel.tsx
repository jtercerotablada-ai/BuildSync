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
  { id: '2', icon: 'docs', text: 'How to get started with BuildSync' },
  { id: '3', icon: 'docs', text: 'Summarize my project progress' },
];

export function AIPanel({ isOpen, onClose }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversationTitle, setConversationTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          prompt: 'Answer the following question helpfully and concisely. You are BuildSync AI, an assistant for project management.',
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
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I couldn\'t process your request. Please try again.',
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
                <h2 className="font-semibold text-gray-900">BuildSync AI</h2>
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
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {message.content.split('\n')[0].includes('**')
                          ? message.content.split('\n')[0].replace(/\*\*/g, '')
                          : ''}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
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
