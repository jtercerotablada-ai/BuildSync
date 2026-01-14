"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Star,
  Users,
  LayoutGrid,
  MessageSquare,
  Calendar,
  BookOpen,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InviteTeamModal } from "./invite-team-modal";

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface TeamHeaderProps {
  team: {
    id: string;
    name: string;
    avatar?: string | null;
    members?: TeamMember[];
  };
  activeTab: "overview" | "members" | "work" | "messages" | "calendar" | "knowledge";
}

export function TeamHeader({ team, activeTab }: TeamHeaderProps) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  const tabs = [
    { id: "overview", label: "Resumen", icon: LayoutGrid, href: `/teams/${team.id}` },
    { id: "members", label: "Miembros", icon: Users, href: `/teams/${team.id}/members` },
    { id: "work", label: "Todo el trabajo", icon: LayoutGrid, href: `/teams/${team.id}/work` },
    { id: "messages", label: "Mensajes", icon: MessageSquare, href: `/teams/${team.id}/messages` },
    { id: "calendar", label: "Calendario", icon: Calendar, href: `/teams/${team.id}/calendar` },
    { id: "knowledge", label: "Conocimientos", icon: BookOpen, href: `/teams/${team.id}/knowledge` },
  ];

  const memberCount = team.members?.length || 0;

  return (
    <>
      <div className="bg-white border-b sticky top-0 z-10">
        {/* Top row: Team name + actions */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              {team.avatar ? (
                <img src={team.avatar} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span className="text-sm font-medium text-purple-700">
                  {team.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Team name dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-base font-semibold hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                  {team.name}
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Editar equipo
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar equipo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Star button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isStarred && "text-yellow-500")}
              onClick={() => setIsStarred(!isStarred)}
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-current")} />
            </Button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Member avatars preview */}
            <div className="flex -space-x-2">
              {team.members?.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                    {member.user.name?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {memberCount > 3 && (
                <div className="h-8 w-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{memberCount - 3}</span>
                </div>
              )}
            </div>

            {/* Invite button */}
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => setShowInviteModal(true)}
            >
              <Users className="h-4 w-4" />
              Invitar
            </Button>
          </div>
        </div>

        {/* Tabs row */}
        <div className="px-6 flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

          {/* Add tab button */}
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteTeamModal
        teamId={team.id}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </>
  );
}
