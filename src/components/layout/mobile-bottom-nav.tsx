'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, CheckSquare, Inbox, Menu, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onCreateTask?: () => void;
  onToggleSidebar?: () => void;
  basePath?: string;
}

export function MobileBottomNav({ onCreateTask, onToggleSidebar, basePath = '' }: MobileBottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-lg border-t border-gray-200/80" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {/* Home */}
        <Link href={`${basePath}/home`} className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1">
          <Home className={cn("h-5 w-5 transition-colors", isActive(`${basePath}/home`) ? "text-[#c9a84c]" : "text-gray-400")} />
          <span className={cn("text-[10px] font-medium transition-colors", isActive(`${basePath}/home`) ? "text-[#c9a84c]" : "text-gray-400")}>Home</span>
        </Link>

        {/* My Tasks */}
        <Link href={`${basePath}/my-tasks`} className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1">
          <CheckSquare className={cn("h-5 w-5 transition-colors", isActive(`${basePath}/my-tasks`) ? "text-[#c9a84c]" : "text-gray-400")} />
          <span className={cn("text-[10px] font-medium transition-colors", isActive(`${basePath}/my-tasks`) ? "text-[#c9a84c]" : "text-gray-400")}>Tasks</span>
        </Link>

        {/* CREATE — Central elevated button */}
        <button
          onClick={onCreateTask}
          className="flex items-center justify-center -mt-5 h-12 w-12 rounded-full bg-[#c9a84c] text-white shadow-lg shadow-[#c9a84c]/30 active:scale-95 transition-transform"
          aria-label="Create task"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>

        {/* Inbox */}
        <Link href={`${basePath}/inbox`} className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1">
          <Inbox className={cn("h-5 w-5 transition-colors", isActive(`${basePath}/inbox`) ? "text-[#c9a84c]" : "text-gray-400")} />
          <span className={cn("text-[10px] font-medium transition-colors", isActive(`${basePath}/inbox`) ? "text-[#c9a84c]" : "text-gray-400")}>Inbox</span>
        </Link>

        {/* More (opens sidebar) */}
        <button onClick={onToggleSidebar} className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1">
          <Menu className="h-5 w-5 text-gray-400" />
          <span className="text-[10px] font-medium text-gray-400">More</span>
        </button>
      </div>
    </nav>
  );
}
