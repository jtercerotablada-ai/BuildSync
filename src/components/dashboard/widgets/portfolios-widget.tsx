'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Portfolio {
  id: string;
  name: string;
  color: string | null;
  _count: {
    projects: number;
  };
}

export function PortfoliosWidget() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/portfolios?limit=5&fields=summary');
      if (res.ok) {
        const data = await res.json();
        setPortfolios(data);
      } else {
        setError('Failed to load portfolios');
      }
    } catch (err) {
      console.error('Failed to fetch portfolios:', err);
      setError('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between -mt-1 flex-shrink-0">
        <span className="text-sm text-gray-500">Your portfolios</span>
        <Button
          asChild
          variant="link"
          size="sm"
          className="text-black hover:text-black p-0 h-auto"
        >
          <Link href="/portfolios">
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[46px] bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchPortfolios();
            }}
          >
            Retry
          </Button>
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-8">
          <Briefcase className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="font-medium text-black mb-1">No portfolios yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Create portfolios to organize related projects
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/portfolios?create=1">
              <Plus className="h-4 w-4" />
              Create portfolio
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          {portfolios.map((portfolio) => (
            <Link
              key={portfolio.id}
              href={`/portfolios/${portfolio.id}`}
              className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left flex items-center gap-3"
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                // Fallback was indigo (#6366f1) — that was the only
                // off-palette color in the whole tile. Switched to
                // the brand gold so unlabeled portfolios match the
                // rest of the cockpit.
                style={{ backgroundColor: portfolio.color || '#c9a84c' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black truncate">{portfolio.name}</p>
              </div>
              <span className="text-xs text-gray-500">
                {portfolio._count.projects}{' '}
                {portfolio._count.projects === 1 ? 'project' : 'projects'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
