'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowRight, Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormSubmission {
  id: string;
  formName: string;
  submittedBy: string;
  createdAt: string;
  status: 'pending' | 'reviewed';
}

export function FormsWidget() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch('/api/forms/submissions?limit=5');
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data);
        }
      } catch (error) {
        console.error('Failed to fetch form submissions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between -mt-1">
        <span className="text-sm text-slate-500">Manage work request submissions</span>
        <Button
          variant="link"
          size="sm"
          className="text-black hover:text-black p-0 h-auto"
          onClick={() => router.push('/forms')}
        >
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8">
          <Inbox className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-900 mb-1">No submissions yet</p>
          <p className="text-sm text-slate-500 mb-4">
            Create forms to collect work requests from your team
          </p>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/forms/new')}>
            <Plus className="h-4 w-4" />
            Create form
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <button
              key={submission.id}
              className="w-full p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              onClick={() => router.push(`/forms/submissions/${submission.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{submission.formName}</p>
                  <p className="text-xs text-slate-500">
                    {submission.submittedBy} · {formatDate(submission.createdAt)}
                  </p>
                </div>
                {submission.status === 'pending' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white text-black border border-black">
                    Pending
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
