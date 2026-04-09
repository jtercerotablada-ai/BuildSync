'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ProjectCardProps {
  image: string;
  title: string;
  description: string;
  href?: string;
}

export function ProjectCard({ image, title, description, href = '/projects' }: ProjectCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        aspectRatio: '4/3',
        textDecoration: 'none',
        background: '#141414',
      }}
    >
      <Image
        src={image}
        alt={title}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        style={{
          objectFit: 'cover',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="ttc-project-img"
        loading="lazy"
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '2rem',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
          zIndex: 2,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--ttc-font-heading)',
            fontSize: '1.375rem',
            fontWeight: 400,
            color: '#fff',
            marginBottom: '0.375rem',
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontSize: '0.8125rem',
            color: '#c9a84c',
            letterSpacing: '0.03em',
          }}
        >
          {description}
        </span>
      </div>
      <style jsx global>{`
        .ttc-project-img { transition: transform 0.6s cubic-bezier(0.4,0,0.2,1) !important; }
        a:hover .ttc-project-img { transform: scale(1.05) !important; }
      `}</style>
    </Link>
  );
}
