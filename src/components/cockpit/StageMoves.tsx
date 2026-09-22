"use client";

import Link from "next/link";
import { ArrowRight, Flag, Undo2 } from "lucide-react";
import type { CockpitStageMove } from "@/lib/cockpit";
import { CockpitCard, HolderPill, PersonAvatar, relativeFrom } from "./bits";

/** The last ten stage moves across the jobs the viewer can see. Times are
 *  measured against the payload's generatedAt, never the render's clock. */
export function StageMoves({
  moves,
  generatedAt,
}: {
  moves: CockpitStageMove[];
  generatedAt: string;
}) {
  return (
    <CockpitCard title="Recent stage moves" className="min-w-0">
      {moves.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-slate-500">
          No stage moves yet.
        </p>
      ) : (
        <ul className="divide-y divide-[#e6e9ef] py-1">
          {moves.map((m) => {
            const Icon =
              m.direction === "BACKWARD" ? Undo2 : m.direction === "SEED" ? Flag : ArrowRight;
            const who = m.user?.name?.split(" ")[0] ?? "Someone";
            const to = m.toLabel ?? "an unknown stage";
            const verb =
              m.direction === "BACKWARD"
                ? "sent"
                : m.direction === "SEED"
                  ? "set"
                  : "moved";
            const tail = m.direction === "BACKWARD" ? "back to" : "to";
            return (
              <li key={m.id} className="flex items-start gap-2 px-4 py-2">
                <PersonAvatar
                  name={m.user?.name ?? null}
                  image={m.user?.image ?? null}
                  className="mt-0.5 size-5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug text-slate-700">
                    <span className="font-medium text-black">{who}</span> {verb}{" "}
                    <Link
                      href={`/projects/${m.project.id}`}
                      className="font-medium text-black hover:underline"
                    >
                      {m.project.name}
                    </Link>{" "}
                    {tail} <span className="text-black">{to}</span>
                  </p>
                  {m.direction === "BACKWARD" && m.reason && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-500" title={m.reason}>
                      “{m.reason}”
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    <Icon
                      className={
                        m.direction === "BACKWARD"
                          ? "size-3 text-red-600"
                          : "size-3 text-slate-400"
                      }
                      aria-hidden
                    />
                    {m.toHolder && m.toHolder !== "NONE" && <HolderPill holder={m.toHolder} />}
                    <span className="text-[10px] text-slate-400">
                      {relativeFrom(m.createdAt, generatedAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CockpitCard>
  );
}
