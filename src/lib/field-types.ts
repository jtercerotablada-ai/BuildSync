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
  Flag,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Pencil,
  UserCircle,
  Tag,
  Ban,
  ShieldAlert,
  Heart,
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
  { id: "reference", label: "Reference", icon: Link2, prismaType: "REFERENCE" },
  { id: "text", label: "Text", icon: Type, prismaType: "TEXT" },
  { id: "number", label: "Number", icon: Hash, prismaType: "NUMBER" },
  { id: "formula", label: "Formula", icon: FunctionSquare, prismaType: "FORMULA" },
  { id: "timer", label: "Timer", icon: Timer, prismaType: "TIMER" },
  { id: "time_tracking", label: "Time tracking", icon: Clock, prismaType: "TIME_TRACKING" },
  { id: "rollup", label: "Roll-up", icon: FunctionSquare, prismaType: "ROLLUP" },
];

/**
 * Built-in column types Asana surfaces under "Show more" in the
 * Add Column dropdown. They read existing task fields, no custom
 * field definition or backend write is needed — they just toggle
 * the visibility of an extra column that already has a data source
 * on the Task model. Skip the CustomFieldModal entirely.
 *
 * `taskField` is what TaskRow reads to render the value.
 */
export interface BuiltinFieldConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Source field on the Task object to render. */
  taskField:
    | "priority"
    | "startDate"
    | "completedAt"
    | "updatedAt"
    | "createdAt"
    | "creator"
    | "tags"
    | "likes"
    | "dependencies"
    | "dependents";
  /** Default column width in px. */
  defaultWidth: number;
}

export const BUILTIN_FIELDS: BuiltinFieldConfig[] = [
  { id: "priority", label: "Priority", icon: Flag, taskField: "priority", defaultWidth: 110 },
  { id: "tags", label: "Tags", icon: Tag, taskField: "tags", defaultWidth: 140 },
  { id: "blocked_by", label: "Blocked by", icon: Ban, taskField: "dependencies", defaultWidth: 160 },
  { id: "blocks", label: "Blocks", icon: ShieldAlert, taskField: "dependents", defaultWidth: 160 },
  { id: "start_date", label: "Start date", icon: CalendarClock, taskField: "startDate", defaultWidth: 130 },
  { id: "completed_at", label: "Completion date", icon: CalendarCheck, taskField: "completedAt", defaultWidth: 130 },
  { id: "updated_at", label: "Last modified", icon: Pencil, taskField: "updatedAt", defaultWidth: 130 },
  { id: "created_at", label: "Creation date", icon: CalendarPlus, taskField: "createdAt", defaultWidth: 130 },
  { id: "creator", label: "Created by", icon: UserCircle, taskField: "creator", defaultWidth: 140 },
  { id: "likes", label: "Likes", icon: Heart, taskField: "likes", defaultWidth: 90 },
];
