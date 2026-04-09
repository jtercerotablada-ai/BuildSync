'use client';

import React, { useRef, useState, useEffect } from 'react';

interface CounterStatProps {
  target: number;
  suffix?: string;
  label: string;
}

export function CounterStat({ target, suffix = '', label }: CounterStatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = duration / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [started, target]);

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <span
          style={{
            fontFamily: 'var(--ttc-font-heading)',
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            fontWeight: 400,
            color: '#c9a84c',
            lineHeight: 1,
          }}
        >
          {count}
        </span>
        {suffix && (
          <span
            style={{
              fontFamily: 'var(--ttc-font-heading)',
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              color: '#c9a84c',
              marginLeft: '0.125rem',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: '0.8125rem',
          color: '#999',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}
