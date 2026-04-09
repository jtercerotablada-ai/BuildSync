"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  Settings,
  Users,
  Folder,
  FolderOpen,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useRef, useEffect } from "react";

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Team {
  id: string;
  name: string;
  color?: string;
}

interface SidebarProps {
  projects?: Project[];
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
          "flex items-center rounded-lg text-[13px] font-medium transition-colors",
          collapsed
            ? "justify-center h-9 w-9 mx-auto"
            : "gap-2.5 px-3 py-1.5",
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
  projects = [],
  collapsed = false,
  onCreateProject,
  onCreatePortfolio,
  basePath = "",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mainNavItems = getMainNavItems(basePath);
  const insightsNavItems = getInsightsNavItems(basePath);
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
  const projectsDropdownRef = useRef<HTMLDivElement>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams/list");
        if (res.ok) {
          const data = await res.json();
          setTeams(data);
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    }
    if (session) fetchTeams();
  }, [session]);

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
          "flex h-full flex-col border-r border-gray-200/80 bg-[#fafafa] transition-[width] duration-200 ease-out overflow-hidden",
          "max-md:fixed max-md:top-[52px] max-md:bottom-0 max-md:left-0 max-md:z-40 max-md:shadow-xl",
          collapsed
            ? "w-16 max-md:w-0 max-md:border-0"
            : "w-[240px] max-md:w-[280px]"
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

                {/* Projects */}
                {mounted ? (
                  <Collapsible
                    open={projectsOpen}
                    onOpenChange={setProjectsOpen}
                  >
                    <div className="flex items-center justify-between px-3 mb-1">
                      <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform",
                            !projectsOpen && "-rotate-90"
                          )}
                        />
                        Projects
                      </CollapsibleTrigger>
                      <div className="relative" ref={projectsDropdownRef}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() =>
                            setProjectsDropdownOpen(!projectsDropdownOpen)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {projectsDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
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
                    </div>
                    <CollapsibleContent>
                      <nav className="space-y-0.5">
                        {projects.length === 0 ? (
                          <p className="px-3 py-1.5 text-[13px] text-gray-400">
                            No projects yet
                          </p>
                        ) : (
                          projects.map((project) => {
                            const isActive =
                              pathname === `${basePath}/projects/${project.id}`;
                            return (
                              <Link
                                key={project.id}
                                href={`${basePath}/projects/${project.id}`}
                              >
                                <span
                                  className={cn(
                                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                    isActive
                                      ? "bg-gray-200/80 text-gray-900"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                  )}
                                >
                                  <div
                                    className="h-2 w-2 rounded-sm flex-shrink-0"
                                    style={{
                                      backgroundColor: project.color,
                                    }}
                                  />
                                  <span className="truncate">
                                    {project.name}
                                  </span>
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </nav>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Projects
                  </div>
                )}

                <div className="h-5" />

                {/* Teams */}
                {mounted ? (
                  <Collapsible open={teamsOpen} onOpenChange={setTeamsOpen}>
                    <div className="flex items-center justify-between px-3 mb-1">
                      <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform",
                            !teamsOpen && "-rotate-90"
                          )}
                        />
                        Teams
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => router.push(`${basePath || ""}/teams/new`)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <nav className="space-y-0.5">
                        {teams.length === 0 ? (
                          <p className="px-3 py-1.5 text-[13px] text-gray-400">
                            No teams yet
                          </p>
                        ) : (
                          teams.map((team) => {
                            const isActive =
                              pathname === `${basePath}/teams/${team.id}`;
                            return (
                              <Link
                                key={team.id}
                                href={`${basePath}/teams/${team.id}`}
                              >
                                <span
                                  className={cn(
                                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                    isActive
                                      ? "bg-gray-200/80 text-gray-900"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                  )}
                                >
                                  <div
                                    className="h-4 w-4 rounded flex items-center justify-center"
                                    style={{
                                      backgroundColor:
                                        team.color || "#6366F1",
                                    }}
                                  >
                                    <Users className="h-2.5 w-2.5 text-white" />
                                  </div>
                                  <span className="truncate">
                                    {team.name}
                                  </span>
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </nav>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Teams
                  </div>
                )}
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
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
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
