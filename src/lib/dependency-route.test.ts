import { describe, expect, it } from "vitest";
import {
  barObstacle,
  roundedPolyline,
  routeDependency,
  routeDependencyPoints,
  segmentsHitAnyObstacle,
  type ObstacleRect,
  type RouteEndpoint,
  type RoutePoint,
} from "./dependency-route";

/**
 * THE DEPENDENCY ROUTER.
 *
 * The bug this file exists to keep fixed: on a 40-year recertification chart,
 * the arrows "se revuelven" — they run THROUGH the bars and OVER the task
 * labels. The old elbow knew only its two endpoints, so it dropped its
 * vertical leg at the midpoint of the two stubs whether or not a bar was
 * sitting there, and ran both horizontal legs along the lane centrelines,
 * which is exactly where every bar in those lanes lives. The arrow layer is
 * painted ABOVE the bars, so each of those legs landed on the label text.
 *
 * Every scenario below therefore ends in the same assertion:
 * `segmentsHitAnyObstacle(points, bars)` is FALSE. That is the product
 * requirement stated in geometry. `expectWellFormed` carries the rest — the
 * invariants the four dependency types depend on, chiefly that the line
 * leaves the blocker on its `dir` side and arrives at the dependent from its
 * `dir` side. Getting the second one wrong is what once made SS and FF links
 * drop inside the dependent's own bar and draw backwards with the arrowhead
 * pointing the wrong way.
 *
 * Timeline geometry: LANE_HEIGHT 40, BAR_HEIGHT 28, lane N centred on
 * N*40 + 20, so the 12px band straddling every lane boundary is bar-free by
 * construction. Gantt geometry (37/24) gets its own case at the bottom —
 * nothing here may hard-code the Timeline's pitch.
 *
 * No database, no DOM, no React: this is pure geometry on purpose.
 */

const LANE_HEIGHT = 40;
const BAR_HEIGHT = 28;

/** Centreline of lane N — the y every anchor and every bar in it sits on. */
const laneY = (lane: number) => lane * LANE_HEIGHT + LANE_HEIGHT / 2;

/** A drawn bar in lane N. x1 is the LABEL's right edge when it hangs outside. */
const bar = (lane: number, x0: number, x1: number): ObstacleRect =>
  barObstacle(x0, x1, laneY(lane), BAR_HEIGHT);

function route(
  from: RouteEndpoint,
  to: RouteEndpoint,
  obstacles: ObstacleRect[]
): RoutePoint[] {
  return routeDependencyPoints({
    from,
    to,
    obstacles,
    laneHeight: LANE_HEIGHT,
    barHeight: BAR_HEIGHT,
  });
}

/** A drawn task: which lane it packed into and the x span it occupies. */
type Item = { lane: number; x0: number; x1: number };

/** The four link types, as the views compute their endpoints. */
const fs = (s: Item, t: Item) =>
  [
    { x: s.x1, y: laneY(s.lane), dir: 1 },
    { x: t.x0, y: laneY(t.lane), dir: -1 },
  ] as const;
const ss = (s: Item, t: Item) =>
  [
    { x: s.x0, y: laneY(s.lane), dir: -1 },
    { x: t.x0, y: laneY(t.lane), dir: -1 },
  ] as const;
const ff = (s: Item, t: Item) =>
  [
    { x: s.x1, y: laneY(s.lane), dir: 1 },
    { x: t.x1, y: laneY(t.lane), dir: 1 },
  ] as const;
const sf = (s: Item, t: Item) =>
  [
    { x: s.x0, y: laneY(s.lane), dir: -1 },
    { x: t.x1, y: laneY(t.lane), dir: 1 },
  ] as const;

/**
 * Invariants that hold for EVERY route, legal or fallback: it starts and ends
 * exactly on the anchors, every leg is axis-aligned, it leaves on the source's
 * side and arrives from the target's side.
 */
