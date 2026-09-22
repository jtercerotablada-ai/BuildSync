import type { Prisma } from "@prisma/client";

/**
 * The firm's human-readable job number: TT-YYYY-NNN, one counter per
 * workspace per year.
 *
 * WHY ONE MODULE. Creating a project and duplicating one are both ways the
 * firm starts a job, and only the first ever assigned a number — a job begun
 * by duplicating last building's recert showed "—" forever, with no field
 * anywhere to set one. Both writers call `allocateProjectNumber` now.
 */

/** The firm works in Miami; a job opened on the evening of Dec 31 belongs to
 *  the year it was opened in there, not to the UTC year the server runs in. */
export const FIRM_TIME_ZONE = "America/New_York";

/** Calendar year of `now` in the firm's time zone. */
export function firmYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: FIRM_TIME_ZONE,
    year: "numeric",
  }).format(now);
  return parseInt(year, 10);
}

/**
 * UTC midnight of the firm's calendar day for `now` — the date-only
 * convention every stored start/due date uses. `new Date()` instead stamped
 * the current instant, so a project created after 20:00 in Miami (already
 * tomorrow in UTC) opened with tomorrow as its start day.
 */
export function firmTodayDateOnly(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FIRM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "", 10);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

export function projectNumberPrefix(year: number): string {
  return `TT-${year}-`;
}

/**
 * The next number after the highest one already issued under `prefix`.
 *
 * Compared NUMERICALLY: the string sort this replaced put "TT-2026-999" above
 * "TT-2026-1000", so every project after the thousandth would have been
 * numbered TT-2026-1000 again. Rows that do not parse are ignored.
 */
export function nextProjectNumber(
  existing: readonly (string | null)[],
  prefix: string
): string {
  let max = 0;
  for (const n of existing) {
    if (!n || !n.startsWith(prefix)) continue;
    const tail = n.slice(prefix.length);
    if (!/^\d+$/.test(tail)) continue;
    const seq = parseInt(tail, 10);
    if (seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Allocate the next number for `workspaceId`. MUST run inside the
 * transaction that writes the project.
 *
 * The transaction-scoped advisory lock serialises allocations per workspace
 * until that transaction commits: Project.projectNumber has no unique index,
 * so two people creating a job in the same moment both read TT-2026-014 and
 * both wrote TT-2026-015. The lock is released automatically at commit or
 * rollback.
 */
export async function allocateProjectNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  now: Date = new Date()
): Promise<string> {
  const lockKey = `project-number:${workspaceId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  const prefix = projectNumberPrefix(firmYear(now));
  const rows = await tx.project.findMany({
    where: { workspaceId, projectNumber: { startsWith: prefix } },
    select: { projectNumber: true },
  });
  return nextProjectNumber(
    rows.map((r) => r.projectNumber),
    prefix
  );
}
