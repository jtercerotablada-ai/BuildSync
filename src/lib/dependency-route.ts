/**
 * ORTHOGONAL ROUTER FOR DEPENDENCY ARROWS (Timeline + Gantt).
 *
 * The elbow this replaces knew only its two endpoints. It dropped its
 * vertical leg at the midpoint of the two stubs — an x chosen with no idea
 * whether a bar was sitting there — and ran its two horizontal legs along
 * `sy` and `ey`, which ARE the lane centrelines, i.e. exactly the line every
 * bar in those two lanes occupies. On a 40-year recertification chart, where
 * five tasks hang off one predecessor and four of them converge on one
 * milestone, that painted vertical legs straight down the middle of other
 * bars and horizontal legs along whole rows of them — and because the arrow
 * layer is drawn ABOVE the bars (it had to be: underneath, a leg crossing a
 * bar vanished and the link read as two disconnected stubs), every one of
 * those legs landed on top of the label text.
 *
 * So the router is given the OBSTACLES. The geometry it exploits:
 *
 *   bars are BAR_HEIGHT tall on a LANE_HEIGHT pitch, centred in their lane,
 *   so the band of (LANE_HEIGHT - BAR_HEIGHT) pixels straddling every lane
 *   boundary is bar-free BY CONSTRUCTION, at every x, forever.
 *
 * That band is the channel. Long horizontal runs go there; a lane centreline
 * only ever carries the short stub in and out of a bar. And because a channel
 * is clear at EVERY x, a route may change column in it — so each lane on the
 * way is crossed at a column THAT lane has free, rather than hunting for one
 * column free in all of them at once, which on a dense chart does not exist.
 * Nothing here styles anything; it decides where lines GO.
 *
 * Pure geometry, no React, no DOM: see dependency-route.test.ts, which
 * asserts collision-freedom directly on the point list of every scenario.
 */

export interface RoutePoint {
  x: number;
  y: number;
}

/**
 * One endpoint of a link. `dir` is +1 when the line leaves/arrives to the
 * RIGHT of the anchor and -1 when it leaves/arrives to the LEFT — that is the
 * one thing that distinguishes FS from SS/FF/SF, and getting it wrong is what
 * once made an arrow drop inside its own dependent bar and draw backwards.
 */
export interface RouteEndpoint {
  x: number;
  y: number;
  dir: number;
}

/** A bar (or a bar plus the label drawn outside it) the route must not cross. */
export interface ObstacleRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface RouteDependencyOptions {
  from: RouteEndpoint;
  to: RouteEndpoint;
  /** Every drawn bar on the canvas, in the same coordinate space as the ends. */
  obstacles?: ObstacleRect[];
  /** Lane pitch (Timeline LANE_HEIGHT 40, Gantt ROW_HEIGHT 37). */
  laneHeight: number;
  /** Bar thickness (Timeline BAR_HEIGHT 28, Gantt BAR_HEIGHT 24). */
  barHeight: number;
  /** How far the line runs straight out of a bar before it may turn. */
  stub?: number;
  /** Corner radius handed to roundedPolyline. */
  radius?: number;
}

const DEFAULT_STUB = 14;
const DEFAULT_RADIUS = 7;

/**
 * A segment counts as hitting a rect only when it enters the INTERIOR by more
 * than this. Every route starts and ends on a bar edge and rides channel
 * boundaries, so an exclusive test would report a hit on every arrow ever
 * drawn.
 */
const HIT_TOLERANCE = 0.5;

// ============================================
// COLLISION
// ============================================

/** Does an axis-aligned segment enter this rect's interior? */
function segmentHitsRect(
  a: RoutePoint,
  b: RoutePoint,
  r: ObstacleRect,
  tolerance: number
): boolean {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return (
    x1 > r.x0 + tolerance &&
    x0 < r.x1 - tolerance &&
    y1 > r.y0 + tolerance &&
    y0 < r.y1 - tolerance
  );
}

/**
 * True if ANY leg of the polyline crosses ANY rect. This is the rule the
 * whole file exists to satisfy, so it is exported: the tests assert it is
 * false for every scenario, and a caller can assert it too.
 */
