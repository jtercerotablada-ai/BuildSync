'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import { ResourceCard } from '@/components/ttc/resource-card';
import {
  QUICK_DESIGN_TOOLS,
  CATEGORIES,
  type QuickDesignTool,
  type ToolCategory,
} from '@/lib/resources/quick-design-tools';
import { CATEGORY_ICONS } from '@/components/ttc/quick-design-icons';
import { getToolIcon } from '@/components/ttc/tool-icons';

type Filter = 'all' | 'available' | 'coming-soon';

const FEATURED_TITLES = [
  'Simply Supported Beam Analysis',
  'Multi-Span Beam Analysis',
  'ASCE 7-22 Wind Load Generator',
  'ACI 318-25 Spread Footing Design',
];

export default function ResourcesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | 'all'>('all');

  const totals = useMemo(
    () => ({
      all: QUICK_DESIGN_TOOLS.length,
      available: QUICK_DESIGN_TOOLS.filter((x) => x.status === 'available').length,
      soon: QUICK_DESIGN_TOOLS.filter((x) => x.status === 'coming-soon').length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUICK_DESIGN_TOOLS.filter((tool) => {
      if (statusFilter !== 'all' && tool.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter, categoryFilter]);

  const featured = useMemo(
    () =>
      FEATURED_TITLES.map((title) =>
        filtered.find((tool) => tool.title === title && tool.status === 'available' && !!tool.href),
      ).filter((tool): tool is QuickDesignTool => Boolean(tool)),
    [filtered],
  );

  const grouped = useMemo(() => {
    const featuredSet = new Set(featured);
    const map: Record<string, QuickDesignTool[]> = {};
    for (const tool of filtered) {
      if (featuredSet.has(tool)) continue;
      (map[tool.category] ??= []).push(tool);
    }
    return map;
  }, [filtered, featured]);

  const visibleCategories = CATEGORIES.filter((c) => grouped[c]?.length);

  return (
    <>
      {/* Hero with stats + search */}
      <section className="page-hero resources-hero">
        <div className="container">
          <span className="section__label">{t('resources.section.label')}</span>
          <h1 className="page-hero__title">{t('resources.title')}</h1>
          <p className="page-hero__subtitle">{t('resources.subtitle')}</p>

          <div className="resources-stats">
            <div className="resources-stat">
              <span className="resources-stat__num">{totals.available}</span>
              <span className="resources-stat__label">{t('resources.stats.live')}</span>
            </div>
            <div className="resources-stat">
              <span className="resources-stat__num">{totals.soon}</span>
              <span className="resources-stat__label">{t('resources.stats.coming')}</span>
            </div>
            <div className="resources-stat">
              <span className="resources-stat__num">100%</span>
              <span className="resources-stat__label">{t('resources.stats.free')}</span>
            </div>
          </div>

          <div className="resources-toolbar">
            <div className="resources-search">
              <svg
                className="resources-search__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="20"
                height="20"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('resources.search.placeholder')}
                className="resources-search__input"
                aria-label={t('resources.search.placeholder')}
              />
            </div>
            <div className="resources-filters">
              <button
                type="button"
                className={`resources-filter ${statusFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                {t('resources.filter.all')} ({totals.all})
              </button>
              <button
                type="button"
                className={`resources-filter ${statusFilter === 'available' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('available')}
              >
                {t('resources.filter.available')} ({totals.available})
              </button>
              <button
                type="button"
                className={`resources-filter ${statusFilter === 'coming-soon' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('coming-soon')}
              >
                In Development ({totals.soon})
              </button>
            </div>
          </div>

          {/* Category chips */}
          <div className="resources-categories">
            <button
              type="button"
              className={`resources-cat-chip ${categoryFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All categories
            </button>
            {CATEGORIES.map((c) => {
              const count = QUICK_DESIGN_TOOLS.filter((t) => t.category === c).length;
              if (count === 0) return null;
              return (
                <button
                  key={c}
                  type="button"
                  className={`resources-cat-chip ${categoryFilter === c ? 'is-active' : ''}`}
                  onClick={() => setCategoryFilter(c)}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured tools — same card style as the grid below */}
      {featured.length > 0 && (
        <section className="section resources-page">
          <div className="container">
            <div className="section__header">
              <span className="section__label">Featured</span>
              <h2 className="section__title">{t('resources.featured.title')}</h2>
            </div>
            <div className="services__grid resources__grid">
              {featured.map((tool, i) => (
                <ResourceCard
                  key={`featured-${i}-${tool.title}`}
                  icon={getToolIcon(tool.title, tool.category)}
                  title={tool.title}
                  description={tool.description}
                  code={tool.code}
                  status={tool.status}
                  statusLabel={
                    tool.status === 'available'
                      ? t('resources.available')
                      : t('resources.comingSoon')
                  }
                  href={tool.href}
                  openLabel={t('resources.openTool')}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category sections — every catalog category that has matches */}
      {visibleCategories.map((cat, idx) => (
        <section
          key={cat}
          className={`section resources-page ${idx % 2 === 1 ? 'resources-page--alt' : ''}`}
        >
          <div className="container">
            <div className="section__header">
              <span className="section__label">{String(idx + 1).padStart(2, '0')}</span>
              <h2 className="section__title">{cat}</h2>
              <span className="resources-section-count">
                {grouped[cat].length}{' '}
                {grouped[cat].length === 1 ? 'tool' : 'tools'}
              </span>
            </div>
            <div className="services__grid resources__grid">
              {grouped[cat].map((tool, i) => (
                <ResourceCard
                  key={`${cat}-${i}-${tool.title}`}
                  icon={getToolIcon(tool.title, tool.category)}
                  title={tool.title}
                  description={tool.description}
                  code={tool.code}
                  status={tool.status}
                  statusLabel={
                    tool.status === 'available'
                      ? t('resources.available')
                      : t('resources.comingSoon')
                  }
                  href={tool.href}
                  openLabel={t('resources.openTool')}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Empty state */}
      {filtered.length === 0 && (
        <section className="section resources-page">
          <div className="container resources-empty">
            <p>{t('resources.empty')}</p>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section cta-section">
        <div className="container cta-section__inner">
          <h2>{t('resources.cta.heading')}</h2>
          <p className="cta-section__desc">{t('resources.cta.desc')}</p>
          <Link href="/contact" className="btn btn--primary" data-magnetic>
            <span>{t('cta.contact')}</span>
            <span className="btn__arrow">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
