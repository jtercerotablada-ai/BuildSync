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
import { Search, Plus, Bell, HelpCircle, Settings, LogOut, User, CheckSquare, FolderKanban, Briefcase, Target } from "lucide-react";

interface HeaderProps {
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onCreatePortfolio?: () => void;
  onCreateGoal?: () => void;
}

export function Header({ onCreateTask, onCreateProject, onCreatePortfolio, onCreateGoal }: HeaderProps) {
  const { data: session } = useSession();

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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="gap-2 bg-slate-900 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onCreateTask} className="cursor-pointer">
              <CheckSquare className="mr-2 h-4 w-4 text-blue-500" />
              Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateProject} className="cursor-pointer">
              <FolderKanban className="mr-2 h-4 w-4 text-green-500" />
              Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreatePortfolio} className="cursor-pointer">
              <Briefcase className="mr-2 h-4 w-4 text-purple-500" />
              Portfolio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateGoal} className="cursor-pointer">
              <Target className="mr-2 h-4 w-4 text-orange-500" />
              Goal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="text-slate-600">
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="text-slate-600">
          <HelpCircle className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-slate-900 text-white text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{session?.user?.name}</span>
                <span className="text-xs font-normal text-slate-500">
                  {session?.user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
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
