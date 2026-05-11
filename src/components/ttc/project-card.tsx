'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ProjectCardProps {
  image: string;
  title: string;
  description: string;
  category?: string;
  index?: number;
  total?: number;
  href?: string;
  delay?: number;
}

// Renders a project tile. If `href` is provided and points somewhere real
// (not "#"), the whole card becomes a link with the navigation arrow.
// Otherwise it renders as a static showcase tile — no arrow, no pointer
// cursor, no broken nav. Use this until per-project detail pages exist.
export function ProjectCard({
  image,
  title,
  description,
  category,
  index,
  total,
  href,
  delay,
}: ProjectCardProps) {
  const isLink = href && href !== '#';

  const inner = (
    <>
      <div className="project-card__img">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          style={{ objectFit: 'cover' }}
          loading="lazy"
        />
      </div>
      {typeof index === 'number' && typeof total === 'number' && (
        <span className="project-card__number">
          {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      )}
      {isLink && (
        <div className="project-card__arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      )}
      <div className="project-card__info">
        {category && <span className="project-card__category">{category}</span>}
        <h3>{title}</h3>
        <span>{description}</span>
      </div>
    </>
  );

  if (isLink) {
    return (
      <Link href={href} className="project-card" data-aos="fade-up" data-aos-delay={delay} data-tilt>
        {inner}
      </Link>
    );
  }

  return (
    <div className="project-card project-card--static" data-aos="fade-up" data-aos-delay={delay} data-tilt>
      {inner}
    </div>
  );
}
