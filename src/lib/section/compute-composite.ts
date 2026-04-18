import { computeTemplate } from './compute-template';
import type { CompositeParams, Point2D, SectionProperties } from './types';

// Composite/built-up section: combines N template operands, each with a (dx, dy)
// offset and an 'add' or 'subtract' op, using the parallel axis theorem.
//
// Example uses:
//   - Plate welded on top of a W-shape (deeper built-up girder)
//   - Double-channel back-to-back (2C)
//   - HSS with reinforcing plate
//   - Rectangle with circular cutout
//
// Math:
//   Let sign_i = +1 for 'add', -1 for 'subtract', and (xg_i, yg_i) be the
//   operand centroid translated into the global composite frame.
//
//   A       = Σ sign_i · A_i
//   xbar    = Σ sign_i · A_i · xg_i / A
//   ybar    = Σ sign_i · A_i · yg_i / A
//   Ix      = Σ sign_i · [ Ix_i + A_i · (yg_i − ybar)² ]        (parallel axis)
//   Iy      = Σ sign_i · [ Iy_i + A_i · (xg_i − xbar)² ]
//   Ixy     = Σ sign_i · [ Ixy_i + A_i · (xg_i − xbar)·(yg_i − ybar) ]
//
// Approximations for v1:
//   - Zx, Zy summed with parallel axis (exact only when PNA ≈ centroid — fine
//     for symmetric built-ups; ~5-10% off for highly asymmetric cases)
//   - J summed (valid for thin-walled open built-ups; cross-coupling ignored)
//   - Cw set to 0 (warping constant for arbitrary built-ups not in closed form)
//   - Shear center coincides with centroid (approx; may differ for asymmetric)

