"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Folder, Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export default function PortalProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Projects</h1>
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg bg-white">
            <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No projects found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Projects</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projects/${project.id}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="font-medium text-gray-900 truncate">
                  {project.name}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {project.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
