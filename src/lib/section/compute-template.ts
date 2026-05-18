import type { Point2D, SectionProperties, TemplateParams } from './types';

// Rectangle decomposition (all axis-aligned). All inputs in mm.
interface Rect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// Number of segments for circular outlines (only affects rendering, not computed props).
const CIRCLE_SEGMENTS = 128;

export function computeTemplate(p: TemplateParams): SectionProperties {
  switch (p.kind) {
    case 'rectangular':
      return fromRects([{ xMin: 0, xMax: p.b, yMin: 0, yMax: p.h }], {
        outline: rectOutline(0, p.b, 0, p.h),
        holes: [],
        J: stVenantRectJ(Math.max(p.b, p.h), Math.min(p.b, p.h)),
        Cw: 0,
      });

    case 'hollow-rect': {
      const { B, H, tw, tf } = p;
      const rects: Rect[] = [
        { xMin: 0, xMax: B, yMin: 0, yMax: tf },
        { xMin: 0, xMax: B, yMin: H - tf, yMax: H },
        { xMin: 0, xMax: tw, yMin: tf, yMax: H - tf },
        { xMin: B - tw, xMax: B, yMin: tf, yMax: H - tf },
      ];
      const Am = (B - tw) * (H - tf);
      const J = (4 * Am * Am) / (2 * (B - tw) / tf + 2 * (H - tf) / tw);
      return fromRects(rects, {
        outline: rectOutline(0, B, 0, H),
        holes: [rectOutline(tw, B - tw, tf, H - tf).slice().reverse()],
        J,
        Cw: 0,
      });
    }

    case 'circular': {
      const { D } = p;
      const ro = D / 2;
      const A = (Math.PI * D * D) / 4;
      const I = (Math.PI * D ** 4) / 64;
      const S = (Math.PI * D ** 3) / 32;
      const Z = D ** 3 / 6;
      const r = D / 4;
      const J = (Math.PI * D ** 4) / 32;
      const Qx_max = (2 / 3) * ro ** 3;
      return closedCircular({
        A,
        Ix: I,
        Iy: I,
        Sx_top: S,
        Sx_bot: S,
        Sy_left: S,
        Sy_right: S,
        Zx: Z,
        Zy: Z,
        rx: r,
        ry: r,
        J,
        Cw: 0,
        Qx_max,
        outline: circleOutline(D / 2, D / 2, D / 2),
        holes: [],
        D,
        perimeter: Math.PI * D,
      });
    }

    case 'hollow-circ': {
      const { D, d } = p;
      const ro = D / 2;
      const ri = d / 2;
      const A = (Math.PI * (D * D - d * d)) / 4;
      const I = (Math.PI * (D ** 4 - d ** 4)) / 64;
      const S = (Math.PI * (D ** 4 - d ** 4)) / (32 * D);
      const Z = (D ** 3 - d ** 3) / 6;
      const r = Math.sqrt(I / A);
      const J = (Math.PI * (D ** 4 - d ** 4)) / 32;
      const Qx_max = (2 / 3) * (ro ** 3 - ri ** 3);
      return closedCircular({
        A,
        Ix: I,
        Iy: I,
        Sx_top: S,
        Sx_bot: S,
        Sy_left: S,
        Sy_right: S,
        Zx: Z,
        Zy: Z,
        rx: r,
        ry: r,
        J,
        Cw: 0,
        Qx_max,
        outline: circleOutline(D / 2, D / 2, D / 2),
        holes: [circleOutline(D / 2, D / 2, d / 2).slice().reverse()],
        D,
        perimeter: Math.PI * (D + d),
      });
    }

    case 'i-shape': {
      const { H, B, tw, tf } = p;
      const rects: Rect[] = [
        { xMin: 0, xMax: B, yMin: 0, yMax: tf },
        { xMin: 0, xMax: B, yMin: H - tf, yMax: H },
        { xMin: (B - tw) / 2, xMax: (B + tw) / 2, yMin: tf, yMax: H - tf },
      ];
      // St-Venant open-section J (Gere, Timoshenko): only the web BETWEEN
      // the two flanges contributes its full length → (H − 2·tf), not (H − tf).
      const J = (2 * B * tf ** 3 + (H - 2 * tf) * tw ** 3) / 3;
      // Cw for doubly-symmetric I (Timoshenko, Theory of Elastic Stability):
      // Cw = Iy · h²/4  where h is the distance between flange centerlines.
      const hCenterline = H - tf;
      const Cw = (tf * B ** 3 * hCenterline ** 2) / 24;
      return fromRects(rects, {
        outline: iShapeOutline(B, H, tw, tf),
        holes: [],
        J,
        Cw,
      });
    }

    case 't-shape': {
      const { H, B, tw, tf } = p;
      const rects: Rect[] = [
        { xMin: (B - tw) / 2, xMax: (B + tw) / 2, yMin: 0, yMax: H - tf },
        { xMin: 0, xMax: B, yMin: H - tf, yMax: H },
      ];
      const J = (B * tf ** 3 + (H - tf) * tw ** 3) / 3;
      // Shear center at the flange mid-plane (thin-walled open section).
      return fromRects(rects, {
        outline: tShapeOutline(B, H, tw, tf),
        holes: [],
        J,
        Cw: 0,
        shearCenterOverride: { x: B / 2, y: H - tf / 2 },
      });
    }

    case 'angle': {
      const { H, B, t } = p;
      const rects: Rect[] = [
        { xMin: 0, xMax: t, yMin: 0, yMax: H },
        { xMin: t, xMax: B, yMin: 0, yMax: t },
      ];
      const J = (H * t ** 3 + (B - t) * t ** 3) / 3;
      // Shear center at the intersection of leg midlines (thin-walled open section).
      return fromRects(rects, {
        outline: angleOutline(B, H, t),
        holes: [],
        J,
        Cw: 0,
        shearCenterOverride: { x: t / 2, y: t / 2 },
      });
    }

    case 'channel': {
      const { H, B, tw, tf } = p;
      const rects: Rect[] = [
        { xMin: 0, xMax: B, yMin: 0, yMax: tf },
        { xMin: 0, xMax: B, yMin: H - tf, yMax: H },
        { xMin: 0, xMax: tw, yMin: tf, yMax: H - tf },
      ];
      const J = (2 * B * tf ** 3 + (H - 2 * tf) * tw ** 3) / 3;
      // Cw for channel (Timoshenko):
      const b_ = B - tw / 2;
      const h_ = H - tf;
      const alpha = 1 / (2 + (h_ * tw) / (3 * b_ * tf));
      const Cw = (tf * b_ ** 3 * h_ ** 2 * (1 - 3 * alpha)) / 6 + (alpha ** 2 * h_ ** 3 * tw) / 6;
      // Shear center offset from web centerline (Timoshenko thin-walled):
      // e0 = 3·b²·tf / (6·b·tf + h·tw), measured outward from the web (opposite flanges).
      const e0 = (3 * b_ * b_ * tf) / (6 * b_ * tf + h_ * tw);
      return fromRects(rects, {
        outline: channelOutline(B, H, tw, tf),
        holes: [],
        J,
        Cw: Math.max(0, Cw),
        shearCenterOverride: { x: tw / 2 - e0, y: H / 2 },
      });
    }

    case 'box-girder': {
      const { B, H, tw, tf } = p;
      const rects: Rect[] = [
        { xMin: 0, xMax: B, yMin: 0, yMax: tf },
        { xMin: 0, xMax: B, yMin: H - tf, yMax: H },
        { xMin: 0, xMax: tw, yMin: tf, yMax: H - tf },
        { xMin: B - tw, xMax: B, yMin: tf, yMax: H - tf },
      ];
      const Am = (B - tw) * (H - tf);
      const J = (4 * Am * Am) / (2 * (B - tw) / tf + 2 * (H - tf) / tw);
      return fromRects(rects, {
        outline: rectOutline(0, B, 0, H),
        holes: [rectOutline(tw, B - tw, tf, H - tf).slice().reverse()],
        J,
        Cw: 0,
      });
    }
  }
}

