/**
 * Shared types for goal view components. The page-level `Objective`
 * type in `/goals/page.tsx` is the source of truth; this is a slim
 * mirror so view components don't import from the page.
 */
export interface ViewObjective {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  progress: number;
  period: string | null;
  confidenceScore?: number | null;
  lastCheckInAt?: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  team: {
    id: string;
    name: string;
  } | null;
  keyResults: {
    id: string;
    name: string;
    targetValue: number;
    currentValue: number;
    startValue: number;
    unit: string | null;
  }[];
  children: {
    id: string;
    name: string;
    status: string;
    progress: number;
  }[];
  _count: {
    keyResults: number;
    children: number;
    projects?: number;
  };
  parentId?: string | null;
}

export type GoalsViewType = "list" | "kanban" | "cards" | "tree";