export function segmentsHitAnyObstacle(
  points: RoutePoint[],
  rects: ObstacleRect[],
  tolerance: number = HIT_TOLERANCE
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (const r of rects) {
      if (segmentHitsRect(points[i], points[i + 1], r, tolerance)) return true;
    }
  }
  return false;
}

/**
 * Is this rect the bar the endpoint is ANCHORED to, rather than one in the
 * way? Both hold the point — an anchor sits on its own bar's edge — so the
 * `dir` decides: the line leaves toward `dir`, which puts its own body (and
 * the label box hanging off it) on the other side. A neighbour parked flush
 * against the anchor lies ahead of it and stays an obstacle, which is the
 * whole reason this is not a plain contains() test.
 */
function isAnchorRect(r: ObstacleRect, p: RoutePoint, dir: number): boolean {
  const holds =
    p.x >= r.x0 - HIT_TOLERANCE &&
    p.x <= r.x1 + HIT_TOLERANCE &&
    p.y >= r.y0 - HIT_TOLERANCE &&
    p.y <= r.y1 + HIT_TOLERANCE;
  if (!holds) return false;
  return dir > 0 ? r.x0 < p.x - HIT_TOLERANCE : r.x1 > p.x + HIT_TOLERANCE;
}

// ============================================
// HELPERS THE VIEWS NEED
// ============================================

/**
 * Build one obstacle from what a view already knows about a bar: its x span
 * and the centreline of its lane. Pass the RIGHT edge of the label when the
 * label is drawn outside the bar — text is exactly as un-crossable as a bar,
 * and the reported bug was arrows over label text.
 */
export function barObstacle(
  xLeft: number,
  xRight: number,
  yCenter: number,
  barHeight: number
): ObstacleRect {
  return {
    x0: Math.min(xLeft, xRight),
    x1: Math.max(xLeft, xRight),
    y0: yCenter - barHeight / 2,
    y1: yCenter + barHeight / 2,
  };
}

// ============================================
// PATH RENDERING
// ============================================

/** Convert a polyline into an SVG path with rounded corners of radius `r`. */
export function roundedPolyline(pts: RoutePoint[], r: number): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = p1.x - ((p1.x - p0.x) / d1) * rr;
    const ay = p1.y - ((p1.y - p0.y) / d1) * rr;
    const bx = p1.x + ((p2.x - p1.x) / d2) * rr;
    const by = p1.y + ((p2.y - p1.y) / d2) * rr;
    d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

// ============================================
// POINT-LIST PLUMBING
// ============================================

/** Drop repeated points and merge points that only subdivide a straight leg. */
function simplify(pts: RoutePoint[]): RoutePoint[] {
  const out: RoutePoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) {
      continue;
    }
    out.push(p);
  }
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    // Only merge a point the leg genuinely passes THROUGH. A doubling-back
    // triple is collinear too, and collapsing it would quietly delete a leg.
    const straightX =
      Math.abs(a.x - b.x) < 0.01 &&
      Math.abs(b.x - c.x) < 0.01 &&
      (b.y - a.y) * (c.y - b.y) > 0;
    const straightY =
      Math.abs(a.y - b.y) < 0.01 &&
      Math.abs(b.y - c.y) < 0.01 &&
      (b.x - a.x) * (c.x - b.x) > 0;
    if (straightX || straightY) {
      out.splice(i, 1);
    } else {
      i++;
    }
  }
  return out;
}

// ============================================
// ROWS AND FREE COLUMNS
// ============================================

/** Every bar sharing one lane's y band, plus that band. */
interface Row {
  y0: number;
  y1: number;
  rects: ObstacleRect[];
}

/** Merge a row's bars into sorted, non-overlapping occupied x spans. */
function occupiedSpans(rects: ObstacleRect[]): [number, number][] {
  const spans = rects
    .map((r) => [r.x0, r.x1] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [lo, hi] of spans) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) {
      last[1] = Math.max(last[1], hi);
    } else {
      merged.push([lo, hi]);
    }
  }
  return merged;
}