// --- core: build full SectionProperties from rectangle decomposition ---

interface ShapeMeta {
  outline: Point2D[];
  holes: Point2D[][];
  J: number;
  Cw: number;
  shearCenterOverride?: Point2D;
}

function fromRects(rects: Rect[], meta: ShapeMeta): SectionProperties {
  const A = rects.reduce((s, r) => s + rectArea(r), 0);
  const xbar = rects.reduce((s, r) => s + rectArea(r) * rectCx(r), 0) / A;
  const ybar = rects.reduce((s, r) => s + rectArea(r) * rectCy(r), 0) / A;

  let Ix = 0;
  let Iy = 0;
  let Ixy = 0;
  for (const r of rects) {
    const w = r.xMax - r.xMin;
    const h = r.yMax - r.yMin;
    const a = w * h;
    const dx = rectCx(r) - xbar;
    const dy = rectCy(r) - ybar;
    Ix += (w * h ** 3) / 12 + a * dy * dy;
    Iy += (h * w ** 3) / 12 + a * dx * dx;
    Ixy += a * dx * dy;
  }

  const xMin = Math.min(...rects.map((r) => r.xMin));
  const xMax = Math.max(...rects.map((r) => r.xMax));
  const yMin = Math.min(...rects.map((r) => r.yMin));
  const yMax = Math.max(...rects.map((r) => r.yMax));

  const Sx_top = Ix / (yMax - ybar);
  const Sx_bot = Ix / (ybar - yMin);
  const Sy_left = Iy / (xbar - xMin);
  const Sy_right = Iy / (xMax - xbar);

  const Zx = plasticModulus(rects, A, 'x');
  const Zy = plasticModulus(rects, A, 'y');

  const { I1, I2, alpha } = principalAxes(Ix, Iy, Ixy);
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  const r1 = Math.sqrt(I1 / A);
  const r2 = Math.sqrt(I2 / A);

  // Q_x max at neutral axis y=ybar: Σ (area above NA) × (centroid of that area relative to NA).
  // Used for max transverse shear stress τ_max = V·Q/(I·t).
  let Qx_max = 0;
  for (const r of rects) {
    const w = r.xMax - r.xMin;
    if (r.yMax <= ybar) continue;
    if (r.yMin >= ybar) {
      const cy = (r.yMin + r.yMax) / 2;
      Qx_max += (r.yMax - r.yMin) * w * (cy - ybar);
    } else {
      // rect straddles NA — only the portion above y=ybar contributes
      const above = r.yMax - ybar;
      Qx_max += (w * above * above) / 2;
    }
  }

  const shearCenter = meta.shearCenterOverride ?? { x: xbar, y: ybar };

  return {
    A,
    perimeter: polygonPerimeter(meta.outline) + meta.holes.reduce((s, h) => s + polygonPerimeter(h), 0),
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
    J: meta.J,
    Cw: meta.Cw,
    Qx_max,
    shearCenterX: shearCenter.x,
    shearCenterY: shearCenter.y,
    outline: meta.outline,
    holes: meta.holes,
  };
}

