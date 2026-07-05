/**
 * Shared List-column + portfolio types used by BOTH the portfolio detail
 * page (List "Options" popover) and the Customize drawer, so the Fields
 * section and the List column manager operate on the exact same state.
 */

export type ColumnKey =
  | "type"
  | "gate"
  | "status"
  | "progress"
  | "due"
  | "budget"
  | "owner";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  // Grid span at md+ (Name is always 4; the remaining columns share the
  // rest of a 14-col grid, so spans are recomputed per active set).
  span: number;
}

export const COLUMN_DEFS: ColumnDef[] = [
  { key: "type", label: "Type", span: 1 },
  { key: "gate", label: "Gate", span: 1 },
  { key: "status", label: "Status", span: 2 },
  { key: "progress", label: "Progress", span: 2 },
  { key: "due", label: "Due date", span: 2 },
  { key: "budget", label: "Budget", span: 2 },
  { key: "owner", label: "Owner", span: 1 },
];

export const DEFAULT_COLUMNS: ColumnKey[] = [
  "type",
  "gate",
  "status",
  "progress",
  "due",
  "owner",
];

export type PortfolioPrivacy = "PRIVATE" | "WORKSPACE" | "PUBLIC";
