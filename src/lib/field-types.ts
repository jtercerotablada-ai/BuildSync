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
  { id: "single_select", label: "Selección única", icon: CircleDot, prismaType: "DROPDOWN" },
  { id: "multi_select", label: "Selección múltiple", icon: ListChecks, prismaType: "MULTI_SELECT" },
  { id: "date", label: "Fecha", icon: Calendar, prismaType: "DATE" },
  { id: "people", label: "Personas", icon: Users, prismaType: "PEOPLE" },
  { id: "reference", label: "Referencia", icon: Link2, prismaType: null },
  { id: "text", label: "Texto", icon: Type, prismaType: "TEXT" },
  { id: "number", label: "Número", icon: Hash, prismaType: "NUMBER" },
  { id: "formula", label: "Fórmula", icon: FunctionSquare, prismaType: null },
  { id: "timer", label: "Temporizador", icon: Timer, prismaType: null },
  { id: "time_tracking", label: "Seguimiento del tiempo", icon: Clock, prismaType: null },
];
