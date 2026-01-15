'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Portfolio {
  id: string;
  name: string;
  projectCount: number;
  color: string;
}

export function PortfoliosWidget() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolios() {
      try {
        const res = await fetch('/api/portfolios?limit=5');
        if (res.ok) {
          const data = await res.json();
          setPortfolios(data);
        }
      } catch (error) {
        console.error('Failed to fetch portfolios:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPortfolios();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between -mt-1">
        <span className="text-sm text-slate-500">Your portfolios</span>
        <Button
          variant="link"
          size="sm"
          className="text-black hover:text-black p-0 h-auto"
          onClick={() => router.push('/portfolios')}
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
      ) : portfolios.length === 0 ? (
        <div className="text-center py-8">
          <Briefcase className="h-12 w-12 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-900 mb-1">No portfolios yet</p>
          <p className="text-sm text-slate-500 mb-4">
            Create portfolios to organize related projects
          </p>
          <Button variant="outline" className="gap-2" onClick={() => router.push('/portfolios/new')}>
            <Plus className="h-4 w-4" />
            Create portfolio
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              className="w-full p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left flex items-center gap-3"
              onClick={() => router.push(`/portfolios/${portfolio.id}`)}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: portfolio.color || '#6366f1' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{portfolio.name}</p>
              </div>
              <span className="text-xs text-slate-500">{portfolio.projectCount} projects</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
