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
    let mutationObserver: MutationObserver | null = null;

    const registerAosElement = (el: HTMLElement) => {
      if (el.classList.contains('aos-animate')) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('aos-animate');
      } else if (aosObserver) {
        aosObserver.observe(el);
      } else {
        el.classList.add('aos-animate');
      }
    };

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
      animatedEls.forEach(registerAosElement);

      // Catch dynamically rendered [data-aos] elements (e.g. filtered project grids).
      // Without this, anything added after the initial observer setup stays at
      // opacity:0 because [data-aos] { opacity: 0 } stays applied until aos-animate.
      if ('MutationObserver' in window) {
        mutationObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
              if (!(node instanceof HTMLElement)) return;
              if (node.hasAttribute('data-aos')) registerAosElement(node);
              node
                .querySelectorAll<HTMLElement>('[data-aos]:not(.aos-animate)')
                .forEach(registerAosElement);
            });
          }
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    // Parallax depth — offset written into the --parallax CSS var, consumed
    // by ttc-fx-pro.css. Subtle, rAF-throttled, disabled for reduced-motion.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parallaxEls = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
    let parallaxRaf: number | null = null;
    // Layout position via the offset chain — transform-independent, so the
    // element's OWN parallax translate never feeds back into the measurement
    // (measuring getBoundingClientRect would, and stalls the effect).
    const docTop = (node: HTMLElement | null) => {
      let t = 0;
      while (node) { t += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
      return t;
    };
    const updateParallax = () => {
      parallaxRaf = null;
      const vh = window.innerHeight;
      const sy = window.scrollY;
      for (const el of parallaxEls) {
        const h = el.offsetHeight;
        const centerVp = docTop(el) + h / 2 - sy; // element centre, viewport-relative
        if (centerVp < -h - 400 || centerVp > vh + h + 400) continue;
        const speed = parseFloat(el.getAttribute('data-parallax') || '0.3') || 0.3;
        const offset = (centerVp - vh / 2) / vh;
        const px = Math.max(-38, Math.min(38, -offset * speed * 100));
        el.style.setProperty('--parallax', `${px.toFixed(1)}px`);
      }
    };
    const onParallax = () => {
      if (parallaxRaf === null) parallaxRaf = requestAnimationFrame(updateParallax);
    };
    if (parallaxEls.length && !prefersReducedMotion) {
      window.addEventListener('scroll', onParallax, { passive: true });
      window.addEventListener('resize', onParallax, { passive: true });
      updateParallax();
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

    // Magnetic-button and 3D-tilt effects intentionally removed (2026-07):
    // the site's design language is now editorial/minimal — no gimmicks.

    return () => {
      window.removeEventListener('scroll', updateScrollProgress);
      window.removeEventListener('scroll', onParallax);
      window.removeEventListener('resize', onParallax);
      if (parallaxRaf !== null) cancelAnimationFrame(parallaxRaf);
      aosObserver?.disconnect();
      mutationObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMouseMove);
      hoverables.forEach((el) => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
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
