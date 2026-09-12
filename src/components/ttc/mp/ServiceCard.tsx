'use client';

import React from 'react';
import Link from 'next/link';
import { imagery, type Service } from '@/lib/ttc/site';
import type { SiteContent } from '@/lib/ttc/content';
import { Img } from './media';
import { Reveal } from './primitives';
import { useContent, useL } from './lang';

type Svc = SiteContent['services'][number] | Service;

/**
 * One service, in the client's terms: photograph, name, one-line summary and
 * the four questions every client asks — when do I need this, what does it
 * include, what do I get, what do I do next. Compact on the index pages;
 * the detail page carries the full lists.
 */
export function ServiceCard({
  service,
  index,
  compact = false,
}: {
  service: Svc;
  index?: number;
  compact?: boolean;
}) {
  const c = useContent();
  const l = useL();
  const u = c.ui;
  const href = l(`/services/${service.slug}`);

  return (
    <Reveal as="div" delay={((index ?? 0) % 3) * 0.05} className="mp-svc">
      <Link href={href} className="mp-svc__media" tabIndex={-1} aria-hidden="true">
        <Img
          photo={imagery.services[service.slug]}
          sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
        />
      </Link>
      <div className="mp-svc__body">
        <p className="mp-svc__track">
          <span className="mp-secnum">{service.n}</span>
          {service.track === 'new' ? u.newProjects : u.existingBuildings}
        </p>
        <h3 className="mp-svc__title">
          <Link href={href}>{service.title}</Link>
        </h3>
        <p className="mp-svc__summary">{service.summary}</p>

        {!compact ? (
          <dl className="mp-svc__qa">
            <div>
              <dt>{u.whenYouNeedIt}</dt>
              <dd>{service.when[0]}</dd>
            </div>
            <div>
              <dt>{u.whatsIncluded}</dt>
              <dd>{service.capabilities.join(' · ')}</dd>
            </div>
            <div>
              <dt>{u.whatYouReceive}</dt>
              <dd>{service.deliverables[0]}</dd>
            </div>
            <div>
              <dt>{u.nextStep}</dt>
              <dd>{service.nextStep}</dd>
            </div>
          </dl>
        ) : null}

        <Link href={href} className="mp-link mp-svc__go">
          {u.exploreService} <i aria-hidden="true">→</i>
        </Link>
      </div>
    </Reveal>
  );
}
