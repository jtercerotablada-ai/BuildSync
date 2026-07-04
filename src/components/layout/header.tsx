"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, Bell, HelpCircle, Settings, LogOut, User, CheckSquare, FolderKanban, Briefcase, Target, Sparkles, Menu, MessageSquare, UserPlus } from "lucide-react";
import { useAIPanel } from "@/contexts/ai-panel-context";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HeaderProps {
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onCreatePortfolio?: () => void;
  onCreateGoal?: () => void;
  onSearchOpen?: () => void;
  onToggleSidebar?: () => void;
}

export function Header({ onCreateTask, onCreateProject, onCreatePortfolio, onCreateGoal, onSearchOpen, onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const { openPanel } = useAIPanel();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchUnread = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        // unreadCount is independent of limit, so fetch a single row
        // instead of the default page of 30 just to read the count.
        const res = await fetch("/api/notifications?archived=false&limit=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore transient network errors
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    // Refresh immediately when the tab regains focus so the badge is
    // current the moment the user returns, instead of waiting up to 30s.
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) fetchUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <header
      className="flex items-center border-b border-gray-200 bg-white h-12 md:h-[52px]"
      style={{ padding: "0 12px" }}
    >
      {/* ─── LEFT cluster: hamburger + Create ─── */}
      <div className="flex items-center gap-2.5 w-[100px] md:w-auto md:min-w-[148px]">
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black text-white text-[13px] font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onCreateTask} className="cursor-pointer">
              <CheckSquare className="mr-2 h-4 w-4 text-gray-500" />
              Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateProject} className="cursor-pointer">
              <FolderKanban className="mr-2 h-4 w-4 text-gray-500" />
              Project
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("Messages coming soon — use the Messages tab inside a project for now")}
              className="cursor-pointer"
            >
              <MessageSquare className="mr-2 h-4 w-4 text-gray-500" />
              Message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreatePortfolio} className="cursor-pointer">
              <Briefcase className="mr-2 h-4 w-4 text-gray-500" />
              Portfolio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateGoal} className="cursor-pointer">
              <Target className="mr-2 h-4 w-4 text-gray-500" />
              Goal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/team?invite=true")}
              className="cursor-pointer"
            >
              <UserPlus className="mr-2 h-4 w-4 text-gray-500" />
              Invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ─── CENTER: Desktop search bar / Mobile logo ─── */}
      <div className="flex-1 flex justify-center px-4">
        {/* Desktop search */}
        <button
          type="button"
          onClick={onSearchOpen}
          className="hidden md:flex group relative items-center rounded-full transition-colors"
          style={{
            height: "var(--search-h, 36px)",
            width: "min(720px, 56vw)",
            backgroundColor: "var(--search-bg, #f1f2f4)",
            border: "none",
            paddingLeft: 14,
            paddingRight: 14,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--search-bg-hover, #e8e9eb)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--search-bg, #f1f2f4)"; }}
        >
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="ml-2.5 text-[14px] text-gray-400 leading-none select-none">Search</span>
        </button>
        {/* Mobile: TT logo centered */}
        <img src="/ttc/img/logo-icon-dark.svg" alt="TT" className="h-7 w-7 md:hidden" />
      </div>

      {/* ─── RIGHT cluster: icon buttons + avatar ─── */}
      <div className="flex items-center gap-1.5 w-[100px] md:w-auto md:min-w-[148px] justify-end">
        {/* Mobile search icon */}
        <button
          type="button"
          onClick={onSearchOpen}
          className="md:hidden flex items-center justify-center h-9 w-9 rounded-full text-gray-500 hover:bg-gray-100"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={openPanel}
          className="hidden md:flex items-center justify-center h-8 w-8 rounded-md hover:bg-[#a8893a]/10 transition-colors"
        >
          <Sparkles className="h-[18px] w-[18px]" style={{ color: "#D97757" }} />
        </button>

        <Link
          href="/inbox"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#a8893a] px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={() => toast.info("Help center coming soon")}
          className="hidden md:flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center h-8 w-8 rounded-full ml-0.5 hover:opacity-80 transition-opacity">
              <Avatar className="h-7 w-7">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-black text-white text-[10px] font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm">{session?.user?.name}</span>
                <span className="text-xs font-normal text-gray-500">
                  {session?.user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-black"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