function closedCircular(input: {
  A: number;
  Ix: number;
  Iy: number;
  Sx_top: number;
  Sx_bot: number;
  Sy_left: number;
  Sy_right: number;
  Zx: number;
  Zy: number;
  rx: number;
  ry: number;
  J: number;
  Cw: number;
  Qx_max: number;
  outline: Point2D[];
  holes: Point2D[][];
  D: number;
  perimeter: number;
}): SectionProperties {
  const { A, Ix, Iy, Zx, Zy, J, Cw, Qx_max, outline, holes, D, perimeter } = input;
  const { I1, I2, alpha } = principalAxes(Ix, Iy, 0);
  const r = Math.sqrt(Ix / A);
  return {
    A,
    perimeter,
    xbar: D / 2,
    ybar: D / 2,
    xMin: 0,
    xMax: D,
    yMin: 0,
    yMax: D,
    Ix,
    Iy,
    Ixy: 0,
    Sx_top: input.Sx_top,
    Sx_bot: input.Sx_bot,
    Sy_left: input.Sy_left,
    Sy_right: input.Sy_right,
    Zx,
    Zy,
    I1,
    I2,
    alpha,
    rx: r,
    ry: r,
    r1: r,
    r2: r,
    J,
    Cw,
    Qx_max,
    shearCenterX: D / 2,
    shearCenterY: D / 2,
    outline,
    holes,
  };
}

// --- math helpers ---

function rectArea(r: Rect) {
  return (r.xMax - r.xMin) * (r.yMax - r.yMin);
}

function rectCx(r: Rect) {
  return (r.xMin + r.xMax) / 2;
}

function rectCy(r: Rect) {
  return (r.yMin + r.yMax) / 2;
}

