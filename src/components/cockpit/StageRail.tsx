import { PIPELINES, type PipelineId } from "@/lib/pipelines";
import { cn } from "@/lib/utils";
import { HOLDER_COLOR } from "./holder-style";

/**
 * The mini stage rail: one segment per stage of the pipeline, colored by the
 * stage's holder. Done stages are solid, the current one is solid and taller,
 * the ones still ahead are a faint tint. Presentational only, rendered from
 * the PIPELINES registry — the single mini-rail on the Firm view.
 */
export function StageRail({
  pipelineId,
  stageIndex,
  size = "sm",
  className,
}: {
  pipelineId: PipelineId;
  stageIndex: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const stages = PIPELINES[pipelineId].stages;
  const current = stageIndex ?? -1;
  const label =
    stageIndex === null
      ? `${PIPELINES[pipelineId].label}: no stage set`
      : `Stage ${stageIndex + 1} of ${stages.length}: ${stages[stageIndex]?.label ?? ""}`;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "flex items-end gap-px",
        size === "md" ? "h-2" : "h-1.5",
        className
      )}
    >
      {stages.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <span
            key={s.key}
            className={cn(
              "flex-1 rounded-[1px]",
              state === "current" ? "h-full" : "h-2/3"
            )}
            style={{
              backgroundColor: HOLDER_COLOR[s.holder],
              opacity: state === "todo" ? 0.2 : state === "done" ? 0.55 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
