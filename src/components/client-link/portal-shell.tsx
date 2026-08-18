"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Home,
  ListChecks,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  SearchCheck,
  ShieldQuestion,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { company } from "@/lib/ttc/site";

/**
 * The app shell around the client project workspace: a fixed 283px enterprise
 * navigation rail and a thin 60px global toolbar, with the server-rendered
 * workspace passed as children.
 *
 * IMPORTANT — this is chrome, not auth. A password-less link knows exactly one
 * project and one identity (the link's own label), so:
 *   • sidebar items are hash links into the workspace TABS (#overview,
 *     #action-items, …) — the tab strip owns the state, the rail follows it;
 *   • the project selector shows the one project this link opens and says so,
 *     rather than pretending to be a switcher;
 *   • the "user" is the share link's label (e.g. "Board president") — no
 *     fabricated name, no fabricated notification count, ever.
 *
 * All values arrive already resolved and client-safe; this fetches nothing.
 */

export interface PortalViewer {
  /** The share link's label, already resolved by the route. May be empty. */
  label: string | null;
}

export interface PortalProjectRef {
  number: string | null;
  name: string;
}

/** First-two-word (or first-two-letter) initials. Empty when there is no name. */
function initialsFrom(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Which rail item lights up for each workspace tab. Inside a project the
 *  rail highlights "Projects" for the project-level tabs, per the reference. */
const RAIL_FOR_TAB: Record<string, string> = {
  overview: "projects",
  progress: "projects",
  activity: "projects",
  "action-items": "tasks",
  documents: "documents",
  inspections: "inspections",
};

const NAV: { key: string; label: string; hash: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", hash: "overview", icon: Home },
  { key: "projects", label: "Projects", hash: "overview", icon: Briefcase },
  { key: "tasks", label: "Tasks", hash: "action-items", icon: ListChecks },
  { key: "documents", label: "Documents", hash: "documents", icon: FileText },
];

export function PortalShell({
  viewer,
  project,
  contactEmail,
  children,
}: {
  viewer: PortalViewer;
  project: PortalProjectRef;
  contactEmail: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rail, setRail] = useState("projects");
  const [menu, setMenu] = useState<null | "user" | "account" | "help" | "crumb">(null);
  const userWrapRef = useRef<HTMLDivElement>(null);
  const accountWrapRef = useRef<HTMLDivElement>(null);
  const helpWrapRef = useRef<HTMLDivElement>(null);
  const crumbWrapRef = useRef<HTMLDivElement>(null);

  const name = viewer.label?.trim() || "";
  const initials = initialsFrom(name);
  const hasName = initials.length > 0;

  // Follow the tab strip: the hash is the single source of truth.
  useEffect(() => {
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, "");
      setRail(RAIL_FOR_TAB[raw] ?? "projects");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const goTab = useCallback((hash: string) => {
    setDrawerOpen(false);
    // Assign (don't replace) so the hashchange event fires for the tab strip.
    window.location.hash = hash;
    window.scrollTo({ top: 0, behavior: "auto" });
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
    const wraps = [userWrapRef, accountWrapRef, helpWrapRef, crumbWrapRef];
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wraps.some((w) => w.current?.contains(t))) return;
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
          {hasName ? initials : <User size={16} strokeWidth={1.8} />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[color:var(--ink-900)]">
            {hasName ? name : "Private view"}
          </p>
          <p className="text-[11px] text-[color:var(--ink-500)]">Private project link</p>
        </div>
      </div>
      <div className="my-3 h-px bg-[color:var(--line-soft)]" />
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[color:var(--ink-600)]">
        <span className="mt-0.5 shrink-0 text-[color:var(--gold)]">
          <Lock size={14} strokeWidth={1.8} aria-hidden />
        </span>
        <span>This link is private to you. Please don&rsquo;t forward it.</span>
      </p>
      <a
        href={`mailto:${contactEmail}`}
        className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[12px] font-semibold text-[color:var(--gold)] transition-colors hover:bg-[color:var(--gold-pale)]"
      >
        <Mail size={14} strokeWidth={1.8} aria-hidden />
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
        aria-label="Portal navigation"
      >
        <div className="p-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ttc/img/logo-square.png"
            alt=""
            width={62}
            height={62}
            className="p-brand__logo"
          />
          <div className="min-w-0 pt-0.5">
            <p className="p-brand__full">{company.name}</p>
            <p className="p-brand__name">{company.shortName}</p>
            <p className="p-brand__disc">{company.discipline}</p>
          </div>
          <button
            type="button"
            className="p-iconbtn p-drawer-close ml-auto"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={19} strokeWidth={1.8} />
          </button>
        </div>

        <nav className="p-nav" aria-label="Sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = rail === item.key;
            return (
              <a
                key={item.key}
                href={`#${item.hash}`}
                aria-current={isActive ? "page" : undefined}
                className={`p-nav-item ${isActive ? "p-nav-item--active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  goTab(item.hash);
                }}
              >
                <Icon size={19} strokeWidth={1.7} aria-hidden />
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
            <MessageSquare size={19} strokeWidth={1.7} aria-hidden />
            Messages
            <span className="p-nav-item__soon">Soon</span>
          </span>

          <a
            href="#inspections"
            aria-current={rail === "inspections" ? "page" : undefined}
            className={`p-nav-item ${rail === "inspections" ? "p-nav-item--active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              goTab("inspections");
            }}
          >
            <SearchCheck size={19} strokeWidth={1.7} aria-hidden />
            Inspections
          </a>

          <div className="p-nav__divider" />

          <div ref={accountWrapRef} className="relative">
            <button
              type="button"
              className={`p-nav-item ${menu === "account" ? "p-nav-item--active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={menu === "account"}
              onClick={() => setMenu(menu === "account" ? null : "account")}
            >
              <User size={19} strokeWidth={1.7} aria-hidden />
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

        {/* Support card — the honest version: email is the help center. */}
        <div className="p-side-foot">
          <a href={`mailto:${contactEmail}`} className="p-help">
            <span className="p-help__icon" aria-hidden>
              <ShieldQuestion size={19} strokeWidth={1.7} />
            </span>
            <span className="min-w-0">
              <span className="p-help__title block">Need help?</span>
              <span className="p-help__copy block">
                Questions about this project? Contact our team.
              </span>
            </span>
            <ArrowRight size={16} strokeWidth={1.8} className="p-help__arrow" aria-hidden />
          </a>
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
            <Menu size={20} strokeWidth={1.8} />
          </button>

          <p className="p-topbar__title">Client Portal</p>

          {/* Project control — one project per link, and it says so. */}
          <div ref={crumbWrapRef} className="relative min-w-0">
            <button
              type="button"
              className="p-crumb"
              aria-haspopup="dialog"
              aria-expanded={menu === "crumb"}
              onClick={() => setMenu(menu === "crumb" ? null : "crumb")}
            >
              <CalendarDays size={14} strokeWidth={1.8} aria-hidden />
              {project.number && <span className="p-crumb__num">{project.number}</span>}
              <ChevronRight size={13} strokeWidth={2} className="p-crumb__sep" aria-hidden />
              <span className="p-crumb__name">{project.name}</span>
              <ChevronDown size={14} strokeWidth={1.8} className="p-crumb__caret" aria-hidden />
            </button>
            {menu === "crumb" && (
              <div
                role="dialog"
                aria-label="Projects on this link"
                className="p-menu"
                style={{ left: 0, top: "calc(100% + 8px)", minWidth: 300 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[color:var(--ink-400)]">
                  Your projects
                </p>
                <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-[color:var(--gold-pale)] px-3 py-2.5">
                  <Check size={15} strokeWidth={2.2} className="shrink-0 text-[color:var(--gold)]" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[color:var(--ink-900)]">
                      {project.name}
                    </span>
                    {project.number && (
                      <span className="block text-[11px] text-[color:var(--ink-500)]">
                        {project.number}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-[color:var(--ink-500)]">
                  This private link opens this project only.
                </p>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Notifications — badge-less and honest: updates arrive by email. */}
          <button
            type="button"
            className="p-iconbtn hidden sm:grid"
            aria-label="We&rsquo;ll email you about updates"
          >
            <Bell size={19} strokeWidth={1.7} />
            <span className="p-tip" role="tooltip">
              We&rsquo;ll email you about updates
            </span>
          </button>

          <div ref={helpWrapRef} className="relative hidden sm:block">
            <button
              type="button"
              className="p-iconbtn"
              aria-haspopup="dialog"
              aria-expanded={menu === "help"}
              aria-label="Help"
              onClick={() => setMenu(menu === "help" ? null : "help")}
            >
              <HelpCircle size={19} strokeWidth={1.7} />
            </button>
            {menu === "help" && (
              <div
                role="dialog"
                aria-label="Help"
                className="p-menu"
                style={{ right: 0, top: "calc(100% + 8px)" }}
              >
                <p className="text-[13px] font-semibold text-[color:var(--ink-900)]">Need help?</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--ink-500)]">
                  Our team answers questions about this project directly.
                </p>
                <a
                  href={`mailto:${contactEmail}`}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-3 py-2 text-[12px] font-semibold text-[color:var(--gold)] transition-colors hover:bg-[color:var(--gold-pale)]"
                >
                  <Mail size={14} strokeWidth={1.8} aria-hidden />
                  <span className="truncate">{contactEmail}</span>
                </a>
              </div>
            )}
          </div>

          {/* User chip — the share link's own label, never a fabricated name. */}
          <div ref={userWrapRef} className="relative">
            <button
              type="button"
              className="p-userchip"
              aria-haspopup="dialog"
              aria-expanded={menu === "user"}
              aria-label={hasName ? `Viewing as ${name}` : "Private view"}
              onClick={() => setMenu(menu === "user" ? null : "user")}
            >
              <span className="p-avatar" aria-hidden>
                {hasName ? initials : <User size={16} strokeWidth={1.8} />}
              </span>
              <span className="p-userchip__name hidden md:block">
                {hasName ? name : "Private view"}
              </span>
              <ChevronDown size={15} strokeWidth={1.8} className="text-[color:var(--ink-400)]" aria-hidden />
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
          {children}
        </main>
      </div>
    </div>
  );
}