/** The complement: every x range in this row a vertical leg may cross. */
function freeSpans(occupied: [number, number][]): [number, number][] {
  const free: [number, number][] = [];
  let cursor = -Infinity;
  for (const [lo, hi] of occupied) {
    if (lo > cursor) free.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  free.push([cursor, Infinity]);
  return free;
}

/** Pull an x inside a span, keeping `clearance` off each finite edge. */
function insetInto(
  x: number,
  [lo, hi]: [number, number],
  clearance: number
): number {
  const room = Math.min(clearance, (hi - lo) / 2);
  const loIn = Number.isFinite(lo) ? lo + room : -Infinity;
  const hiIn = Number.isFinite(hi) ? hi - room : Infinity;
  return Math.min(Math.max(x, loIn), hiIn);
}

/**
 * The x nearest `desired` at which a vertical leg can cross this row. This is
 * the candidate list the fix is built on, computed exactly instead of sampled:
 * the gaps between the row's bars ARE the candidates, and the one nearest the
 * target wins. An empty row returns `desired` unchanged.
 */
function crossingX(
  desired: number,
  free: [number, number][],
  clearance: number
): number {
  let best = desired;
  let bestDistance = Infinity;
  for (const span of free) {
    const x = insetInto(desired, span, clearance);
    const distance = Math.abs(x - desired);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = x;
    }
  }
  return best;
}

/**
 * Where the line may turn out of the lane it is anchored in. Unlike an
 * intermediate row this is not free choice: the leg has to reach the turn
 * along the centreline, so it is confined to the clear stretch that starts at
 * the anchor and runs the way the link leaves. When a neighbour bar is parked
 * flush against the anchor that stretch has zero width and the answer is the
 * shared edge itself — the last bar-free x there is.
 */
function escapeX(
  anchorX: number,
  dir: number,
  desired: number,
  free: [number, number][],
  clearance: number
): number {
  const span = free.find(
    ([lo, hi]) =>
      lo - HIT_TOLERANCE <= anchorX &&
      anchorX <= hi + HIT_TOLERANCE &&
      (dir > 0 ? hi > anchorX + HIT_TOLERANCE : lo < anchorX - HIT_TOLERANCE)
  );
  if (!span) return anchorX;
  const x = insetInto(desired, span, clearance);
  // Never turn back across the anchor: that would draw the arrow leaving on
  // the wrong side, which is how SS and FF links used to end up pointing
  // backwards out of their own bar.
  return dir > 0 ? Math.max(x, anchorX) : Math.min(x, anchorX);
}

/** Group obstacles by the y band they occupy — one entry per lane with bars. */
function rowsBetween(
  obstacles: ObstacleRect[],
  yLo: number,
  yHi: number
): Row[] {
  const byBand = new Map<string, Row>();
  for (const r of obstacles) {
    // Strictly between the two centrelines: a band holding either endpoint is
    // that endpoint's own lane, handled separately, and a rect straddling a
    // centreline is not a lane at all.
    if (r.y0 <= yLo + HIT_TOLERANCE || r.y1 >= yHi - HIT_TOLERANCE) continue;
    const key = r.y0 + ":" + r.y1;
    const row = byBand.get(key);
    if (row) row.rects.push(r);
    else byBand.set(key, { y0: r.y0, y1: r.y1, rects: [r] });
  }
  return [...byBand.values()];
}

// ============================================
// THE ROUTER
// ============================================

/**
 * The point list, before rounding. Exported because it is what a test (or a
 * caller that wants to draw the route some other way) can reason about —
 * `routeDependency` is this plus roundedPolyline.
 *
 * Preference order, cheapest-looking first, first collision-free one wins:
 *   1. the straight shot, when the two share a lane with clear air between
 *   2. the simple elbow, when its vertical leg is free AND its horizontal
 *      legs stay a short approach along the centreline
 *   3. the staircase: out of the bar, into the bar-free channel, and across —
 *      crossing every occupied lane on the way at a column that lane has
 *      free, nearest the target
 * and if none of those is clear, the pre-router elbow, unchecked. A slightly
 * ugly arrow beats a crash on the chart the firm runs its day from.
 */
