'use client';

import { useState, useEffect } from 'react';
import {
  MoreHorizontal,
  Check,
  Trash2,
  Sparkles,
  Search,
  FileText,
  AtSign,
  ArrowUp,
  Loader2,
  ChevronRight,
  ExternalLink,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { WidgetSize } from '@/types/dashboard';
import { useAIPanel } from '@/contexts/ai-panel-context';

const STORAGE_KEY = 'buildsync-ai-past-topics';

interface Suggestion {
  id: string;
  icon: 'search' | 'docs';
  text: string;
}

interface PastTopic {
  id: string;
  question: string;
  date: string;
  timestamp: number;
}

interface AIAssistantWidgetProps {
  size?: WidgetSize;
  onSizeChange?: (size: WidgetSize) => void;
  onRemove?: () => void;
}

const defaultSuggestions: Suggestion[] = [
  { id: '1', icon: 'search', text: 'Find my recently overdue tasks' },
  { id: '2', icon: 'docs', text: 'How to get started with BuildSync' },
  { id: '3', icon: 'docs', text: 'How to create and manage projects' },
];

// Helper to format relative date like Asana
function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / 86400000);

  // Format time as "12:56pm"
  const formatTime = (d: Date) => {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')}${ampm}`;
  };

  // Check if same day
  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  if (isToday) return `Today at ${formatTime(date)}`;
  if (isYesterday) return `Yesterday at ${formatTime(date)}`;
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return date.toLocaleDateString();
}

export function AIAssistantWidget({
  size = 'half',
  onSizeChange,
  onRemove,
}: AIAssistantWidgetProps) {
  const { openPanel } = useAIPanel();
  const [activeTab, setActiveTab] = useState<'ask' | 'past'>('ask');
  const [question, setQuestion] = useState('');
  const [pastTopics, setPastTopics] = useState<PastTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  // Load past topics from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPastTopics(JSON.parse(saved));
      } catch {
        setPastTopics([]);
      }
    }
  }, []);

  // Save past topics to localStorage
  const savePastTopics = (topics: PastTopic[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
    setPastTopics(topics);
  };

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return;

    const currentQuestion = question;
    setIsLoading(true);
    setResponse(null);

    // Add to past topics
    const newTopic: PastTopic = {
      id: Date.now().toString(),
      question: currentQuestion,
      date: 'Just now',
      timestamp: Date.now(),
    };
    savePastTopics([newTopic, ...pastTopics.slice(0, 19)]); // Keep max 20

    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Answer the following question helpfully and concisely:',
          text: currentQuestion,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.result);
      } else {
        setResponse('Sorry, I couldn\'t process your request. Please try again.');
      }
    } catch {
      setResponse('Sorry, something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setQuestion('');
    }
  };

  const handleSuggestionClick = (text: string) => {
    setQuestion(text);
  };

  const handlePastTopicClick = (topic: PastTopic) => {
    setQuestion(topic.question);
    setActiveTab('ask');
    setResponse(null);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" style={{ color: '#D97757' }} />
          <h3 className="font-semibold text-gray-900">BuildSync AI</h3>
        </div>

        {/* Dropdown 3 puntos */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal className="h-5 w-5 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Open BuildSync AI */}
            <DropdownMenuItem
              onClick={openPanel}
              className="cursor-pointer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open BuildSync AI
            </DropdownMenuItem>

            {/* View past topics */}
            <DropdownMenuItem
              onClick={() => { setActiveTab('past'); setResponse(null); }}
              className="cursor-pointer"
            >
              <Clock className="h-4 w-4 mr-2" />
              View past topics
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

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-3">
        <button
          onClick={() => { setActiveTab('ask'); setResponse(null); }}
          className={cn(
            'pb-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'ask'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Ask
        </button>
        <button
          onClick={() => { setActiveTab('past'); setResponse(null); }}
          className={cn(
            'pb-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'past'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Past topics
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'ask' ? (
          <>
            {response ? (
              // Show AI response
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">Response:</p>
                  <p className="text-sm text-gray-700">{response}</p>
                </div>
                <button
                  onClick={() => setResponse(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Ask another question
                </button>
              </div>
            ) : isLoading ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mb-2" style={{ color: '#D97757' }} />
                <p className="text-sm text-gray-500">Thinking...</p>
              </div>
            ) : (
              // Suggestions
              <>
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
              </>
            )}
          </>
        ) : (
          // Past topics tab
          <div className="space-y-2">
            {pastTopics.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No past topics yet
              </p>
            ) : (
              pastTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => handlePastTopicClick(topic)}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">
                      {formatRelativeDate(topic.timestamp)}
                    </p>
                    <p className="text-sm text-gray-900 truncate">{topic.question}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400 ml-3 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 mt-auto">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-black focus-within:border-transparent">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Ask me anything"
            className="flex-1 text-sm outline-none bg-transparent"
            disabled={isLoading}
          />
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <AtSign className="h-4 w-4" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || isLoading}
            className={cn(
              'p-1 rounded transition-colors',
              question.trim() && !isLoading
                ? 'text-gray-900 hover:bg-gray-100'
                : 'text-gray-300'
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
