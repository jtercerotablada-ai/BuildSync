"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, Bell, HelpCircle, Settings, LogOut, User, CheckSquare, FolderKanban, Briefcase, Target, Sparkles } from "lucide-react";
import { useAIPanel } from "@/contexts/ai-panel-context";
import { toast } from "sonner";
import Link from "next/link";

interface HeaderProps {
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onCreatePortfolio?: () => void;
  onCreateGoal?: () => void;
}

export function Header({ onCreateTask, onCreateProject, onCreatePortfolio, onCreateGoal }: HeaderProps) {
  const { data: session } = useSession();
  const { openPanel } = useAIPanel();

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <header className="flex h-14 items-center border-b bg-white px-4">
      {/* Left spacer */}
      <div className="flex-1" />

      {/* Center - Search */}
      <div className="flex-1 flex justify-center max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 bg-white border-black focus:bg-white"
          />
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="gap-2 bg-black hover:bg-black"
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onCreateTask} className="cursor-pointer">
              <CheckSquare className="mr-2 h-4 w-4 text-black" />
              Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateProject} className="cursor-pointer">
              <FolderKanban className="mr-2 h-4 w-4 text-black" />
              Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreatePortfolio} className="cursor-pointer">
              <Briefcase className="mr-2 h-4 w-4 text-black" />
              Portfolio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateGoal} className="cursor-pointer">
              <Target className="mr-2 h-4 w-4 text-black" />
              Goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI Button */}
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-orange-50"
          onClick={openPanel}
        >
          <Sparkles className="h-5 w-5" style={{ color: '#D97757' }} />
        </Button>

        <Button variant="ghost" size="icon" className="text-black" onClick={() => toast.info("Notifications coming soon")}>
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="text-black" onClick={() => toast.info("Help center coming soon")}>
          <HelpCircle className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-black text-white text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{session?.user?.name}</span>
                <span className="text-xs font-normal text-black">
                  {session?.user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
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
