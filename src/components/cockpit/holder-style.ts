import type { StageHolder } from "@/lib/pipelines";

/**
 * One color per desk, shared by the holder bar, the stage ribbon, the rail
 * segments, the holder pills and the map markers — so "gold means us" reads
 * the same everywhere on the Firm view. Ours are the gold family; everyone
 * else is slate, darkening as the job gets further from our control.
 */
export const HOLDER_COLOR: Readonly<Record<StageHolder, string>> = {
  FIRM: "#c9a84c",
  PE: "#8a7028",
  CLIENT: "#64748b",
  ARCHITECT: "#94a3b8",
  CONTRACTOR: "#475569",
  CITY: "#1e293b",
  NONE: "#cbd5e1",
};

/** Pill classes (bg + text + border) per holder. */
export const HOLDER_PILL_CLASS: Readonly<Record<StageHolder, string>> = {
  FIRM: "bg-[#c9a84c]/15 text-[#8F6C1F] border-[#c9a84c]/40",
  PE: "bg-[#8a7028]/15 text-[#6b5520] border-[#8a7028]/40",
  CLIENT: "bg-slate-100 text-slate-700 border-slate-200",
  ARCHITECT: "bg-slate-50 text-slate-600 border-slate-200",
  CONTRACTOR: "bg-slate-200 text-slate-800 border-slate-300",
  CITY: "bg-slate-800 text-white border-slate-800",
  NONE: "bg-slate-50 text-slate-400 border-slate-200",
};
