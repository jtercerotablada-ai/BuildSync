import {
  CircleDot,
  ListChecks,
  Calendar,
  Users,
  Link2,
  Type,
  Hash,
  FunctionSquare,
  Timer,
  Clock,
  type LucideIcon,
} from "lucide-react";

export interface FieldTypeConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Prisma CustomFieldType mapping – null when the backend doesn't support it yet */
  prismaType: string | null;
}

export const FIELD_TYPES: FieldTypeConfig[] = [
  { id: "single_select", label: "Single select", icon: CircleDot, prismaType: "DROPDOWN" },
  { id: "multi_select", label: "Multi select", icon: ListChecks, prismaType: "MULTI_SELECT" },
  { id: "date", label: "Date", icon: Calendar, prismaType: "DATE" },
  { id: "people", label: "People", icon: Users, prismaType: "PEOPLE" },
  { id: "reference", label: "Reference", icon: Link2, prismaType: null },
  { id: "text", label: "Text", icon: Type, prismaType: "TEXT" },
  { id: "number", label: "Number", icon: Hash, prismaType: "NUMBER" },
  { id: "formula", label: "Formula", icon: FunctionSquare, prismaType: null },
  { id: "timer", label: "Timer", icon: Timer, prismaType: null },
  { id: "time_tracking", label: "Time tracking", icon: Clock, prismaType: null },
];
