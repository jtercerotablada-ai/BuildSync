"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, FileText, Briefcase, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkItem {
  id: string;
  name: string;
  type: "project" | "portfolio" | "template";
  color?: string;
  icon?: string;
}

interface TeamWorkSectionProps {
  teamId: string;
}

const typeIcons = {
  project: FolderKanban,
  portfolio: Briefcase,
  template: FileText,
};

const typeColors = {
  project: "bg-green-500",
  portfolio: "bg-purple-500",
  template: "bg-blue-500",
};

export function TeamWorkSection({ teamId }: TeamWorkSectionProps) {
  const router = useRouter();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWork() {
      try {
        const res = await fetch(`/api/teams/${teamId}/work`);
        if (res.ok) {
          const data = await res.json();
          setWorkItems(data);
        }
      } catch (error) {
        console.error("Error fetching team work:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWork();
  }, [teamId]);

  return (
    <div className="bg-white border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Seleccion de trabajo</h3>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => router.push(`/teams/${teamId}/work`)}
        >
          Ver todo el trabajo
        </button>
      </div>

      {/* Work items list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : workItems.length > 0 ? (
        <div className="space-y-2">
          {workItems.map((item) => {
            const Icon = typeIcons[item.type];
            const colorClass = item.color || typeColors[item.type];

            return (
              <button
                key={item.id}
                onClick={() => router.push(`/${item.type}s/${item.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded flex items-center justify-center",
                    colorClass
                  )}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-8">
          {/* Placeholder skeleton items */}
          <div className="space-y-3 mb-6 opacity-30">
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-green-200 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 bg-blue-200 rounded" />
              <div className="flex-1 h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Organiza enlaces a trabajos importantes, como portafolios, proyectos,
            plantillas, etc., para que los miembros de tu equipo los encuentren
            facilmente.
          </p>

          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar trabajo
          </Button>
        </div>
      )}
    </div>
  );
}
