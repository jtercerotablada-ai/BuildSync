"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tab bar shared between the Knowledge hub's two surfaces:
 *  - /knowledge          → Wiki entries (term + definition + tags)
 *  - /knowledge/calculators → Engineering calculators (beam, retaining
 *    wall, load gen, etc.)
 *
 * Active state is derived from the current pathname so both pages can
 * drop the component in without prop drilling.
 */
export function KnowledgeTabs() {
  const pathname = usePathname();
  const isCalculators = pathname.startsWith("/knowledge/calculators");

  const tabs = [
    { href: "/knowledge", label: "Wiki entries", icon: Book, active: !isCalculators },
    {
      href: "/knowledge/calculators",
      label: "Calculators",
      icon: Calculator,
      active: isCalculators,
    },
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex items-center gap-1 px-4 md:px-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab.active
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-black"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
