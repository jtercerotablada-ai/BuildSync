"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  CheckSquare,
  Inbox,
  BarChart3,
  Briefcase,
  Target,
  Plus,
  ChevronDown,
  Hash,
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
  onCreateProject?: () => void;
  onCreatePortfolio?: () => void;
}

const mainNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/my-tasks", label: "My tasks", icon: CheckSquare },
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

const insightsNavItems = [
  { href: "/reporting", label: "Reporting", icon: BarChart3 },
  { href: "/portfolios", label: "Portfolios", icon: Briefcase },
  { href: "/goals", label: "Goals", icon: Target },
];

export function Sidebar({ projects = [], onCreateProject, onCreatePortfolio }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
  const projectsDropdownRef = useRef<HTMLDivElement>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  // Prevent hydration mismatch with Radix components
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch teams
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams/list');
        if (res.ok) {
          const data = await res.json();
          setTeams(data);
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      }
    }
    if (session) fetchTeams();
  }, [session]);

  // Close dropdown when clicking outside
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <aside className="flex h-full w-[240px] flex-col border-r bg-white">
      {/* Logo & User */}
      <div className="flex items-center gap-2 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black text-white font-semibold text-sm">
          <span>B<span className="text-xs">s</span><span className="text-[8px] ml-[1px]">.</span></span>
        </div>
        <span className="font-semibold text-black">BuildSync</span>
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Main Navigation */}
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-black text-white"
                      : "text-black hover:bg-black hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-4" />

        {/* Insights */}
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-black">
          Insights
        </div>
        <nav className="space-y-1">
          {insightsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-black text-white"
                      : "text-black hover:bg-black hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-4" />

        {/* Projects */}
        {mounted ? (
        <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
          <div className="flex items-center justify-between px-3 mb-2">
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-black hover:text-white">
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
                onClick={() => setProjectsDropdownOpen(!projectsDropdownOpen)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              {projectsDropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-black hover:bg-black hover:text-white"
                    onClick={() => {
                      setProjectsDropdownOpen(false);
                      onCreateProject?.();
                    }}
                  >
                    <Folder className="w-4 h-4 text-black" />
                    New project
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-black hover:bg-black hover:text-white"
                    onClick={() => {
                      setProjectsDropdownOpen(false);
                      onCreatePortfolio?.();
                    }}
                  >
                    <FolderOpen className="w-4 h-4 text-black" />
                    New portfolio
                  </button>
                </div>
              )}
            </div>
          </div>
          <CollapsibleContent>
            <nav className="space-y-1">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-black">
                  No projects yet
                </p>
              ) : (
                projects.map((project) => {
                  const isActive = pathname === `/projects/${project.id}`;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-slate-200 text-slate-900"
                            : "text-black hover:bg-black hover:text-white hover:text-white"
                        )}
                      >
                        <div
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="truncate">{project.name}</span>
                      </span>
                    </Link>
                  );
                })
              )}
            </nav>
          </CollapsibleContent>
        </Collapsible>
        ) : (
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-black">
            Projects
          </div>
        )}

        <Separator className="my-4" />

        {/* Teams */}
        {mounted ? (
        <Collapsible open={teamsOpen} onOpenChange={setTeamsOpen}>
          <div className="flex items-center justify-between px-3 mb-2">
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-black hover:text-white">
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
              onClick={() => router.push('/teams/new')}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <CollapsibleContent>
            <nav className="space-y-1">
              {teams.length === 0 ? (
                <p className="px-3 py-2 text-sm text-black">
                  No teams yet
                </p>
              ) : (
                teams.map((team) => {
                  const isActive = pathname === `/teams/${team.id}`;
                  return (
                    <Link key={team.id} href={`/teams/${team.id}`}>
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-slate-200 text-slate-900"
                            : "text-black hover:bg-black hover:text-white"
                        )}
                      >
                        <div
                          className="h-4 w-4 rounded flex items-center justify-center"
                          style={{ backgroundColor: team.color || '#6366F1' }}
                        >
                          <Users className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="truncate">{team.name}</span>
                      </span>
                    </Link>
                  );
                })
              )}
            </nav>
          </CollapsibleContent>
        </Collapsible>
        ) : (
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-black">
            Teams
          </div>
        )}
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="border-t p-2">
        <Link href="/settings">
          <span className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-black hover:bg-black hover:text-white hover:text-white">
            <Settings className="h-4 w-4" />
            Settings
          </span>
        </Link>
      </div>
    </aside>
  );
}
