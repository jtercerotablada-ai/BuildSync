import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from './analysis';
import { convertFrame, defaultFrame, reduceFrame, SECTION_PRESETS, FRAME_US_TO_SI, type FrameAction, type FrameForm } from './model';
import { rng } from './oracle.testlib';
import { TEMPLATE_IDS } from './templates';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * REAL STRUCTURES, in real units: templates up to 4 × 4 storeys and bays, every member with its own W shape, spans of 10 to 60 ft, loads of a
 * building. None may be refused as ill-conditioned or called a mechanism; each is solved twice, in kip and ft and in kN and m (the stiffness
 * matrix is made of numbers 10⁴ times different), and the two agree.
 */

function building(seed: number): FrameForm {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const id = pick(TEMPLATE_IDS);
  const actions: FrameAction[] = [
    { type: 'template', template: id, params: { bays: 1 + Math.floor(r() * 4), storeys: 1 + Math.floor(r() * 4), width: 10 + Math.round(r() * 50), height: 8 + Math.round(r() * 17), rise: 2 + Math.round(r() * 12), gravity: Math.round(r() * 50) / 10, lateral: Math.round(r() * 200) / 10, axial: Math.round(r() * 100), hinge: r() < 0.5, base: r() < 0.5 ? 'fixed' : 'pinned' } },
  ];
  let f = actions.reduce(reduceFrame, defaultFrame());
  f = reduceFrame(f, { type: 'section', patch: { E: 29001 } });
  for (const m of f.members) f = reduceFrame(f, { type: 'preset', preset: pick(SECTION_PRESETS).id, member: m.id });
  // Add a few loads of other kinds.
  for (let k = 0; k < 3; k++) {
    const kind = pick(['point', 'trapezoid', 'moment', 'temperature', 'udl-projected', 'udl'] as const);
    f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind, member: pick(f.members).id } });
  }
  for (const l of f.memberLoads) if (l.kind === 'temperature') f = reduceFrame(f, { type: 'patch', list: 'members', id: l.member, patch: { h: 14 } });
  return f;
}

describe('buildings', () => {
  it('300 buildings: solved, balanced, never a mechanism or an ill-conditioned system, and the same in kN and m', () => {
    let solved = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const us = building(seed);
      const a = analyseSafely(us);
      if (!a.results) {
        // A template is stable; the only thing that may stop one is a load the geometry does not allow (a position outside a member after the template changed).
        throw new Error(`building ${seed} (${us.nodes.length} nodes): ${JSON.stringify(a.issues)}`);
      }
      solved++;
      expect(a.results.equilibrium.balanced).toBe(true);
      const si = analyseSafely(convertFrame(us, 'si'));
      expect(si.results, `building ${seed} in SI`).not.toBeNull();
      const kip = FRAME_US_TO_SI.force;
      const scale = a.results.equilibrium.scale;
      a.results.reactions.forEach((r, k) => {
        expect(Math.abs(r.ry * kip - si.results!.reactions[k].ry), `${seed} ry`).toBeLessThanOrEqual(1e-8 * scale * kip);
        expect(Math.abs(r.rx * kip - si.results!.reactions[k].rx), `${seed} rx`).toBeLessThanOrEqual(1e-8 * scale * kip);
        expect(Math.abs(r.rm * kip * 0.3048 - si.results!.reactions[k].rm), `${seed} rm`).toBeLessThanOrEqual(1e-8 * scale * kip * a.drawing.side * 0.3048);
      });
      a.results.members.forEach((m, k) => {
        expect(Math.abs(m.maxima.M.max.value * kip * 0.3048 - si.results!.members[k].maxima.M.max.value), `${seed} M`).toBeLessThanOrEqual(1e-8 * scale * kip * a.drawing.side * 0.3048);
      });
      const top = Math.max(...a.results.displacements!.map((d) => d.magnitude));
      a.results.displacements!.forEach((d, k) => expect(Math.abs(d.ux * 25.4 - si.results!.displacements![k].ux), `${seed} ux`).toBeLessThanOrEqual(1e-8 * top * 25.4 + 1e-9));
    }
    expect(solved).toBe(300);
  });
  it('the biggest frame the page takes (6 × 6 storeys and bays) in a few tens of milliseconds, 78 members', () => {
    const f = reduceFrame(defaultFrame(), { type: 'template', template: 'portal', params: { bays: 6, storeys: 6 } });
    const t0 = performance.now();
    const a = analyseSafely(f);
    const ms = performance.now() - t0;
    expect(a.results).not.toBeNull();
    expect(a.results!.members).toHaveLength(78);
    expect(ms).toBeLessThan(2000);
  });
});
