"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Home,
  CheckSquare,
  Inbox,
  BarChart3,
  Briefcase,
  Target,
  Plus,
  Settings,
  Users,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
  collapsed?: boolean;
  onCreateProject?: () => void;
  onCreatePortfolio?: () => void;
  basePath?: string;
}

function getMainNavItems(basePath: string) {
  return [
    { href: `${basePath}/home`, label: "Home", icon: Home },
    { href: `${basePath}/my-tasks`, label: "My Tasks", icon: CheckSquare },
    { href: `${basePath}/inbox`, label: "Inbox", icon: Inbox },
  ];
}

function getInsightsNavItems(basePath: string) {
  return [
    { href: `${basePath}/reporting`, label: "Reporting", icon: BarChart3 },
    { href: `${basePath}/portfolios`, label: "Portfolios", icon: Briefcase },
    { href: `${basePath}/goals`, label: "Goals", icon: Target },
  ];
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
}) {
  const inner = (
    <Link href={href}>
      <span
        className={cn(
          "flex items-center rounded-lg text-xs md:text-[13px] font-medium transition-colors",
          collapsed
            ? "justify-center h-9 w-9 mx-auto"
            : "gap-2.5 px-2 md:px-3 py-1.5",
          isActive
            ? "bg-gray-200/80 text-gray-900"
            : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
        )}
      >
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        {!collapsed && label}
      </span>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="bg-[#111827] text-white text-[12px] rounded-lg px-2.5 py-1.5 shadow-md border-0"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

export function Sidebar({
  collapsed = false,
  onCreateProject,
  onCreatePortfolio,
  basePath = "",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mainNavItems = getMainNavItems(basePath);
  const insightsNavItems = getInsightsNavItems(basePath);
  // Session no longer needed at this layer (was fetching teams for
  // the inline list which has been removed).
  // The "+ New project / New portfolio" menu still uses these.
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
  const projectsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        projectsDropdownRef.current &&
        !projectsDropdownRef.current.contains(event.target as Node)
      ) {
        setProjectsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "flex h-full flex-col border-r border-gray-200/80 bg-[#fafafa] transition-all duration-200 ease-out overflow-hidden",
          "max-md:fixed max-md:top-0 max-md:bottom-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl max-md:pt-14",
          collapsed
            ? "w-16 max-md:w-0 max-md:border-0 max-md:opacity-0 max-md:pointer-events-none"
            : "w-[240px] max-md:w-[270px] max-md:opacity-100"
        )}
      >
        <ScrollArea className="flex-1 pt-2" style={{ paddingLeft: collapsed ? 0 : undefined, paddingRight: collapsed ? 0 : undefined }}>
          <div className={collapsed ? "px-[10px]" : "px-2"}>
            {/* Main Navigation */}
            <nav className="space-y-0.5">
              {mainNavItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href || (!item.href.endsWith('/home') && pathname.startsWith(item.href + '/'))}
                  collapsed={collapsed}
                />
              ))}
            </nav>

            <div className="h-5" />

            {/* Insights */}
            {!collapsed && (
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Insights
              </div>
            )}
            <nav className="space-y-0.5">
              {insightsNavItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href || (!item.href.endsWith('/home') && pathname.startsWith(item.href + '/'))}
                  collapsed={collapsed}
                />
              ))}
            </nav>

            {/* Collapsed mode: stop here (no Projects/Teams lists) */}
            {!collapsed && (
              <>
                <div className="h-5" />

                {/* Projects — single nav button to the all-projects
                    page. The previous design had a collapsible list of
                    every individual project inline; Juan wanted just one
                    "Projects" button that opens the full overview
                    (list / grid / gantt). The + still spawns the
                    New project / New portfolio menu. */}
                <div className="relative" ref={projectsDropdownRef}>
                  <NavItem
                    href={`${basePath || ""}/projects/all`}
                    label="Projects"
                    icon={Folder}
                    isActive={
                      pathname === `${basePath}/projects/all` ||
                      pathname.startsWith(`${basePath}/projects/`)
                    }
                    collapsed={collapsed}
                  />
                  <button
                    type="button"
                    aria-label="Add project or portfolio"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectsDropdownOpen(!projectsDropdownOpen);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md bg-white border border-gray-300 text-black shadow-sm hover:bg-gray-100 hover:border-gray-400 transition-colors z-10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  {projectsDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setProjectsDropdownOpen(false);
                          onCreateProject?.();
                        }}
                      >
                        <Folder className="w-4 h-4 text-gray-500" />
                        New project
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setProjectsDropdownOpen(false);
                          onCreatePortfolio?.();
                        }}
                      >
                        <FolderOpen className="w-4 h-4 text-gray-500" />
                        New portfolio
                      </button>
                    </div>
                  )}
                </div>

                {/* Teams — same single-button pattern as Projects. */}
                <div className="relative">
                  <NavItem
                    href={`${basePath || ""}/teams`}
                    label="Teams"
                    icon={Users}
                    isActive={
                      pathname === `${basePath}/teams` ||
                      pathname.startsWith(`${basePath}/teams/`)
                    }
                    collapsed={collapsed}
                  />
                  <button
                    type="button"
                    aria-label="Create team"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`${basePath || ""}/teams/new`);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md bg-white border border-gray-300 text-black shadow-sm hover:bg-gray-100 hover:border-gray-400 transition-colors z-10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Actions — Settings */}
        <div className="border-t border-gray-200/80 p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`${basePath}/settings`}>
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-lg h-9 w-9 mx-auto transition-colors",
                      pathname === `${basePath}/settings`
                        ? "bg-gray-200/80 text-gray-900"
                        : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
                    )}
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="bg-[#111827] text-white text-[12px] rounded-lg px-2.5 py-1.5 shadow-md border-0"
              >
                Settings
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href={`${basePath}/settings`}>
              <span
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 md:px-3 py-2 md:py-1.5 text-xs md:text-[13px] font-medium transition-colors",
                  pathname === `${basePath}/settings`
                    ? "bg-gray-200/80 text-gray-900"
                    : "text-gray-600 hover:bg-black/[0.04] hover:text-gray-900"
                )}
              >
                <Settings className="h-[18px] w-[18px]" />
                Settings
              </span>
            </Link>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