// Plastic modulus via PNA: splits area in half along given axis, computes sum of |distance|·dA.
function plasticModulus(rects: Rect[], A: number, axis: 'x' | 'y'): number {
  // For axis='x': PNA is horizontal, split by y. For 'y': PNA is vertical, split by x.
  const breaks = Array.from(
    new Set(rects.flatMap((r) => (axis === 'x' ? [r.yMin, r.yMax] : [r.xMin, r.xMax])))
  ).sort((a, b) => a - b);

  let cum = 0;
  let pna = breaks[0];
  for (let i = 0; i < breaks.length - 1; i++) {
    const v1 = breaks[i];
    const v2 = breaks[i + 1];
    const slabThickness = v2 - v1;
    const slabWidth = rects.reduce((s, r) => {
      const active = axis === 'x' ? r.yMin <= v1 && r.yMax >= v2 : r.xMin <= v1 && r.xMax >= v2;
      if (!active) return s;
      return s + (axis === 'x' ? r.xMax - r.xMin : r.yMax - r.yMin);
    }, 0);
    const slabArea = slabWidth * slabThickness;
    if (cum + slabArea >= A / 2 - 1e-9) {
      const needed = A / 2 - cum;
      pna = v1 + (slabWidth > 0 ? needed / slabWidth : 0);
      break;
    }
    cum += slabArea;
    pna = v2;
  }

  // Sum |distance from centroid of each sub-rect to PNA| · area
  let Q = 0;
  for (const r of rects) {
    const lo = axis === 'x' ? r.yMin : r.xMin;
    const hi = axis === 'x' ? r.yMax : r.xMax;
    const width = axis === 'x' ? r.xMax - r.xMin : r.yMax - r.yMin;

    if (hi <= pna) {
      const c = (lo + hi) / 2;
      Q += width * (hi - lo) * (pna - c);
    } else if (lo >= pna) {
      const c = (lo + hi) / 2;
      Q += width * (hi - lo) * (c - pna);
    } else {
      // Straddles — split into two at pna
      const cBelow = (lo + pna) / 2;
      const cAbove = (pna + hi) / 2;
      Q += width * (pna - lo) * (pna - cBelow);
      Q += width * (hi - pna) * (cAbove - pna);
    }
  }
  return Q;
}

function principalAxes(Ix: number, Iy: number, Ixy: number): { I1: number; I2: number; alpha: number } {
  const avg = (Ix + Iy) / 2;
  const diff = (Ix - Iy) / 2;
  const r = Math.sqrt(diff * diff + Ixy * Ixy);
  const I1 = avg + r;
  const I2 = avg - r;
  const alpha = Math.abs(Ixy) < 1e-12 && Math.abs(diff) < 1e-12 ? 0 : 0.5 * Math.atan2(-2 * Ixy, Ix - Iy);
  return { I1, I2, alpha };
}

// Saint-Venant approximation for rectangular torsion (b = long, h = short).
function stVenantRectJ(bLong: number, hShort: number): number {
  if (hShort <= 0 || bLong <= 0) return 0;
  const ratio = hShort / bLong;
  const beta = (1 / 3) - 0.21 * ratio * (1 - (ratio ** 4) / 12);
  return beta * bLong * hShort ** 3;
}

// --- outline generators (CCW) ---

function rectOutline(xMin: number, xMax: number, yMin: number, yMax: number): Point2D[] {
  return [
    { x: xMin, y: yMin },
    { x: xMax, y: yMin },
    { x: xMax, y: yMax },
    { x: xMin, y: yMax },
  ];
}

function circleOutline(cx: number, cy: number, r: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const t = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

function iShapeOutline(B: number, H: number, tw: number, tf: number): Point2D[] {
  const xL = (B - tw) / 2;
  const xR = (B + tw) / 2;
  return [
    { x: 0, y: 0 },
    { x: B, y: 0 },
    { x: B, y: tf },
    { x: xR, y: tf },
    { x: xR, y: H - tf },
    { x: B, y: H - tf },
    { x: B, y: H },
    { x: 0, y: H },
    { x: 0, y: H - tf },
    { x: xL, y: H - tf },
    { x: xL, y: tf },
    { x: 0, y: tf },
  ];
}

function tShapeOutline(B: number, H: number, tw: number, tf: number): Point2D[] {
  const xL = (B - tw) / 2;
  const xR = (B + tw) / 2;
  return [
    { x: xL, y: 0 },
    { x: xR, y: 0 },
    { x: xR, y: H - tf },
    { x: B, y: H - tf },
    { x: B, y: H },
    { x: 0, y: H },
    { x: 0, y: H - tf },
    { x: xL, y: H - tf },
  ];
}

function angleOutline(B: number, H: number, t: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: B, y: 0 },
    { x: B, y: t },
    { x: t, y: t },
    { x: t, y: H },
    { x: 0, y: H },
  ];
}

function channelOutline(B: number, H: number, tw: number, tf: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: B, y: 0 },
    { x: B, y: tf },
    { x: tw, y: tf },
    { x: tw, y: H - tf },
    { x: B, y: H - tf },
    { x: B, y: H },
    { x: 0, y: H },
  ];
}

function polygonPerimeter(pts: Point2D[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}