function expectWellFormed(
  points: RoutePoint[],
  from: RouteEndpoint,
  to: RouteEndpoint
) {
  expect(points.length).toBeGreaterThanOrEqual(2);
  expect(points[0]).toEqual({ x: from.x, y: from.y });
  expect(points[points.length - 1]).toEqual({ x: to.x, y: to.y });
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const orthogonal =
      Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01;
    expect(orthogonal, `leg ${i} is not axis-aligned`).toBe(true);
  }
  const second = points[1];
  expect(
    from.dir * (second.x - from.x),
    "the line leaves the blocker on the wrong side"
  ).toBeGreaterThanOrEqual(0);
  const penultimate = points[points.length - 2];
  expect(
    to.dir * (penultimate.x - to.x),
    "the line arrives at the dependent from the wrong side"
  ).toBeGreaterThanOrEqual(0);
}

// ============================================
// THE COLLISION TEST ITSELF
// ============================================

describe("segmentsHitAnyObstacle", () => {
  const b = bar(1, 200, 400); // y 46..74

  it("reports a horizontal leg running down a lane centreline through a bar", () => {
    // This is the bug, in one line: a leg along ey = laneY(1).
    expect(
      segmentsHitAnyObstacle(
        [
          { x: 100, y: laneY(1) },
          { x: 500, y: laneY(1) },
        ],
        [b]
      )
    ).toBe(true);
  });

  it("reports a vertical leg dropped through a bar", () => {
    expect(
      segmentsHitAnyObstacle(
        [
          { x: 300, y: laneY(0) },
          { x: 300, y: laneY(2) },
        ],
        [b]
      )
    ).toBe(true);
  });

  it("clears a leg in the inter-lane channel", () => {
    // y = 40 is the lane 0/1 boundary: 6px of air on either side.
    expect(
      segmentsHitAnyObstacle(
        [
          { x: 100, y: 40 },
          { x: 500, y: 40 },
        ],
        [b]
      )
    ).toBe(false);
  });

  it("clears a leg that only grazes a bar's edge", () => {
    expect(
      segmentsHitAnyObstacle(
        [
          { x: 100, y: b.y0 },
          { x: 500, y: b.y0 },
        ],
        [b]
      )
    ).toBe(false);
  });
});

// ============================================
// THE REPORTED BUG
// ============================================

describe("the 40-year recertification chart", () => {
  /**
   * The exact shape the owner reported, at day zoom: one predecessor with
   * five successors, four of which converge on a single milestone, plus the
   * long "Thermography (IR) inspection" bar and a report bar parked where the
   * naive midpoint and the naive centreline legs used to run.
   */
  const inspection = { lane: 0, x0: 100, x1: 300 };
  const successors = [
    { name: "Thermography (IR) inspection", lane: 1, x0: 320, x1: 520 },
    { name: "Electrical inspection", lane: 2, x0: 320, x1: 500 },
    { name: "Structural inspection", lane: 3, x0: 320, x1: 560 },
    { name: "Parking / balcony survey", lane: 4, x0: 320, x1: 480 },
    { name: "Photo documentation", lane: 5, x0: 320, x1: 540 },
  ];
  // A bar sitting exactly where the naive midX vertical leg used to drop, and
  // one in the milestone's own lane, under the naive centreline leg.
  const drafting = { lane: 3, x0: 560, x1: 660 };
  const reportPrep = { lane: 6, x0: 560, x1: 680 };
  const milestone = { lane: 6, x0: 700, x1: 720 };

  const bars: ObstacleRect[] = [
    bar(inspection.lane, inspection.x0, inspection.x1),
    ...successors.map((s) => bar(s.lane, s.x0, s.x1)),
    bar(drafting.lane, drafting.x0, drafting.x1),
    bar(reportPrep.lane, reportPrep.x0, reportPrep.x1),
    bar(milestone.lane, milestone.x0, milestone.x1),
  ];

  it("routes all five successor links without crossing a bar or a label", () => {
    for (const s of successors) {
      const [from, to] = fs(inspection, s);
      const points = route(from, to, bars);
      expectWellFormed(points, from, to);
      expect(
        segmentsHitAnyObstacle(points, bars),
        `${s.name} link crosses a bar`
      ).toBe(false);
    }
  });

  it("routes the four converging milestone links without crossing a bar", () => {
    for (const s of successors.slice(0, 4)) {
      const [from, to] = fs(s, milestone);
      const points = route(from, to, bars);
      expectWellFormed(points, from, to);
      expect(
        segmentsHitAnyObstacle(points, bars),
        `${s.name} → milestone crosses a bar`
      ).toBe(false);
    }
  });

  it("refuses the naive midpoint when a bar is parked on it", () => {
    // Thermography (lane 1, ends 520) → milestone (lane 6, starts 700).
    // The pre-router elbow dropped at (534 + 686) / 2 = 610, which is inside
    // the drafting bar in lane 3, and ran its second leg along lane 6's
    // centreline straight over the report-prep bar's label.
    const [from, to] = fs(successors[0], milestone);
    const points = route(from, to, bars);
    const naiveMidX = 610;
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    const droppedOnTheNaiveMid = points.some(
      (p, i) =>
        i > 0 &&
        Math.abs(p.x - naiveMidX) < 1 &&
        Math.abs(points[i - 1].x - naiveMidX) < 1
    );
    expect(droppedOnTheNaiveMid).toBe(false);
  });

  it("keeps long horizontal runs off the lane centrelines", () => {
    const [from, to] = fs(successors[0], milestone);
    const points = route(from, to, bars);
    const centrelines = new Set(
      [inspection, ...successors, reportPrep, milestone].map((b) =>
        laneY(b.lane)
      )
    );
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (Math.abs(a.y - b.y) > 0.01) continue; // vertical leg
      const run = Math.abs(a.x - b.x);
      if (!centrelines.has(a.y)) continue;
      // A centreline may only carry the short stub in or out of a bar.
      expect(run, `a ${run}px run sits on lane centreline y=${a.y}`)
        .toBeLessThanOrEqual(3 * 14);
    }
  });
});

