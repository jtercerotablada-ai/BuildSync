'use client';

import React, { useRef, useState, useEffect } from 'react';

interface CounterStatProps {
  target: number;
  suffix?: string;
  label: string;
  delay?: number;
}

export function CounterStat({ target, suffix = '', label, delay }: CounterStatProps) {
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
    const duration = 2200;
    let startTime: number | null = null;

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    }

    const rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [started, target]);

  return (
    <div ref={ref} className="stat" data-aos="fade-up" data-aos-delay={delay}>
      <span className="stat__number" data-count={target}>
        {count}
      </span>
      {suffix && <span className="stat__suffix">{suffix}</span>}
      <span className="stat__label">{label}</span>
    </div>
  );
}
