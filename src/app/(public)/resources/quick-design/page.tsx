'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/components/ttc/language-provider';
import {
  QUICK_DESIGN_TOOLS,
  CATEGORIES,
  type QuickDesignTool,
  type ToolCategory,
} from '@/lib/resources/quick-design-tools';
import { CATEGORY_ICONS } from '@/components/ttc/quick-design-icons';

type Filter = 'all' | 'available' | ToolCategory;

export default function QuickDesignPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const totals = useMemo(() => {
    const available = QUICK_DESIGN_TOOLS.filter((t) => t.status === 'available').length;
    return { all: QUICK_DESIGN_TOOLS.length, available };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUICK_DESIGN_TOOLS.filter((tool) => {
      if (filter === 'available' && tool.status !== 'available') return false;
      if (filter !== 'all' && filter !== 'available' && tool.category !== filter) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, QuickDesignTool[]> = {};
    for (const t of filtered) {
      (map[t.category] ??= []).push(t);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <section className="page-hero page-hero--compact">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/resources">{t('resources.title')}</Link>
            <span>/</span>
            <span>Quick Design</span>
          </div>
          <span className="section__label">Design Library</span>
          <h1 className="page-hero__title">Quick Design</h1>
          <p className="page-hero__subtitle">
            {totals.all} structural design calculators across every major code.{' '}
            {totals.available} live today, the rest shipping progressively.
          </p>
        </div>
      </section>

      <section className="section section--tool">
        <div className="container container--wide">
          <div className="qd-toolbar">
            <div className="qd-search">
              <input
                type="search"
                className="qd-search__input"
                placeholder="Search by standard (AISC 360, ACI 318, EN 1993…) or keyword"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="qd-filters">
              <button
                type="button"
                className={`qd-chip ${filter === 'all' ? 'is-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({totals.all})
              </button>
              <button
                type="button"
                className={`qd-chip qd-chip--ok ${filter === 'available' ? 'is-active' : ''}`}
                onClick={() => setFilter('available')}
              >
                Available now ({totals.available})
              </button>
              {CATEGORIES.map((c) => {
                const count = QUICK_DESIGN_TOOLS.filter((t) => t.category === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`qd-chip ${filter === c ? 'is-active' : ''}`}
                    onClick={() => setFilter(c)}
                  >
                    {c} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="qd-empty">No tools match your search.</div>
          ) : (
            CATEGORIES.filter((c) => grouped[c]?.length).map((cat) => (
              <div key={cat} className="qd-group">
                <div className="qd-group__head">
                  <span className="qd-group__icon">{CATEGORY_ICONS[cat]}</span>
                  <h2 className="qd-group__title">{cat}</h2>
                  <span className="qd-group__count">{grouped[cat].length} tools</span>
                </div>
                <div className="qd-grid">
                  {grouped[cat].map((tool) => (
                    <ToolCard key={`${cat}-${tool.title}`} tool={tool} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function ToolCard({ tool }: { tool: QuickDesignTool }) {
  const inner = (
    <>
      <div className="qd-card__head">
        <span className="qd-card__icon">{CATEGORY_ICONS[tool.category]}</span>
        {tool.isNew && <span className="qd-card__new">NEW</span>}
        <span
          className={`qd-card__status qd-card__status--${tool.status === 'available' ? 'ok' : 'soon'}`}
        >
          {tool.status === 'available' ? 'Available' : 'Coming Soon'}
        </span>
      </div>
      {tool.code && tool.code !== '—' && <div className="qd-card__code">{tool.code}</div>}
      <h3 className="qd-card__title">{tool.title}</h3>
      <p className="qd-card__desc">{tool.description}</p>
      {tool.status === 'available' && tool.href && (
        <span className="qd-card__cta">
          Open tool <span className="btn__arrow">→</span>
        </span>
      )}
    </>
  );

  if (tool.status === 'available' && tool.href) {
    return (
      <Link
        href={tool.href}
        className="qd-card qd-card--available"
        data-aos="fade-up"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="qd-card qd-card--soon" data-aos="fade-up">
      {inner}
    </div>
  );
}