// ============================================
// THE FOUR DEPENDENCY TYPES
// ============================================

describe("dependency types", () => {
  const blocker = { lane: 0, x0: 100, x1: 300 };
  const dependent = { lane: 1, x0: 400, x1: 600 };
  const bars = [
    bar(blocker.lane, blocker.x0, blocker.x1),
    bar(dependent.lane, dependent.x0, dependent.x1),
  ];

  const cases: [string, readonly [RouteEndpoint, RouteEndpoint]][] = [
    ["FINISH_TO_START", fs(blocker, dependent)],
    ["START_TO_START", ss(blocker, dependent)],
    ["FINISH_TO_FINISH", ff(blocker, dependent)],
    ["START_TO_FINISH", sf(blocker, dependent)],
  ];

  for (const [name, [from, to]] of cases) {
    it(`${name} leaves and arrives on the right sides, crossing nothing`, () => {
      const points = route(from, to, bars);
      expectWellFormed(points, from, to);
      expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    });
  }

  it("never draws a same-lane FF straight through the dependent's bar", () => {
    // Both stubs point right, so the endpoints are on the same y with the
    // dependent's whole bar between them. The straight shot is illegal here.
    const t = { lane: 0, x0: 400, x1: 600 };
    const sameLaneBars = [bar(0, 100, 300), bar(0, t.x0, t.x1)];
    const [from, to] = ff({ lane: 0, x0: 100, x1: 300 }, t);
    const points = route(from, to, sameLaneBars);
    expectWellFormed(points, from, to);
    expect(points.length).toBeGreaterThan(2);
    expect(segmentsHitAnyObstacle(points, sameLaneBars)).toBe(false);
  });

  it("never draws a same-lane SS straight through the dependent's bar", () => {
    const s = { lane: 0, x0: 100, x1: 300 };
    const t = { lane: 0, x0: 400, x1: 600 };
    const sameLaneBars = [bar(0, s.x0, s.x1), bar(0, t.x0, t.x1)];
    const [from, to] = ss(s, t);
    const points = route(from, to, sameLaneBars);
    expectWellFormed(points, from, to);
    expect(points.length).toBeGreaterThan(2);
    expect(segmentsHitAnyObstacle(points, sameLaneBars)).toBe(false);
  });
});

// ============================================
// SHORTEST LEGAL ROUTE
// ============================================

