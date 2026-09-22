"use client";

import {
  PIPELINES,
  holderLabel,
  type PipelineId,
  type StageHolder,
} from "@/lib/pipelines";
import { HOLDER_ORDER, PIPELINE_ORDER, type HolderTotals } from "@/lib/cockpit";
import { cn } from "@/lib/utils";
import { HOLDER_COLOR } from "./holder-style";

/**
 * "Whose desk is it on?" — one stacked bar across every staged job, split by
 * holder. Legend chips appear only for holders that actually hold something;
 * clicking one filters the board to that holder. Jobs with no holder get
 * chips that land exactly on them: "No type" (the typeless list) and one
 * "No stage" chip per pipeline (that pipeline's "No stage set" filter).
 */
export function HolderBar({
  totals,
  activeHolder,
  onHolder,
  activeNoStage,
  onNoType,
  onNoStage,
}: {
  totals: HolderTotals;
  activeHolder: StageHolder | null;
  /** The pipeline whose "No stage set" filter is on, if any. */
  activeNoStage: PipelineId | null;
  onHolder: (holder: StageHolder) => void;
  onNoType: () => void;
  onNoStage: (pipelineId: PipelineId) => void;
}) {
  const staged = totals.ours + totals.others;
  const present = HOLDER_ORDER.filter((h) => (totals.byHolder[h] ?? 0) > 0);
  const noStage = PIPELINE_ORDER.filter(
    (p) => (totals.noStageByPipeline[p] ?? 0) > 0
  );
  const multiPipeline = noStage.length > 1;

  return (
    <section
      aria-label="Whose desk is it on?"
      className="rounded-lg border border-[#e6e9ef] bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[13px] font-semibold text-black">
          Whose desk is it on?
        </h2>
        {staged > 0 && (
          <p className="text-[12px] text-slate-500 tabular-nums">
            <span className="font-medium text-[#8F6C1F]">{totals.ours}</span> on
            us ·{" "}
            <span className="font-medium text-slate-700">{totals.others}</span>{" "}
            waiting on others
          </p>
        )}
      </div>

      {staged === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500">
          Set a stage on your jobs to see whose desk they&apos;re on.
        </p>
      ) : (
        <div
          className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={present
            .map((h) => `${holderLabel(h)} ${totals.byHolder[h]}`)
            .join(", ")}
        >
          {present.map((h) => (
            <span
              key={h}
              className="h-full"
              style={{
                width: `${((totals.byHolder[h] ?? 0) / staged) * 100}%`,
                backgroundColor: HOLDER_COLOR[h],
              }}
            />
          ))}
        </div>
      )}

      {(present.length > 0 || totals.unstaged > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {present.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={activeHolder === h}
              onClick={() => onHolder(h)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border border-[#e6e9ef] bg-white px-2.5 text-[11px] text-slate-700 hover:bg-slate-50",
                activeHolder === h && "ring-2 ring-[#c9a84c]"
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: HOLDER_COLOR[h] }}
                aria-hidden
              />
              {holderLabel(h)}
              <span className="font-semibold tabular-nums">
                {totals.byHolder[h]}
              </span>
            </button>
          ))}
          {totals.untyped > 0 && (
            <button
              type="button"
              onClick={onNoType}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-[11px] text-slate-500 hover:bg-slate-50"
            >
              No type
              <span className="font-semibold tabular-nums">
                {totals.untyped}
              </span>
            </button>
          )}
          {noStage.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={activeNoStage === p}
              onClick={() => onNoStage(p)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-2.5 text-[11px] text-slate-500 hover:bg-slate-50",
                activeNoStage === p && "ring-2 ring-[#c9a84c]"
              )}
            >
              {multiPipeline ? `No stage · ${PIPELINES[p].label}` : "No stage"}
              <span className="font-semibold tabular-nums">
                {totals.noStageByPipeline[p]}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