export function routeDependencyPoints(
  options: RouteDependencyOptions
): RoutePoint[] {
  const { from, to, laneHeight, barHeight } = options;
  const sx = from.x;
  const sy = from.y;
  const ex = to.x;
  const ey = to.y;
  const sdir = from.dir >= 0 ? 1 : -1;
  const edir = to.dir >= 0 ? 1 : -1;
  const stub = options.stub ?? DEFAULT_STUB;
  // A horizontal leg on a lane centreline is an approach, not a route: past
  // this it belongs in the channel even when the centreline happens to be
  // clear, because "clear" only means no bar is there TODAY — one drag of a
  // neighbouring task and it is a line through a label again. Measured
  // against the stub actually in use: pinning it to the default would call a
  // wider caller's one-stub approach "long" and a narrower one's three-stub
  // run "short".
  const maxInLaneRun = 3 * stub;

  const start = { x: sx, y: sy };
  const end = { x: ex, y: ey };
  if (Math.abs(sx - ex) < 0.01 && Math.abs(sy - ey) < 0.01) {
    return [start, end];
  }

  // The bars the link is anchored TO are not obstacles for it — including the
  // label box hanging off the source, which the line has to leave through.
  const obstacles = (options.obstacles ?? []).filter(
    (r) => !isAnchorRect(r, start, sdir) && !isAnchorRect(r, end, edir)
  );

  const sameLane = Math.abs(sy - ey) < 1;
  const sOutX = sx + sdir * stub;
  const eInX = ex + edir * stub;
  const hits = (pts: RoutePoint[]) => segmentsHitAnyObstacle(pts, obstacles);

  // 1. STRAIGHT — only when the line actually leaves `sx` heading `sdir` and
  // arrives at `ex` from the `edir` side. A same-lane FF/SS (both stubs
  // pointing the same way) or a backwards link would otherwise draw itself
  // straight through every bar between the two endpoints.
  if (sameLane && sdir * (ex - sx) > 0 && edir * (sx - ex) > 0) {
    const straight = [start, end];
    if (!hits(straight)) return straight;
  }

  // 2. SIMPLE ELBOW — out along the lane, one drop, in along the lane. Both
  // horizontal legs ride a lane centreline, so this is allowed only as a short
  // approach; anything longer belongs in the channel even when the centreline
  // happens to be clear today.
  const midX = (sOutX + eInX) / 2;
  if (
    !sameLane &&
    sdir * (midX - sx) > 0 &&
    edir * (midX - ex) > 0 &&
    Math.abs(midX - sx) <= maxInLaneRun &&
    Math.abs(midX - ex) <= maxInLaneRun
  ) {
    const elbow = [start, { x: midX, y: sy }, { x: midX, y: ey }, end];
    if (!hits(elbow)) return elbow;
  }

  // 3. STAIRCASE — the general case, and the one the bug report needs: it is
  // the only route that can reach a target whose lane, and every lane on the
  // way to it, is blocked at the obvious column.
  const staircase = staircasePoints({
    start,
    end,
    sdir,
    edir,
    sOutX,
    eInX,
    sameLane,
    obstacles,
    laneHeight,
    barHeight,
  });
  if (staircase && !hits(staircase)) return staircase;

  return fallbackPoints({
    sx,
    sy,
    ex,
    ey,
    sdir,
    edir,
    stub,
    laneHeight,
    sameLane,
  });
}

/**
 * Out of the source lane into the channel beside it, along the channels, and
 * down into the target lane — crossing each occupied lane in between at a
 * column that lane has free.
 *
 * The horizontal legs are what makes this correct: every one of them sits in a
 * channel, the (laneHeight - barHeight) band straddling a lane boundary, which
 * is bar-free by construction at EVERY x. So each lane's crossing can be
 * chosen independently of every other lane's, and the only legs left on a
 * centreline are the two short stubs at the ends.
 *
 * Returns null when the geometry offers no channel to route in.
 */