describe("shortest legal route", () => {
  it("draws a straight line when the two share a lane with clear air", () => {
    const s = { lane: 2, x0: 100, x1: 300 };
    const t = { lane: 2, x0: 400, x1: 600 };
    const bars = [bar(2, s.x0, s.x1), bar(2, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expect(points).toEqual([
      { x: 300, y: laneY(2) },
      { x: 400, y: laneY(2) },
    ]);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
  });

  it("detours into a channel when a bar sits between two same-lane tasks", () => {
    const s = { lane: 2, x0: 100, x1: 200 };
    const blockerInBetween = bar(2, 250, 350);
    const t = { lane: 2, x0: 400, x1: 600 };
    const bars = [bar(2, s.x0, s.x1), blockerInBetween, bar(2, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    const leftTheLane = points.some(
      (p) => Math.abs(p.y - laneY(2)) >= (LANE_HEIGHT - BAR_HEIGHT) / 2
    );
    expect(leftTheLane, "the line stayed on the blocked centreline").toBe(true);
  });

  it("uses the simple elbow for a short hop into the next lane", () => {
    const s = { lane: 0, x0: 100, x1: 300 };
    const t = { lane: 1, x0: 320, x1: 500 };
    const bars = [bar(0, s.x0, s.x1), bar(1, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expect(points).toHaveLength(4);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
  });

  it("puts the crossing in the channel once the run gets long", () => {
    const s = { lane: 0, x0: 100, x1: 200 };
    const t = { lane: 1, x0: 700, x1: 900 };
    const bars = [bar(0, s.x0, s.x1), bar(1, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    // The 500px run belongs on the lane 0/1 boundary, not on either
    // centreline, even though both centrelines happen to be empty today.
    const longRun = points.find(
      (p, i) =>
        i < points.length - 1 &&
        Math.abs(points[i + 1].y - p.y) < 0.01 &&
        Math.abs(points[i + 1].x - p.x) > 3 * 14
    );
    expect(longRun).toBeDefined();
    expect(longRun!.y).toBe(LANE_HEIGHT); // the lane 0/1 boundary
  });
});

// ============================================
// BACKWARDS AND ADJACENT
// ============================================

describe("backwards links", () => {
  it("routes a dependent that starts to the LEFT of its blocker", () => {
    const s = { lane: 2, x0: 400, x1: 600 };
    const t = { lane: 2, x0: 100, x1: 300 };
    const bars = [bar(2, s.x0, s.x1), bar(2, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    // It has to go around, not back along the centreline through both bars.
    const leftTheLane = points.some(
      (p) => Math.abs(p.y - laneY(2)) >= (LANE_HEIGHT - BAR_HEIGHT) / 2
    );
    expect(leftTheLane).toBe(true);
  });

  it("routes a backwards link across lanes with a bar in the way", () => {
    const s = { lane: 3, x0: 500, x1: 700 };
    const t = { lane: 1, x0: 100, x1: 250 };
    const inTheWay = bar(2, 150, 650);
    const bars = [bar(3, s.x0, s.x1), bar(1, t.x0, t.x1), inTheWay];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
  });

  it("routes adjacent lanes when the dependent starts before the blocker ends", () => {
    const s = { lane: 0, x0: 100, x1: 400 };
    const t = { lane: 1, x0: 300, x1: 600 };
    const bars = [bar(0, s.x0, s.x1), bar(1, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
  });
});

// ============================================
// CROWDED CHARTS
// ============================================

describe("distant lanes with obstacles in every intermediate lane", () => {
  const s = { lane: 0, x0: 100, x1: 200 };
  const t = { lane: 4, x0: 600, x1: 700 };
  // Lanes 1-3 are walled off to the right of x 340 for the whole chart, so the
  // 40px column at 300..340 is the only way down that is anywhere near the
  // link — the naive midpoint, the target's stub and the source's stub are all
  // inside a bar in all three lanes.
  const bars = [
    bar(0, s.x0, s.x1),
    bar(4, t.x0, t.x1),
    bar(1, 150, 300),
    bar(1, 340, 1400),
    bar(2, 150, 300),
    bar(2, 340, 1400),
    bar(3, 150, 300),
    bar(3, 340, 1400),
  ];

  it("takes the vertical leg down the only free column", () => {
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);

    const crossing = points.find(
      (p, i) =>
        i < points.length - 1 &&
        Math.abs(points[i + 1].x - p.x) < 0.01 &&
        Math.abs(points[i + 1].y - p.y) > LANE_HEIGHT
    );
    expect(crossing, "no leg crosses the walled-off lanes").toBeDefined();
    expect(crossing!.x).toBeGreaterThan(300);
    expect(crossing!.x).toBeLessThan(340);
  });
});

describe("a neighbour parked flush against the anchor", () => {
  it("rises on the shared edge instead of driving through the neighbour", () => {
    // Two label-inside bars may sit flush, so the lane's centreline offers no
    // room at all to leave on. The shared edge is the last bar-free x there
    // is, and the route has to find it — an anchor's OWN bar is not an
    // obstacle, but the one starting where it ends very much is.
    const s = { lane: 0, x0: 100, x1: 300 };
    const flush = bar(0, 300, 500);
    const t = { lane: 2, x0: 600, x1: 800 };
    const bars = [bar(0, s.x0, s.x1), flush, bar(2, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    expect(segmentsHitAnyObstacle(points, [flush])).toBe(false);
  });
});

describe("labels drawn outside their bar", () => {
  it("treats the label's box as un-crossable", () => {
    // The dependent's label hangs 120px past its narrow bar. The route may
    // not run over the text any more than over the bar.
    const s = { lane: 0, x0: 100, x1: 200 };
    const labelled = bar(1, 260, 500); // 260..280 bar, label out to 500
    const t = { lane: 2, x0: 320, x1: 480 };
    const bars = [bar(0, s.x0, s.x1), labelled, bar(2, t.x0, t.x1)];
    const [from, to] = fs(s, t);
    const points = route(from, to, bars);
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
    expect(segmentsHitAnyObstacle(points, [labelled])).toBe(false);
  });
});

// ============================================
// FALLBACK
// ============================================

describe("no free route", () => {
  it("falls back to the pre-router elbow instead of throwing", () => {
    const from: RouteEndpoint = { x: 200, y: laneY(0), dir: 1 };
    const to: RouteEndpoint = { x: 600, y: laneY(4), dir: -1 };
    // A wall spanning every x and y between the two anchors without touching
    // either: no orthogonal route can exist.
    const wall: ObstacleRect = { x0: 201, x1: 599, y0: -500, y1: 500 };
    const points = route(from, to, [wall]);
    expectWellFormed(points, from, to);
    // The old 4-point elbow, drawn at the midpoint of the two stubs.
    expect(points).toEqual([
      { x: 200, y: laneY(0) },
      { x: 400, y: laneY(0) },
      { x: 400, y: laneY(4) },
      { x: 600, y: laneY(4) },
    ]);
  });

  it("still returns a path when there is no channel to route in", () => {
    // barHeight === laneHeight leaves no bar-free band anywhere.
    const path = routeDependency({
      from: { x: 200, y: 20, dir: 1 },
      to: { x: 600, y: 100, dir: -1 },
      obstacles: [{ x0: 201, x1: 599, y0: -500, y1: 500 }],
      laneHeight: 40,
      barHeight: 40,
    });
    expect(path.startsWith("M ")).toBe(true);
  });

  it("returns a degenerate two-point path when the anchors coincide", () => {
    const points = route(
      { x: 300, y: laneY(1), dir: 1 },
      { x: 300, y: laneY(1), dir: -1 },
      []
    );
    expect(points).toHaveLength(2);
  });
});

// ============================================
// OTHER GEOMETRIES
// ============================================

describe("Gantt geometry (37px rows, 24px bars)", () => {
  const rowY = (row: number) => row * 37 + 37 / 2;
  const gBar = (row: number, x0: number, x1: number) =>
    barObstacle(x0, x1, rowY(row), 24);

  it("finds the channel on the Gantt's own pitch", () => {
    const bars = [gBar(0, 100, 300), gBar(1, 250, 700), gBar(2, 700, 900)];
    const from: RouteEndpoint = { x: 300, y: rowY(0), dir: 1 };
    const to: RouteEndpoint = { x: 700, y: rowY(2), dir: -1 };
    const points = routeDependencyPoints({
      from,
      to,
      obstacles: bars,
      laneHeight: 37,
      barHeight: 24,
    });
    expectWellFormed(points, from, to);
    expect(segmentsHitAnyObstacle(points, bars)).toBe(false);
  });
});

// ============================================
// RENDERING
// ============================================

describe("roundedPolyline", () => {
  it("draws a plain line for two points", () => {
    expect(
      roundedPolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        7
      )
    ).toBe("M 0 0 L 10 0");
  });

  it("rounds every interior corner", () => {
    const d = roundedPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      7
    );
    expect(d.match(/Q/g)).toHaveLength(2);
  });

  it("never rounds past the midpoint of a short leg", () => {
    // A 4px leg with r=7 would otherwise curve back on itself.
    const d = roundedPolyline(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 40 },
      ],
      7
    );
    expect(d).toContain("L 2.0 0.0");
  });
});

describe("routeDependency", () => {
  it("returns an SVG path for the routed points", () => {
    const s = { lane: 0, x0: 100, x1: 300 };
    const t = { lane: 2, x0: 500, x1: 700 };
    const [from, to] = fs(s, t);
    const d = routeDependency({
      from,
      to,
      obstacles: [bar(0, s.x0, s.x1), bar(2, t.x0, t.x1)],
      laneHeight: LANE_HEIGHT,
      barHeight: BAR_HEIGHT,
    });
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain("Q");
  });

  it("works with no obstacle list at all", () => {
    const d = routeDependency({
      from: { x: 300, y: 20, dir: 1 },
      to: { x: 500, y: 100, dir: -1 },
      laneHeight: LANE_HEIGHT,
      barHeight: BAR_HEIGHT,
    });
    expect(d.startsWith("M ")).toBe(true);
  });
});

// ============================================
// FUZZ
// ============================================

/**
 * Hand-built scenarios only ever cover the cases someone thought of, and the
 * reported bug was a case nobody thought of: a bar that happened to be sitting
 * where the midpoint landed. So: thousands of randomly packed charts, denser
 * than any real project, every link type, every direction — and the same
 * assertion each time. This is what caught the single-crossing router, which
 * cleared every scenario above and still crossed a bar on 8% of crowded
 * charts, because one free column has to exist in EVERY lane it passes at
 * once. The seed is fixed so a failure is reproducible.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("fuzz", () => {
  it("crosses nothing on 2000 randomly packed charts", () => {
    const rnd = mulberry32(0x5eed);
    let routed = 0;

    for (let iteration = 0; iteration < 2000; iteration++) {
      const laneCount = 1 + Math.floor(rnd() * 7);
      const items: Item[] = [];
      const bars: ObstacleRect[] = [];
      for (let lane = 0; lane < laneCount; lane++) {
        let x = Math.floor(rnd() * 60);
        while (x < 900) {
          const width = 10 + Math.floor(rnd() * 200);
          items.push({ lane, x0: x, x1: x + width });
          bars.push(bar(lane, x, x + width));
          // Gaps down to zero: two label-inside bars may sit flush.
          x += width + Math.floor(rnd() * 60);
        }
      }
      if (items.length < 2) continue;

      const ia = Math.floor(rnd() * items.length);
      const ib = Math.floor(rnd() * items.length);
      if (ia === ib) continue;
      const [from, to] = [fs, ss, ff, sf][Math.floor(rnd() * 4)](
        items[ia],
        items[ib]
      );
      if (from.x === to.x && from.y === to.y) continue;

      routed++;
      const points = route(from, to, bars);
      expectWellFormed(points, from, to);
      // The two anchor bars are excluded BY IDENTITY — bars[i] is the bar
      // drawn for items[i] — and deliberately not by re-typing the router's
      // own isAnchorRect rule here. A test that restates the rule it is
      // checking exempts exactly the rects a wrong rule would exempt, so it
      // would stay green while arrows drove through a third bar the router
      // had waved through. Everything else on the chart, including a
      // neighbour parked flush against an anchor, must still be avoided.
      const inTheWay = bars.filter((_, i) => i !== ia && i !== ib);
      expect(
        segmentsHitAnyObstacle(points, inTheWay),
        `iteration ${iteration}: ${JSON.stringify({ from, to, points })}`
      ).toBe(false);
    }

    // Guard against the generator quietly degenerating into nothing to test.
    expect(routed).toBeGreaterThan(1500);
  });
});

describe("barObstacle", () => {
  it("centres the rect on the lane and normalises the x span", () => {
    expect(barObstacle(400, 100, 60, 28)).toEqual({
      x0: 100,
      x1: 400,
      y0: 46,
      y1: 74,
    });
  });
});