export function computeComposite(params: CompositeParams): SectionProperties {
  const { operands } = params;

  if (operands.length === 0) {
    return computeTemplate({ kind: 'rectangular', b: 1, h: 1 });
  }

  const items = operands.map((o) => {
    const props = computeTemplate(o.params);
    const sign = o.op === 'subtract' ? -1 : 1;
    return {
      props,
      sign,
      op: o.op,
      dx: o.dx,
      dy: o.dy,
      xg: props.xbar + o.dx,
      yg: props.ybar + o.dy,
    };
  });

  const A = items.reduce((s, it) => s + it.sign * it.props.A, 0);

  if (Math.abs(A) < 1e-9) {
    return { ...items[0].props, subShapes: subShapesFor(items) };
  }

  const xbar = items.reduce((s, it) => s + it.sign * it.props.A * it.xg, 0) / A;
  const ybar = items.reduce((s, it) => s + it.sign * it.props.A * it.yg, 0) / A;

  let Ix = 0;
  let Iy = 0;
  let Ixy = 0;
  for (const it of items) {
    const dx = it.xg - xbar;
    const dy = it.yg - ybar;
    Ix += it.sign * (it.props.Ix + it.props.A * dy * dy);
    Iy += it.sign * (it.props.Iy + it.props.A * dx * dx);
    Ixy += it.sign * (it.props.Ixy + it.props.A * dx * dy);
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  const subShapes: Array<{ outline: Point2D[]; op: 'add' | 'subtract' }> = [];
  for (const it of items) {
    const translated = it.props.outline.map((p) => ({
      x: p.x + it.dx,
      y: p.y + it.dy,
    }));
    subShapes.push({ outline: translated, op: it.op });
    for (const p of translated) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }

  const denomTop = Math.max(yMax - ybar, 1e-9);
  const denomBot = Math.max(ybar - yMin, 1e-9);
  const denomLeft = Math.max(xbar - xMin, 1e-9);
  const denomRight = Math.max(xMax - xbar, 1e-9);
  const Sx_top = Ix / denomTop;
  const Sx_bot = Ix / denomBot;
  const Sy_left = Iy / denomLeft;
  const Sy_right = Iy / denomRight;

  let Zx = 0;
  let Zy = 0;
  for (const it of items) {
    const dx = it.xg - xbar;
    const dy = it.yg - ybar;
    Zx += it.sign * (it.props.Zx + it.props.A * Math.abs(dy));
    Zy += it.sign * (it.props.Zy + it.props.A * Math.abs(dx));
  }

  const avg = (Ix + Iy) / 2;
  const diff = (Ix - Iy) / 2;
  const rEig = Math.sqrt(diff * diff + Ixy * Ixy);
  const I1 = avg + rEig;
  const I2 = avg - rEig;
  const alpha =
    Math.abs(Ixy) < 1e-12 && Math.abs(diff) < 1e-12
      ? 0
      : 0.5 * Math.atan2(-2 * Ixy, Ix - Iy);

  const safeA = Math.abs(A);
  const rx = Math.sqrt(Math.max(Ix / safeA, 0));
  const ry = Math.sqrt(Math.max(Iy / safeA, 0));
  const r1 = Math.sqrt(Math.max(I1 / safeA, 0));
  const r2 = Math.sqrt(Math.max(I2 / safeA, 0));

  const J = items.reduce((s, it) => s + it.sign * it.props.J, 0);

  // Qx_max: numerical integration across all sub-shapes above the global NA.
  // For each 'add' shape: Σ contribution; for 'subtract' shape: subtract.
  // This is a better approximation than summing operand-local Qx_max values,
  // which would be referenced to each operand's own NA (wrong for composites).
  const Qx_max = compositeQxMax(items, ybar);

  return {
    A,
    perimeter: items.reduce((s, it) => s + it.props.perimeter, 0),
    xbar,
    ybar,
    xMin,
    xMax,
    yMin,
    yMax,
    Ix,
    Iy,
    Ixy,
    Sx_top,
    Sx_bot,
    Sy_left,
    Sy_right,
    Zx,
    Zy,
    I1,
    I2,
    alpha,
    rx,
    ry,
    r1,
    r2,
    J,
    Cw: 0,
    Qx_max,
    shearCenterX: xbar,
    shearCenterY: ybar,
    outline: [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ],
    holes: [],
    subShapes,
  };
}

function subShapesFor(
  items: Array<{ props: SectionProperties; op: 'add' | 'subtract'; dx: number; dy: number }>
) {
  return items.map((it) => ({
    outline: it.props.outline.map((p) => ({ x: p.x + it.dx, y: p.y + it.dy })),
    op: it.op,
  }));
}

function compositeQxMax(
  items: Array<{ props: SectionProperties; sign: number; op: 'add' | 'subtract'; dx: number; dy: number }>,
  ybar: number
): number {
  let Q = 0;
  for (const it of items) {
    // Translate operand bbox to global
    const yLoOp = it.props.yMin + it.dy;
    const yHiOp = it.props.yMax + it.dy;
    if (yHiOp <= ybar) continue; // entirely below NA → doesn't contribute to Qx_max

    if (yLoOp >= ybar) {
      // Entirely above NA: full area × distance from centroid to NA
      const cy = it.props.ybar + it.dy;
      Q += it.sign * it.props.A * (cy - ybar);
    } else {
      // Straddles the NA — decompose the operand outline by sampling horizontally.
      // We approximate by integrating the outline width function above the NA.
      const upperA = areaAbove(it.props.outline, ybar - it.dy);
      const upperCy = centroidYAbove(it.props.outline, ybar - it.dy);
      if (upperA > 0) {
        // upperCy is in operand-local coords; translate to global frame for the
        // distance from the composite NA.
        const cyGlobal = upperCy + it.dy;
        Q += it.sign * upperA * (cyGlobal - ybar);
      }
    }
  }
  return Q;
}

// Area of the polygon region above horizontal line y = yCut, via even-odd clip.
// Uses the outline strip-by-strip between y-coordinate samples.
function areaAbove(outline: Point2D[], yCut: number): number {
  const n = outline.length;
  if (n < 3) return 0;
  const ys = Array.from(new Set(outline.map((p) => p.y).concat([yCut]))).sort((a, b) => a - b);
  let area = 0;
  for (let k = 0; k + 1 < ys.length; k++) {
    const y1 = ys[k];
    const y2 = ys[k + 1];
    if (y2 <= yCut) continue;
    const ymid = (y1 + y2) / 2;
    const lo = Math.max(y1, yCut);
    const w = horizontalExtent(outline, ymid);
    area += w * (y2 - lo);
  }
  return area;
}

function centroidYAbove(outline: Point2D[], yCut: number): number {
  const n = outline.length;
  if (n < 3) return 0;
  const ys = Array.from(new Set(outline.map((p) => p.y).concat([yCut]))).sort((a, b) => a - b);
  let areaSum = 0;
  let momentSum = 0;
  for (let k = 0; k + 1 < ys.length; k++) {
    const y1 = ys[k];
    const y2 = ys[k + 1];
    if (y2 <= yCut) continue;
    const lo = Math.max(y1, yCut);
    const ymid = (lo + y2) / 2;
    const strip = horizontalExtent(outline, (y1 + y2) / 2) * (y2 - lo);
    areaSum += strip;
    momentSum += strip * ymid;
  }
  return areaSum > 0 ? momentSum / areaSum : 0;
}

function horizontalExtent(outline: Point2D[], y: number): number {
  const crossings: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      const t = (y - a.y) / (b.y - a.y);
      crossings.push(a.x + t * (b.x - a.x));
    }
  }
  crossings.sort((c1, c2) => c1 - c2);
  let w = 0;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    w += crossings[i + 1] - crossings[i];
  }
  return w;
}
