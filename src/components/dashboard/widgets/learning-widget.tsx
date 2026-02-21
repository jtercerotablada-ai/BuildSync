'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  completed: boolean;
  url: string;
}

const STORAGE_KEY = 'buildsync-completed-tutorials';

const TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting started with BuildSync',
    description: 'Learn the basics of navigating and using BuildSync',
    duration: '3 min',
    completed: false,
    url: '/home',
  },
  {
    id: 'create-project',
    title: 'Create your first project',
    description: 'Set up a project and invite your team',
    duration: '2 min',
    completed: false,
    url: '/projects?create=true',
  },
  {
    id: 'manage-tasks',
    title: 'Managing tasks effectively',
    description: 'Learn to create, assign, and track tasks',
    duration: '4 min',
    completed: false,
    url: '/inbox',
  },
  {
    id: 'goals-okrs',
    title: 'Setting goals and OKRs',
    description: 'Track your team\'s objectives and key results',
    duration: '3 min',
    completed: false,
    url: '/goals',
  },
];

export function LearningWidget() {
  const router = useRouter();
  const [tutorials, setTutorials] = useState<Tutorial[]>(TUTORIALS);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const completedIds = JSON.parse(saved);
        setTutorials(TUTORIALS.map(t => ({
          ...t,
          completed: completedIds.includes(t.id),
        })));
      } catch {
        // ignore
      }
    }

    const dismissedKey = localStorage.getItem('buildsync-learning-dismissed');
    if (dismissedKey === 'true') {
      setDismissed(true);
    }
  }, []);

  const toggleCompleted = (id: string) => {
    const updated = tutorials.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    setTutorials(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.filter(t => t.completed).map(t => t.id)));
  };

  const handleNavigate = (tutorial: Tutorial) => {
    router.push(tutorial.url);
  };

  const dismissWidget = () => {
    setDismissed(true);
    localStorage.setItem('buildsync-learning-dismissed', 'true');
  };

  const completedCount = tutorials.filter(t => t.completed).length;
  const progress = (completedCount / tutorials.length) * 100;

  if (dismissed) {
    return (
      <div className="text-center py-8">
        <GraduationCap className="h-12 w-12 mx-auto mb-2 text-slate-300" />
        <p className="font-medium text-slate-900 mb-1">Learning dismissed</p>
        <Button
          variant="link"
          size="sm"
          className="text-black"
          onClick={() => {
            setDismissed(false);
            localStorage.removeItem('buildsync-learning-dismissed');
          }}
        >
          Show tutorials again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between -mt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            {completedCount} of {tutorials.length} completed
          </span>
          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
          onClick={dismissWidget}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {tutorials.map((tutorial) => (
          <div
            key={tutorial.id}
            className={cn(
              "w-full p-3 rounded-lg border transition-colors text-left flex items-center gap-3",
              tutorial.completed
                ? "border-black bg-white"
                : "border-slate-200 hover:bg-slate-50"
            )}
          >
            {/* Completion checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCompleted(tutorial.id);
              }}
              className="flex-shrink-0"
              aria-label={tutorial.completed ? 'Mark as incomplete' : 'Mark as complete'}
            >
              {tutorial.completed ? (
                <CheckCircle2 className="h-8 w-8 text-black" />
              ) : (
                <div className="h-8 w-8 rounded-full border-2 border-slate-300 hover:border-black transition-colors" />
              )}
            </button>

            {/* Clickable content — navigates to tutorial URL */}
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => handleNavigate(tutorial)}
            >
              <p className={cn(
                "text-sm font-medium",
                tutorial.completed ? "text-black line-through" : "text-slate-900"
              )}>
                {tutorial.title}
              </p>
              <p className="text-xs text-slate-500">{tutorial.description}</p>
            </button>

            <button
              onClick={() => handleNavigate(tutorial)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              <span className="text-xs">{tutorial.duration}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
