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
import { Search, Plus, Bell, HelpCircle, Settings, LogOut, User, CheckSquare, FolderKanban, Briefcase, Target, Sparkles, Menu } from "lucide-react";
import { useAIPanel } from "@/contexts/ai-panel-context";
import { toast } from "sonner";
import Link from "next/link";

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

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <header
      className="flex items-center border-b border-gray-200 bg-white"
      style={{ height: "var(--topbar-h, 52px)", padding: "0 12px" }}
    >
      {/* ─── LEFT cluster: hamburger + Create ─── */}
      <div className="flex items-center gap-2.5 min-w-[148px]">
        <button
          type="button"
          aria-label="Alternar barra lateral"
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black text-white text-[13px] font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Crear
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onCreateTask} className="cursor-pointer">
              <CheckSquare className="mr-2 h-4 w-4 text-gray-500" />
              Tarea
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateProject} className="cursor-pointer">
              <FolderKanban className="mr-2 h-4 w-4 text-gray-500" />
              Proyecto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreatePortfolio} className="cursor-pointer">
              <Briefcase className="mr-2 h-4 w-4 text-gray-500" />
              Portafolio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateGoal} className="cursor-pointer">
              <Target className="mr-2 h-4 w-4 text-gray-500" />
              Objetivo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ─── CENTER: Search capsule ─── */}
      <div className="flex-1 flex justify-center px-4">
        <button
          type="button"
          onClick={onSearchOpen}
          className="group relative flex items-center rounded-full transition-colors"
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
          <span className="ml-2.5 text-[14px] text-gray-400 leading-none select-none">Buscar</span>
        </button>
      </div>

      {/* ─── RIGHT cluster: icon buttons + avatar ─── */}
      <div className="flex items-center gap-1.5 min-w-[148px] justify-end">
        <button
          type="button"
          onClick={openPanel}
          className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-orange-50 transition-colors"
        >
          <Sparkles className="h-[18px] w-[18px]" style={{ color: "#D97757" }} />
        </button>

        <button
          type="button"
          onClick={() => toast.info("Notificaciones próximamente")}
          className="flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => toast.info("Centro de ayuda próximamente")}
          className="flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
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
              <Link href="/settings" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
