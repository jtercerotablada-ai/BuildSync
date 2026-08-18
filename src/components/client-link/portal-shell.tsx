"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { company } from "@/lib/ttc/site";

/**
 * The app shell around the client project page: a fixed left sidebar and a
 * sticky top bar, with the server-rendered project content passed as children.
 *
 * IMPORTANT — this is chrome, not auth. There is no account, no inbox and no
 * multi-project list on a password-less single-project link, so:
 *   • the sidebar is IN-PAGE navigation — every item smooth-scrolls to a real
 *     section on this one page (or is honestly marked "Soon");
 *   • the "user" is the share link's own label (e.g. "Board president"), the
 *     only identity this page legitimately knows. No fabricated name ever.
 *   • notifications is a static, badge-less affordance that only says the firm
 *     will email about updates.
 *
 * All identity/meta values are passed in already-resolved and client-safe; this
 * component fetches nothing.
 */

export interface PortalViewer {
  /** The share link's label, already resolved by the route. May be empty. */
  label: string | null;
}

export interface PortalMeta {
  projectNumber: string | null;
  typeLabel: string | null;
  status: { label: string; tone: "positive" | "neutral" };
}

/** First-two-word (or first-two-letter) initials. Empty when there is no name. */
function initialsFrom(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* ── Minimalist line icons (consistent 24-grid, 1.7 stroke) ──────────── */
type IconProps = { className?: string };
const ic = {
  dashboard: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  projects: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 20V7.5L11 4l7 3.5V20" />
      <path d="M4 20h16" />
      <path d="M9 20v-5h4v5" />
      <path d="M8 10h.01M14 10h.01" />
    </svg>
  ),
  documents: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M13 3.5V9h5" />
      <path d="M8.5 13.5h7M8.5 16.5h5" />
    </svg>
  ),
  messages: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1Z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </svg>
  ),
  inspections: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16M8 3.5v3M16 3.5v3" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  account: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  ),
  bell: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  menu: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  caret: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  mail: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  lock: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  ),
};

type NavKey = "dashboard" | "projects" | "documents" | "inspections";

/** id on the page → nav key it lights up. Order matters (top → bottom). */
const SPY: { key: NavKey; id: string }[] = [
  { key: "dashboard", id: "p-top" },
  { key: "projects", id: "hero" },
  { key: "documents", id: "documents" },
  { key: "inspections", id: "inspections" },
];

const NAV: { key: NavKey; label: string; target: string; icon: (p: IconProps) => React.ReactElement }[] = [
  { key: "dashboard", label: "Dashboard", target: "p-top", icon: ic.dashboard },
  { key: "projects", label: "Projects", target: "hero", icon: ic.projects },
  { key: "documents", label: "Documents", target: "documents", icon: ic.documents },
  { key: "inspections", label: "Inspections", target: "inspections", icon: ic.inspections },
];

function StatusChip({ status }: { status: PortalMeta["status"] }) {
  const cls = status.tone === "positive" ? "p-pill--gold" : "p-pill--neutral";
  return (
    <span className={`p-pill ${cls}`}>
      <span aria-hidden className="p-pill__dot" />
      {status.label}
    </span>
  );
}

