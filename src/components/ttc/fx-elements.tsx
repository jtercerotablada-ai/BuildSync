'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function FxElements() {
  const pathname = usePathname();

  useEffect(() => {
    // Scroll progress bar
    const scrollProgress = document.getElementById('scrollProgress');
    const cursorDot = document.getElementById('cursorDot');
    const cursorRing = document.getElementById('cursorRing');

    function updateScrollProgress() {
      if (!scrollProgress) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgress.style.width = progress + '%';
    }

    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();

    // Scroll animations ([data-aos])
    const animatedEls = Array.from(document.querySelectorAll<HTMLElement>('[data-aos]'));
    let aosObserver: IntersectionObserver | null = null;
    if (!('IntersectionObserver' in window)) {
      animatedEls.forEach((el) => el.classList.add('aos-animate'));
    } else {
      aosObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const delay = (entry.target as HTMLElement).getAttribute('data-aos-delay');
              if (delay) {
                setTimeout(() => entry.target.classList.add('aos-animate'), parseInt(delay));
              } else {
                entry.target.classList.add('aos-animate');
              }
              aosObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
      );
      animatedEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('aos-animate');
        } else {
          aosObserver?.observe(el);
        }
      });
    }

    // Custom cursor (desktop only)
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let targetX = 0, targetY = 0, ringX = 0, ringY = 0;
    let rafId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (cursorDot) {
        cursorDot.style.transform = `translate(${targetX - 3}px, ${targetY - 3}px)`;
      }
    };

    const animateRing = () => {
      ringX += (targetX - ringX) * 0.15;
      ringY += (targetY - ringY) * 0.15;
      if (cursorRing) {
        cursorRing.style.transform = `translate(${ringX - 18}px, ${ringY - 18}px)`;
      }
      rafId = requestAnimationFrame(animateRing);
    };

    const hoverables: HTMLElement[] = [];
    const onEnter = () => {
      cursorRing?.classList.add('cursor-hover');
      cursorDot?.classList.add('cursor-hover');
    };
    const onLeave = () => {
      cursorRing?.classList.remove('cursor-hover');
      cursorDot?.classList.remove('cursor-hover');
    };

    if (isDesktop && cursorDot && cursorRing) {
      document.body.classList.add('cursor-active');
      document.addEventListener('mousemove', onMouseMove);
      rafId = requestAnimationFrame(animateRing);

      document.querySelectorAll<HTMLElement>(
        'a, button, .project-card, .service-card, input, textarea, select, [data-magnetic]'
      ).forEach((el) => {
        hoverables.push(el);
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    } else {
      if (cursorDot) cursorDot.style.display = 'none';
      if (cursorRing) cursorRing.style.display = 'none';
    }

    // Magnetic buttons
    const magnetics: { el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }[] = [];
    if (isDesktop) {
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const move = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          el.style.transform = `translate(${x * 0.25}px, ${y * 0.4}px)`;
        };
        const leave = () => {
          el.style.transform = '';
        };
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
        magnetics.push({ el, move, leave });
      });
    }

    // Tilt effect
    const tilts: { el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }[] = [];
    if (isDesktop) {
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        el.style.transformStyle = 'preserve-3d';
        el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

        const move = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          const rotateX = y * -8;
          const rotateY = x * 8;
          el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
        };
        const leave = () => {
          el.style.transform = '';
        };
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
        tilts.push({ el, move, leave });
      });
    }

    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      aosObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
      hoverables.forEach((el) => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
      });
      magnetics.forEach(({ el, move, leave }) => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      });
      tilts.forEach(({ el, move, leave }) => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      });
      document.body.classList.remove('cursor-active');
    };
  }, [pathname]);

  return (
    <>
      <div className="scroll-progress" id="scrollProgress"></div>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>
    </>
  );
}