function staircasePoints(args: {
  start: RoutePoint;
  end: RoutePoint;
  sdir: number;
  edir: number;
  sOutX: number;
  eInX: number;
  sameLane: boolean;
  obstacles: ObstacleRect[];
  laneHeight: number;
  barHeight: number;
}): RoutePoint[] | null {
  const {
    start,
    end,
    sdir,
    edir,
    sOutX,
    eInX,
    sameLane,
    obstacles,
    laneHeight,
    barHeight,
  } = args;
  const clearance = (laneHeight - barHeight) / 2;
  if (clearance < 1) return null;

  const sy = start.y;
  const ey = end.y;
  const halfBar = barHeight / 2;
  const bandOf = (y: number): Row => ({
    y0: y - halfBar,
    y1: y + halfBar,
    rects: obstacles.filter(
      (r) => r.y0 <= y + HIT_TOLERANCE && r.y1 >= y - HIT_TOLERANCE
    ),
  });

  const sourceRow = bandOf(sy);
  const targetRow = bandOf(ey);
  const exitX = escapeX(
    start.x,
    sdir,
    sOutX,
    freeSpans(occupiedSpans(sourceRow.rects)),
    clearance
  );
  const entryX = escapeX(
    end.x,
    edir,
    eInX,
    freeSpans(occupiedSpans(targetRow.rects)),
    clearance
  );

  // Same lane: nothing to cross, so the detour is out into one of the two
  // neighbouring channels and back. Below first, the side the pre-router elbow
  // used for same-row detours.
  if (sameLane) {
    for (const side of [1, -1]) {
      const channel = sy + side * (halfBar + clearance);
      const pts = simplify([
        start,
        { x: exitX, y: sy },
        { x: exitX, y: channel },
        { x: entryX, y: channel },
        { x: entryX, y: ey },
        end,
      ]);
      if (!segmentsHitAnyObstacle(pts, obstacles)) return pts;
    }
    return null;
  }

  const travel = ey > sy ? 1 : -1;
  const middle = rowsBetween(
    obstacles,
    Math.min(sy, ey),
    Math.max(sy, ey)
  ).sort((a, b) => travel * (a.y0 - b.y0));
  const rows = [sourceRow, ...middle, targetRow];

  // The channel between each pair of consecutive rows, hugging the row just
  // left so the run sits on a lane boundary rather than adrift in the middle
  // of an empty lane that one drag could fill.
  const channels: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const leaving = travel > 0 ? rows[i].y1 : rows[i].y0;
    const entering = travel > 0 ? rows[i + 1].y0 : rows[i + 1].y1;
    const gap = travel * (entering - leaving);
    if (gap <= 0) return null; // overlapping bands: not a lane layout
    channels.push(leaving + travel * Math.min(clearance, gap / 2));
  }

  const pts: RoutePoint[] = [start, { x: exitX, y: sy }];
  let x = exitX;
  for (let i = 0; i < channels.length; i++) {
    pts.push({ x, y: channels[i] });
    const next =
      i === channels.length - 1
        ? entryX
        : crossingX(
            eInX,
            freeSpans(occupiedSpans(rows[i + 1].rects)),
            clearance
          );
    pts.push({ x: next, y: channels[i] });
    x = next;
  }
  pts.push({ x, y: ey });
  pts.push(end);
  return simplify(pts);
}

/**
 * The pre-router elbow, drawn without asking whether anything is in the way.
 * Reached only when every legal route is blocked — a chart so dense there is
 * no bar-free path at all. Kept identical to what shipped so the worst case
 * is the old picture rather than a thrown error or a missing arrow.
 */
function fallbackPoints(args: {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  sdir: number;
  edir: number;
  stub: number;
  laneHeight: number;
  sameLane: boolean;
}): RoutePoint[] {
  const { sx, sy, ex, ey, sdir, edir, stub, laneHeight, sameLane } = args;
  const sOutX = sx + sdir * stub;
  const eInX = ex + edir * stub;

  if (sameLane && sdir * (ex - sx) > 0 && edir * (sx - ex) > 0) {
    return [
      { x: sx, y: sy },
      { x: ex, y: ey },
    ];
  }

  const midX = (sOutX + eInX) / 2;
  if (!sameLane && sdir * (midX - sx) > 0 && edir * (midX - ex) > 0) {
    return [
      { x: sx, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ey },
      { x: ex, y: ey },
    ];
  }

  const midY = sy + (ey >= sy ? 1 : -1) * (laneHeight / 2);
  return [
    { x: sx, y: sy },
    { x: sOutX, y: sy },
    { x: sOutX, y: midY },
    { x: eInX, y: midY },
    { x: eInX, y: ey },
    { x: ex, y: ey },
  ];
}

/** The routed link as an SVG path with the rounded corners the chart uses. */
export function routeDependency(options: RouteDependencyOptions): string {
  const pts = routeDependencyPoints(options);
  return roundedPolyline(pts, options.radius ?? DEFAULT_RADIUS);
}
