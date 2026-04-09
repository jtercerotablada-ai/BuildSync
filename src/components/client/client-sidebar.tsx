"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  MessageSquare,
  CheckCircle,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    href: "/client/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/client/projects",
    label: "My Projects",
    icon: FolderKanban,
  },
  {
    href: "/client/documents",
    label: "Documents",
    icon: FileText,
  },
  {
    href: "/client/messages",
    label: "Messages",
    icon: MessageSquare,
  },
  {
    href: "/client/approvals",
    label: "Approvals",
    icon: CheckCircle,
  },
  {
    href: "/client/settings",
    label: "Settings",
    icon: Settings,
  },
];

interface ClientSidebarProps {
  onClose: () => void;
}

export function ClientSidebar({ onClose }: ClientSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col bg-[#111111] border-r border-white/10">
      {/* Logo header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <Link href="/client/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c9a84c]">
            <span className="text-sm font-bold text-black">TTC</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white tracking-wide" style={{ fontFamily: "Playfair Display, serif" }}>
              TTC Civil
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">
              Client Portal
            </p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/50 hover:text-white hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/client/dashboard" &&
              pathname.startsWith(item.href + "/"));

          return (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0",
                    isActive ? "text-[#c9a84c]" : ""
                  )}
                />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c9a84c]" />
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">
          TT Civil & Structural
        </p>
      </div>
    </aside>
  );
}