export function PortalShell({
  viewer,
  meta,
  contactEmail,
  children,
}: {
  viewer: PortalViewer;
  meta: PortalMeta;
  contactEmail: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<NavKey>("dashboard");
  const [menu, setMenu] = useState<null | "user" | "account">(null);
  const userWrapRef = useRef<HTMLDivElement>(null);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  const name = viewer.label?.trim() || "";
  const initials = initialsFrom(name);
  const hasName = initials.length > 0;

  const prefersReducedMotion = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const goTo = useCallback(
    (id: string) => {
      setDrawerOpen(false);
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    },
    [prefersReducedMotion]
  );

  // Scroll-spy: light the nav item for the last section past the top band.
  useEffect(() => {
    let ticking = false;
    const recompute = () => {
      const line = 150;
      let current: NavKey = "dashboard";
      for (const { key, id } of SPY) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - line <= 0) current = key;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        recompute();
        ticking = false;
      });
    };
    recompute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userWrapRef.current?.contains(t) || accountWrapRef.current?.contains(t)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const AccessPanel = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="p-avatar" aria-hidden>
          {hasName ? initials : <ic.account />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--ink-900)]">
            {hasName ? name : "Private view"}
          </p>
          <p className="text-[11px] text-[color:var(--ink-500)]">Private project link</p>
        </div>
      </div>
      <div className="my-3 h-px bg-[color:var(--line)]" />
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[color:var(--ink-600)]">
        <span className="mt-0.5 text-[color:var(--gold-600)]">
          <ic.lock />
        </span>
        <span>This link is private to you. Please don&rsquo;t forward it.</span>
      </p>
      <a
        href={`mailto:${contactEmail}`}
        className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[12px] font-semibold text-[color:var(--gold-ink)] transition-colors hover:bg-[color:var(--gold-wash)]"
      >
        <ic.mail />
        <span className="truncate">{contactEmail}</span>
      </a>
    </>
  );

  return (
    <div className="p-shell">
      <a href="#p-main" className="p-skip">
        Skip to content
      </a>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`p-sidebar ${drawerOpen ? "p-sidebar--open" : ""}`}
        aria-label="Portal"
      >
        <div className="p-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ttc/img/logo-square.png"
            alt=""
            width={40}
            height={40}
            className="p-brand__logo"
          />
          <div className="min-w-0">
            <p className="p-brand__legal">{company.name}</p>
            <p className="p-brand__name">{company.shortName}</p>
            <p className="p-brand__disc">{company.discipline}</p>
          </div>
          <button
            type="button"
            className="p-iconbtn ml-auto lg:hidden"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <ic.close />
          </button>
        </div>

        <nav className="p-nav" aria-label="Sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <a
                key={item.key}
                href={`#${item.target}`}
                aria-current={isActive ? "page" : undefined}
                className={`p-nav-item ${isActive ? "p-nav-item--active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActive(item.key);
                  goTo(item.target);
                }}
              >
                <Icon />
                {item.label}
              </a>
            );
          })}

          {/* Messages: a two-way inbox does not exist — honestly deferred. */}
          <span
            className="p-nav-item p-nav-item--disabled"
            aria-disabled="true"
            title="Direct messaging with your engineer is coming soon."
          >
            <ic.messages />
            Messages
            <span className="p-nav-item__soon">Soon</span>
          </span>

          <div className="p-nav__divider" />

          <div ref={accountWrapRef} className="relative">
            <button
              type="button"
              className={`p-nav-item ${menu === "account" ? "p-nav-item--active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={menu === "account"}
              onClick={() => setMenu(menu === "account" ? null : "account")}
            >
              <ic.account />
              Account
            </button>
            {menu === "account" && (
              <div
                role="dialog"
                aria-label="Account"
                className="p-menu"
                style={{ left: 8, top: "calc(100% + 6px)", right: 8, minWidth: 0 }}
              >
                {AccessPanel}
              </div>
            )}
          </div>
        </nav>

        <div className="p-side-foot">
          <div className="p-blueprint" aria-hidden>
            {/* Faint architectural line motif — a watermark, not a diagram. */}
            <svg viewBox="0 0 220 140" fill="none" stroke="var(--gold-600)" strokeWidth="1">
              <g opacity="0.28">
                <path d="M10 138V54l40-20 40 20v84" />
                <path d="M50 34V16M42 20l8-4 8 4" />
                <path d="M10 70h80M10 86h80M10 102h80M10 118h80" />
                <path d="M30 138v-14h12v14M58 138v-14h12v14" />
                <path d="M22 62h8M60 62h8M22 78h8M60 78h8M22 94h8M60 94h8" />
                <path d="M104 138V78l30-14 30 14v60" />
                <path d="M134 64V50" />
                <path d="M104 92h60M104 106h60M104 120h60" />
                <path d="M118 138v-12h10v12M146 138v-12h10v12" />
                <path d="M170 138V96l22-10 22 10v42" />
                <path d="M170 108h44M170 122h44" />
              </g>
            </svg>
          </div>
        </div>
      </aside>

      {/* Mobile scrim */}
      <div
        className={`p-scrim ${drawerOpen ? "p-scrim--open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />

      {/* ── Main column ──────────────────────────────────────────── */}
      <div className="p-main">
        <header className="p-topbar">
          <button
            type="button"
            className="p-iconbtn p-hamburger"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <ic.menu />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="p-topbar__title">Client Portal</h1>
            <div className="p-topbar__meta">
              {meta.projectNumber && (
                <span className="p-pill p-pill--neutral p-ref">{meta.projectNumber}</span>
              )}
              {meta.typeLabel && (
                <>
                  <span aria-hidden className="p-topbar__sep">
                    ·
                  </span>
                  <span className="text-[12px] font-medium text-[color:var(--ink-600)]">
                    {meta.typeLabel}
                  </span>
                </>
              )}
              <span aria-hidden className="p-topbar__sep">
                ·
              </span>
              <StatusChip status={meta.status} />
            </div>
          </div>

          {/* Notifications — static, badge-less, honest. */}
          <button
            type="button"
            className="p-iconbtn hidden sm:grid"
            aria-label="We&rsquo;ll email you about updates"
          >
            <ic.bell />
            <span className="p-tip" role="tooltip">
              We&rsquo;ll email you about updates
            </span>
          </button>

          {/* User chip — the share link's own label, never a fabricated name. */}
          <div ref={userWrapRef} className="relative">
            <button
              type="button"
              className="p-userchip"
              aria-haspopup="dialog"
              aria-expanded={menu === "user"}
              aria-label={hasName ? `Signed in as ${name}` : "Private view"}
              onClick={() => setMenu(menu === "user" ? null : "user")}
            >
              <span className="p-avatar" aria-hidden>
                {hasName ? initials : <ic.account />}
              </span>
              <span className="p-userchip__name hidden sm:block">
                {hasName ? name : "Private view"}
              </span>
              <span className="text-[color:var(--ink-400)]">
                <ic.caret />
              </span>
            </button>
            {menu === "user" && (
              <div
                role="dialog"
                aria-label="Access"
                className="p-menu"
                style={{ right: 0, top: "calc(100% + 8px)" }}
              >
                {AccessPanel}
              </div>
            )}
          </div>
        </header>

        <main id="p-main" className="flex-1">
          <span id="p-top" aria-hidden className="block h-0 scroll-mt-[88px]" />
          {children}
        </main>
      </div>
    </div>
  );
}
