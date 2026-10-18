import type { MatrixBlock, ScalarBlock, Solution, Step, StiffnessModel, VectorBlock } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE REPLAY: the displayed solution is self-consistent
 * ─────────────────────────────────────────────────────────────────────────────
 * Not part of the calculator (the name does not match the test glob). It recomputes EACH STEP from the data of the steps before it (and the model's
 * own loads, which are inputs) with plain loops of its own, and says by how much it differs from the step as printed, relative to the largest entry of
 * the block. So a student who redoes step 7 from steps 3 to 6 on a calculator gets the numbers on the page. It also EVALUATES THE SYMBOLIC
 * MATRICES: every entry that has a `symbolic` expression must equal that expression worked out from the scalars of the step ("12EI/L³" is 12·EI/L³).
 */

export interface Deviation {
  key: string;
  what: string;
  error: number;
}

type Mat = number[][];
const flat = (m: Mat | number[]): number[] => (Array.isArray(m[0]) ? (m as Mat).flat() : (m as number[]));

export function replay(sol: Solution, model: StiffnessModel, options: { settled?: boolean } = {}): Deviation[] {
  const out: Deviation[] = [];
  const get = (key: string): Step => {
    const s = sol.steps.find((x) => x.key === key);
    if (!s) throw new Error(`no step ${key}`);
    return s;
  };
  const has = (key: string) => sol.steps.some((x) => x.key === key);
  const mat = (key: string, name: string, tag?: string): MatrixBlock => {
    const b = get(key).blocks.find((x): x is MatrixBlock => x.type === 'matrix' && x.name === name && x.tag === tag);
    if (!b) throw new Error(`no matrix ${name} in ${key}`);
    return b;
  };
  const vec = (key: string, name: string, tag?: string): VectorBlock => {
    const b = get(key).blocks.find((x): x is VectorBlock => x.type === 'vector' && x.name === name && x.tag === tag);
    if (!b) throw new Error(`no vector ${name} in ${key}`);
    return b;
  };
  const sca = (key: string, name: string, tag?: string): number => {
    const b = get(key).blocks.find((x): x is ScalarBlock => x.type === 'scalar' && x.name === name && x.tag === tag);
    if (!b) throw new Error(`no scalar ${name} in ${key}`);
    return b.value;
  };
  const compare = (key: string, what: string, got: Mat | number[], want: Mat | number[], scaleOf?: number) => {
    const a = flat(got);
    const b = flat(want);
    if (a.length !== b.length) {
      out.push({ key, what: `${what}: length ${a.length} against ${b.length}`, error: Infinity });
      return;
    }
    const scale = Math.max(scaleOf ?? 0, ...a.map(Math.abs), ...b.map(Math.abs), 1e-300);
    let error = 0;
    for (let k = 0; k < a.length; k++) error = Math.max(error, Math.abs(a[k] - b[k]) / scale);
    out.push({ key, what, error });
  };
  const matmul = (a: Mat, b: Mat): Mat => a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
  const transpose = (a: Mat): Mat => (a.length === 0 ? [] : a[0].map((_, j) => a.map((row) => row[j])));
  const matvec = (a: Mat, v: number[]): number[] => a.map((row) => row.reduce((s, x, k) => s + x * v[k], 0));

  /* Stage 1: the inputs. */
  const frame = get('structure').facts.mode === 'frame';
  const nd = frame ? 3 : 2;
  const coords = mat('structure', 'coordinates').values;
  const conn = mat('structure', 'connectivity').values;
  const sections = mat('structure', 'sections').values;
  const restraints = mat('structure', 'restraints').values;
  const prescribedV = vec('structure', 'prescribed').values;
  const nn = coords.length;
  const N = nd * nn;
  const members = conn.length;
  const dofLabels = vec('structure', 'prescribed').labels;
  const codeOf = (k: number): number[] => {
    const i = conn[k][0] - 1;
    const j = conn[k][1] - 1;
    return [...Array.from({ length: nd }, (_, c) => nd * i + c + 1), ...Array.from({ length: nd }, (_, c) => nd * j + c + 1)];
  };
  compare('structure', 'dof numbers', mat('structure', 'dof-numbers').values, coords.map((_, n) => Array.from({ length: nd }, (__, c) => nd * n + c + 1)));
  const restrainedFlags = restraints.flat();
  const free = restrainedFlags.flatMap((r, d) => (r === 0 ? [d + 1] : []));
  const restrained = restrainedFlags.flatMap((r, d) => (r === 1 ? [d + 1] : []));
  const nF = free.length;
  const uR = restrained.map((d) => prescribedV[d - 1]);

  /* Stages 2–5: each member. */
  const kMat: Mat[] = [];
  const TMat: Mat[] = [];
  const KeMat: Mat[] = [];
  const geom: { L: number; c: number; s: number; EA: number; EI: number }[] = [];
  for (let k = 0; k < members; k++) {
    const key = (id: string) => `${id}#${k + 1}`;
    const i = conn[k][0] - 1;
    const j = conn[k][1] - 1;
    const dx = coords[j][0] - coords[i][0];
    const dy = coords[j][1] - coords[i][1];
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const E = sections[k][0];
    const A = sections[k][1];
    const I = frame ? sections[k][2] : 0;
    const EA = E * A;
    const EI = E * I;
    geom.push({ L, c, s, EA, EI });
    const g = key('geometry');
    for (const [name, want] of [['dx', dx], ['dy', dy], ['L', L], ['c', c], ['s', s], ['EA', EA], ['E', E], ['A', A]] as const) compare(g, name, [sca(g, name)], [want]);
    if (frame) {
      compare(g, 'EI', [sca(g, 'EI')], [EI]);
      compare(g, 'I', [sca(g, 'I')], [I]);
    }
    compare(g, 'angle', [sca(g, 'θ')], [(Math.atan2(dy, dx) * 180) / Math.PI], 1);
    compare(g, 'c² + s²', [c * c + s * s], [1]);

    // k: the printed matrix against its symbolic entries worked out
    const lk = key('local-stiffness');
    const kBlock = mat(lk, 'k');
    const terms: Record<string, number> = {
      '0': 0,
      'EA/L': EA / L,
      '−EA/L': -(EA / L),
      '12EI/L³': (12 * EI) / (L * L * L),
      '−12EI/L³': -((12 * EI) / (L * L * L)),
      '6EI/L²': (6 * EI) / (L * L),
      '−6EI/L²': -((6 * EI) / (L * L)),
      '4EI/L': (4 * EI) / L,
      '2EI/L': (2 * EI) / L,
    };
    const evalSym = (sym: string[][], table: Record<string, number>, name: string, k0: string, values: Mat) => {
      const want = sym.map((row) =>
        row.map((e) => {
          if (!(e in table)) throw new Error(`${name}: unknown term ${e}`);
          return table[e];
        }),
      );
      compare(k0, `${name} against its symbolic entries`, values, want);
    };
    evalSym(kBlock.symbolic!, terms, 'k', lk, kBlock.values);
    kMat.push(kBlock.values);
    compare(lk, 'EA/L', [sca(lk, 'EA/L')], [EA / L]);
    if (frame) {
      compare(lk, '12EI/L³', [sca(lk, '12EI/L³')], [(12 * EI) / (L * L * L)]);
      compare(lk, '4EI/L', [sca(lk, '4EI/L')], [(4 * EI) / L]);
    }
    // T
    const lt = key('transformation');
    const T = mat(lt, 'T');
    evalSym(T.symbolic!, { '0': 0, '1': 1, c, s, '−s': -s }, 'T', lt, T.values);
    TMat.push(T.values);
    // K_e = Tᵀ (k T)
    const lg = key('global-member');
    const kT = matmul(kBlock.values, T.values);
    compare(lg, 'kT = k T', mat(lg, 'kT').values, kT);
    const Ke = matmul(transpose(T.values), kT);
    compare(lg, 'K_e = T^T (k T)', mat(lg, 'K_e').values, Ke);
    KeMat.push(mat(lg, 'K_e').values);
    compare(lg, 'code', vec(lg, 'code').values, codeOf(k));
    if (!frame) {
      const closed = mat(lg, 'K_e_closed');
      const f = closed.factorValue!;
      compare(lg, 'factor', [f], [EA / L]);
      evalSym(closed.symbolic!, { 'c²': c * c, cs: c * s, '−c²': -(c * c), '−cs': -(c * s), 's²': s * s, '−s²': -(s * s) }, 'K_e closed (unit factor)', lg, closed.values.map((row) => row.map((v) => v / f)));
      compare(lg, 'closed form equals K_e', closed.values, mat(lg, 'K_e').values);
    }
  }

  /* Stage 6: the assembly. */
  let K: Mat = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const who: number[][][] = Array.from({ length: N }, () => Array.from({ length: N }, () => [] as number[]));
  for (let k = 0; k < members; k++) {
    const key = `assembly#${k + 1}`;
    const code = codeOf(k);
    const contribution: Mat = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    code.forEach((da, a) =>
      code.forEach((db, b) => {
        contribution[da - 1][db - 1] = mat(`global-member#${k + 1}`, 'K_e').values[a][b];
        who[da - 1][db - 1].push(k + 1);
      }),
    );
    compare(key, 'contribution', mat(key, 'contribution').values, contribution);
    K = K.map((row, a) => row.map((v, b) => v + contribution[a][b]));
    compare(key, 'running K', mat(key, 'running').values, K);
    // (the next member is added to the K as printed: a cell the arithmetic cannot tell from rounding is printed 0)
    K = mat(key, 'running').values.map((row) => row.slice());
    const marked = (mat(key, 'contribution').highlights ?? []).length;
    compare(key, 'cells', [marked], [code.length * code.length]);
  }
  compare('assembled', 'K', mat('assembled', 'K').values, K);
  {
    const marks = mat('assembled', 'K').highlights!;
    let wrong = 0;
    for (const h of marks) if (h.members!.join() !== who[h.row][h.col].join() || (h.members!.length > 1) !== (h.reason === 'shared')) wrong++;
    const expected = who.flat().filter((l) => l.length > 0).length;
    compare('assembled', 'who contributed', [wrong, marks.length], [0, expected]);
  }

  /* Stage 7: the loads. */
  const Pnodal = new Array<number>(N).fill(0);
  for (const l of model.loads) {
    Pnodal[nd * l.node] += l.fx;
    Pnodal[nd * l.node + 1] += l.fy;
    if (frame) Pnodal[nd * l.node + 2] += l.m;
  }
  compare('nodal-loads', 'P_nodal', vec('nodal-loads', 'P_nodal').values, Pnodal);
  const Pequiv = new Array<number>(N).fill(0);
  for (let k = 0; k < members; k++) {
    const key = `member-loads#${k + 1}`;
    if (!has(key)) continue;
    const step = get(key);
    const L = sca(key, 'L');
    const fefTable = (v: { w?: number; P?: number; a?: number; b?: number; q?: number }): Record<string, number> => {
      const { w = 0, P = 0, a = 0, b = 0, q = 0 } = v;
      return {
        '0': 0,
        '−wL/2': -(w * L) / 2,
        '−wL²/12': -(w * L * L) / 12,
        'wL²/12': (w * L * L) / 12,
        '−Pb²(3a+b)/L³': -(P * b * b * (3 * a + b)) / (L * L * L),
        '−Pab²/L²': -(P * a * b * b) / (L * L),
        '−Pa²(a+3b)/L³': -(P * a * a * (a + 3 * b)) / (L * L * L),
        'Pa²b/L²': (P * a * a * b) / (L * L),
        '−qL/2': -(q * L) / 2,
      };
    };
    let total = [0, 0, 0, 0, 0, 0];
    const tags = [...new Set(step.blocks.filter((b) => b.type === 'vector' && b.name === 'f_FE' && b.tag !== 'total').map((b) => b.tag!))];
    for (const tag of tags) {
      const kind = tag.split('#')[0];
      const v: { w?: number; P?: number; a?: number; b?: number; q?: number } = {};
      if (kind === 'udl') v.w = sca(key, 'w', tag);
      else if (kind === 'point') {
        v.P = sca(key, 'P', tag);
        v.a = sca(key, 'a', tag);
        v.b = sca(key, 'b', tag);
        compare(key, 'b = L − a', [v.b], [L - v.a]);
      } else v.q = sca(key, 'q', tag);
      const block = vec(key, 'f_FE', tag);
      const table = fefTable(v);
      const want = block.symbolic!.map((e) => {
        if (!(e in table)) throw new Error(`unknown fixed-end term ${e}`);
        return table[e];
      });
      compare(key, `f_FE ${tag} against its symbolic entries`, block.values, want);
      total = total.map((x, q) => x + block.values[q]);
    }
    compare(key, 'f_FE total', vec(key, 'f_FE', 'total').values, total);
    const global = matvec(transpose(TMat[k]), total);
    compare(key, 'f_FE global = T^T f_FE', vec(key, 'f_FE_global').values, global);
    const equivalent = global.map((x) => 0 - x);
    compare(key, 'equivalent = −f_FE_global', vec(key, 'equivalent').values, equivalent);
    codeOf(k).forEach((d, q) => {
      Pequiv[d - 1] += equivalent[q];
    });
  }
  const P = Pnodal.map((v, d) => v + Pequiv[d]);
  if (frame) compare('load-vector', 'P_equivalent', vec('load-vector', 'P_equivalent').values, Pequiv);
  compare('load-vector', 'P', vec('load-vector', 'P').values, P);

  /* Stages 8 and 9. */
  const pick = (rows: number[], cols: number[]): Mat => rows.map((r) => cols.map((c) => K[r - 1][c - 1]));
  const KFF = pick(free, free);
  const KFR = pick(free, restrained);
  const KRF = pick(restrained, free);
  const KRR = pick(restrained, restrained);
  const PF = free.map((d) => P[d - 1]);
  const PR = restrained.map((d) => P[d - 1]);
  compare('partition', 'K_FF', mat('partition', 'K_FF').values, KFF);
  compare('partition', 'K_FR', mat('partition', 'K_FR').values, KFR);
  compare('partition', 'K_RF', mat('partition', 'K_RF').values, KRF);
  compare('partition', 'K_RR', mat('partition', 'K_RR').values, KRR);
  compare('partition', 'P_F', vec('partition', 'P_F').values, PF);
  compare('partition', 'P_R', vec('partition', 'P_R').values, PR);
  compare('partition', 'u_R', vec('partition', 'u_R').values, uR);
  compare('partition', 'labels of the free DOFs', [mat('partition', 'K_FF').rowLabels.join('|') === free.map((d) => dofLabels[d - 1]).join('|') ? 0 : 1], [0]);
  const KFRuR = matvec(KFR, uR);
  const rhs = PF.map((v, k) => v - KFRuR[k]);
  compare('reduced', 'K_FR u_R', vec('reduced', 'K_FR·u_R').values, KFRuR);
  compare('reduced', 'rhs', vec('reduced', 'rhs').values, rhs);

  /* Stage 10: the elimination. */
  const recorded = get('solution').facts.recorded === true;
  let uF: number[];
  if (recorded && nF > 0) {
    let aug: Mat = KFF.map((row, i) => [...row, rhs[i]]);
    compare('augmented', '[K_FF | rhs]', mat('augmented', 'augmented').values, aug);
    for (let k = 0; k < nF - 1; k++) {
      const key = `forward-pass#${k + 1}`;
      const pivot = aug[k][k];
      const multipliers = aug.slice(k + 1).map((row) => row[k] / pivot);
      const next = aug.map((row) => row.slice());
      for (let i = k + 1; i < nF; i++) {
        for (let j = k + 1; j <= nF; j++) next[i][j] = aug[i][j] - multipliers[i - k - 1] * aug[k][j];
        next[i][k] = 0;
      }
      compare(key, 'pivot', [sca(key, 'pivot', `pass#${k + 1}`)], [pivot]);
      compare(key, 'multipliers', vec(key, 'multipliers', `pass#${k + 1}`).values, multipliers);
      compare(key, 'augmented matrix', mat(key, 'augmented', `pass#${k + 1}`).values, next);
      // The next pass is redone from the matrix AS PRINTED (an entry the arithmetic cannot tell from rounding is printed 0), the way a reader redoes it: so the last triangle
      // printed must give the unknowns printed.
      aug = mat(key, 'augmented', `pass#${k + 1}`).values.map((row) => row.slice());
    }
    uF = new Array<number>(nF).fill(0);
    for (let k = nF - 1; k >= 0; k--) {
      const sub = nF - k;
      const key = `back-substitution#${sub}`;
      let s = aug[k][nF];
      for (let j = k + 1; j < nF; j++) s -= aug[k][j] * uF[j];
      uF[k] = s / aug[k][k];
      compare(key, 'unknown', [Number(get(key).facts.value)], [uF[k]]);
      compare(key, 'known unknowns', vec(key, 'u', `unknown#${k + 1}`).values, uF.slice(k));
      compare(key, 'pivot', [sca(key, 'pivot', `unknown#${k + 1}`)], [aug[k][k]]);
    }
    compare('solution', 'u_F', vec('solution', 'u_F').values, uF);
  } else {
    uF = vec('solution', 'u_F').values;
    // Not recorded: the printed solution must at least satisfy the equations (below).
  }
  const residual = matvec(KFF, uF).map((v, k) => v - rhs[k]);
  if (!options.settled) {
    compare('solution', 'residual', vec('solution', 'residual').values, residual);
    compare('solution', 'max|residual|', [sca('solution', 'max|residual|')], [Math.max(0, ...residual.map(Math.abs))]);
  }
  // the equations are satisfied to rounding, whatever was recorded
  const eqScale = Math.max(1e-300, ...rhs.map(Math.abs), ...KFF.flat().map(Math.abs).map((v) => v * Math.max(0, ...uF.map(Math.abs))));
  compare('solution', 'the printed u_F satisfies K_FF u_F = rhs', residual, residual.map(() => 0), eqScale);

  /* Stages 11 and 12. */
  const u = new Array<number>(N).fill(0);
  free.forEach((d, k) => (u[d - 1] = uF[k]));
  restrained.forEach((d, k) => (u[d - 1] = uR[k]));
  compare('displacements', 'u', vec('displacements', 'u').values, u);
  const KRFuF = matvec(KRF, uF);
  const KRRuR = matvec(KRR, uR);
  const R = restrained.map((_, k) => KRFuF[k] + KRRuR[k] - PR[k]);
  compare('reactions', 'K_RF u_F', vec('reactions', 'K_RF·u_F').values, KRFuF);
  compare('reactions', 'K_RR u_R', vec('reactions', 'K_RR·u_R').values, KRRuR);
  compare('reactions', 'P_R', vec('reactions', 'P_R').values, PR);
  compare('reactions', 'R', vec('reactions', 'R').values, R);

  /* Stage 13: the member end forces. */
  const f: number[][] = [];
  for (let k = 0; k < members; k++) {
    const key = `end-forces#${k + 1}`;
    const ue = codeOf(k).map((d) => u[d - 1]);
    const ul = matvec(TMat[k], ue);
    const fk = matvec(kMat[k], ul);
    compare(key, 'u_e', vec(key, 'u_e').values, ue);
    compare(key, 'u_local = T u_e', vec(key, 'u_local').values, ul);
    compare(key, 'k u_local', vec(key, 'k·u_local').values, fk);
    let fv = fk;
    if (frame && has(`member-loads#${k + 1}`)) {
      const fe = vec(`member-loads#${k + 1}`, 'f_FE', 'total').values;
      compare(key, 'f_FE', vec(key, 'f_FE').values, fe);
      fv = fk.map((v, q) => v + fe[q]);
    }
    compare(key, 'f', vec(key, 'f').values, fv);
    f.push(fv);
    if (frame) {
      const ends = mat(key, 'ends').values;
      compare(key, 'N, V, M at the ends', ends, [
        [0 - fv[0], fv[3]],
        [fv[1], 0 - fv[4]],
        [0 - fv[2], fv[5]],
      ]);
    } else {
      compare(key, 'N', [sca(key, 'N')], [fv[1]]);
      compare(key, 'σ = N/A', [sca(key, 'σ')], [fv[1] / sections[k][1]]);
      compare(key, 'δ = u_j − u_i', [sca(key, 'δ')], [ul[1] - ul[0]]);
      // (N L/EA is worked out another way: against the size of the displacements, which is what its rounding is)
      compare(key, 'δ = N L/EA', [sca(key, 'δ')], [(fv[1] * geom[k].L) / geom[k].EA], Math.max(Math.abs(ul[0]), Math.abs(ul[1])));
    }
  }

  /* Stage 14: the checks (the printed numbers are settled in the settled solution, so these are only for the raw one). */
  if (!options.settled) {
    const key = 'checks';
    const aboutX = Number(get(key).facts.aboutX);
    const aboutY = Number(get(key).facts.aboutY);
    const Rfull = new Array<number>(N).fill(0);
    restrained.forEach((d, k) => (Rfull[d - 1] = R[k]));
    const onJoint = new Array<number>(N).fill(0);
    for (let k = 0; k < members; k++) {
      const fg = matvec(transpose(TMat[k]), f[k]);
      codeOf(k).forEach((d, q) => (onJoint[d - 1] += fg[q]));
    }
    const joint = Pnodal.map((v, d) => v + Rfull[d] - onJoint[d]);
    compare(key, 'joint', vec(key, 'joint').values, joint);
    const Ku = matvec(K, u);
    compare(key, 'K u − P − R', vec(key, 'K·u − P − R').values, Ku.map((v, d) => v - P[d] - Rfull[d]));
    const U = 0.5 * u.reduce((s, v, d) => s + v * Ku[d], 0);
    const W = 0.5 * u.reduce((s, v, d) => s + v * P[d], 0) + 0.5 * restrained.reduce((s, d, k) => s + u[d - 1] * R[k], 0);
    compare(key, 'U', [sca(key, 'U')], [U]);
    compare(key, 'W', [sca(key, 'W')], [W]);
    // the sums, from the loads' own definitions
    let sx = 0;
    let sy = 0;
    let sm = 0;
    const at = (n: number) => coords[n];
    for (const l of model.loads) {
      sx += l.fx;
      sy += l.fy;
      sm += (at(l.node)[0] - aboutX) * l.fy - (at(l.node)[1] - aboutY) * l.fx + (frame ? l.m : 0);
    }
    if (frame) {
      for (const l of model.memberLoads) {
        const g = geom[l.member];
        const a = at(conn[l.member][0] - 1);
        let t = g.L / 2;
        let fx = 0;
        let fy = 0;
        if (l.kind === 'udl') fy = l.w * g.L;
        else if (l.kind === 'point') {
          fy = l.P;
          t = l.a;
        } else fx = l.q * g.L;
        const gx = g.c * fx - g.s * fy;
        const gy = g.s * fx + g.c * fy;
        sx += gx;
        sy += gy;
        sm += (a[0] + g.c * t - aboutX) * gy - (a[1] + g.s * t - aboutY) * gx;
      }
    }
    restrained.forEach((d, k) => {
      const node = Math.floor((d - 1) / nd);
      const kind = (d - 1) % nd;
      if (kind === 0) {
        sx += R[k];
        sm -= (at(node)[1] - aboutY) * R[k];
      } else if (kind === 1) {
        sy += R[k];
        sm += (at(node)[0] - aboutX) * R[k];
      } else sm += R[k];
    });
    const scale = Number(get(key).facts.scale);
    compare(key, 'ΣFx', [sca(key, 'ΣFx')], [sx], scale);
    compare(key, 'ΣFy', [sca(key, 'ΣFy')], [sy], scale);
    compare(key, 'ΣM', [sca(key, 'ΣM')], [sm], scale * Number(get(key).facts.size));
  }
  return out;
}
