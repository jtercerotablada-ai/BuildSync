/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — the section and material presets
 * ─────────────────────────────────────────────────────────────────────────────
 * Every number here is TYPICAL. A cable's modulus and weight are the manufacturer's
 * (a wire rope's "effective modulus" depends on the construction, the lay, the
 * pre-stretch and the load range), and the page says so beside the presets. They are
 * starting points, each editable; editing one turns the preset into 'custom'.
 *
 * THE TRAP, and why it is spelled out here. A wire rope's EFFECTIVE modulus is NOT
 * steel's. Steel is 29,000 ksi (200 GPa); a 6×19 / 6×36 rope with a steel core behaves
 * like 14,500 ksi (100 GPa, about HALF of steel's) because its wires lie on helices and
 * its core is not all load-carrying; a spiral strand 21,800 ksi (150 GPa); a
 * locked-coil strand 23,200 ksi (160 GPa); only a straight 7-wire strand (28,500 ksi) is
 * nearly steel. And the rope's modulus is quoted ON ITS METALLIC AREA, which is a
 * fraction of the circle of its nominal diameter. So a preset is four numbers that go
 * together:
 *
 *   E      the modulus on the METALLIC area (ksi, GPa).
 *   alpha  the thermal coefficient, 10⁻⁶ per °F / per °C.
 *   gamma  the unit weight of the metal (lb/ft³, kN/m³).
 *   fill   metallic area ÷ the circle of the nominal diameter: A = fill · π·d²/4.
 *   lay    weight per length ÷ (gamma · metallic area): 1 for a bar or a strand,
 *          more for a rope (lay of the wires lengthens them; lubricant and the
 *          core). A rope's weight per length comes from its OWN mass, not from
 *          steel's density times the nominal area: w = gamma · A · lay.
 *
 * WHERE EACH COMES FROM, AND HOW SURE (the report of the build lists the same):
 *   steel            E 29,000 ksi (AISC 360); alpha 6.5e-6 /°F (AISC / ASCE: 6.5e-6 /°F =
 *                    11.7e-6 /°C); 490 lb/ft³ (AISC; 7,850 kg/m³ = 77.0 kN/m³). Sure.
 *   stainless        E 28,000 ksi (≈ 193 GPa: ASTM A276 / EN 10088 austenitic 190–200 GPa);
 *                    alpha 9.2e-6 /°F = 16.6e-6 /°C (304/316 sources span 8.9–9.6e-6 /°F;
 *                    SCI Design Manual for Structural Stainless Steel gives 16–17e-6 /°C);
 *                    500 lb/ft³ (8,000 kg/m³ = 78.5 kN/m³). Sure to ±3 % (alpha ±5 %).
 *   aluminum         E 10,000 ksi (69 GPa: 6061-T6 is 10,000 ksi, ADM); alpha 13.0e-6 /°F
 *                    = 23.4e-6 /°C (6061-T6 data sheets: 13.1e-6 /°F = 23.6e-6 /°C);
 *                    169 lb/ft³ (2,700 kg/m³ = 26.5 kN/m³). Sure.
 *   strand           7-wire prestressing strand, ASTM A416: E 28,500 ksi (PCI; 196 GPa,
 *                    Eurocode 2 gives 195); a 0.5 in strand has 0.153 in² of steel in a
 *                    circle of 0.196 in² (fill 0.78) and weighs 0.52 lb/ft = 490 lb/ft³ ×
 *                    0.153 in² (lay 1). The fill checks on 0.6 in (0.217 / 0.283 = 0.77).
 *                    Confident.
 *   rope             6×19 / 6×36 wire rope with an independent wire rope core (IWRC),
 *                    TYPICAL: E 14,500 ksi (100 GPa) on the metallic area. EN 1993-1-11:2006
 *                    Table 3.1 gives 100 ± 10 GPa for a rope with a steel core (fibre core
 *                    80 ± 10, spiral strand 150 ± 10, locked coil 160 ± 10); the Hanes Supply
 *                    wire rope guide quotes 6×19 IWRC at 13,500 ksi for loads of 0–20 % of the
 *                    breaking load and 15,000 ksi for 21–65 %, and a working rope is usually at
 *                    20–40 %: so the upper bracket, range 13,000–15,500 ksi. The modulus of a
 *                    rope is a SECANT value over a load range, and a new rope that is not
 *                    pre-stretched is softer. It is about HALF of steel's. Fill 0.527 (metallic
 *                    area 0.414·d², EN 1993-1-11 Annex C: 0.414 for 6×19, 0.455 for 6×36 with
 *                    an IWRC; breaking-strength tables agree); lay 1.25, so that
 *                    w = 490 lb/ft³ × 0.414 d² × 1.25 ≈ 1.76·d² lb/ft (d in inches), the
 *                    published weight of IWRC 6×19 (Unirope: 1 in 1.76 lb/ft, 1/2 in 0.44).
 *                    (1.60·d² is the weight of a FIBRE-core rope.) MEDIUM confidence
 *                    (±10 % on fill and lay, ±10 % on E).
 *   spiral           round-wire spiral strand: E 21,800 ksi (150 GPa, EN 1993-1-11 Table 3.1,
 *                    150 ± 10; range 20,000–23,200 ksi, and 20,000 is a floor, not typical);
 *                    metallic area 0.58·d² (EN Annex C), fill 0.75; lay 1.04. LOW-MEDIUM
 *                    confidence: it depends on the pre-stretch (a prestretched strand is up to
 *                    10 % stiffer).
 *   locked           full-locked-coil strand: E 23,200 ksi (160 GPa, EN 1993-1-11 Table 3.1,
 *                    160 ± 10; range 21,800–24,700 ksi); metallic area 0.66·d² (EN Annex C),
 *                    fill 0.84; lay 1.05. LOW-MEDIUM confidence, as the spiral strand.
 * Use the manufacturer's values; the page says so.
 */

export type MaterialId = 'steel' | 'stainless' | 'aluminum' | 'strand' | 'rope' | 'spiral' | 'locked' | 'custom';
export type ListedMaterial = Exclude<MaterialId, 'custom'>;

export interface MaterialPreset {
  /** The modulus on the metallic area: ksi, GPa. */
  E: { us: number; si: number };
  /** 10⁻⁶ per °F, 10⁻⁶ per °C. */
  alpha: { us: number; si: number };
  /** lb/ft³, kN/m³. */
  gamma: { us: number; si: number };
  fill: number;
  lay: number;
  /** The range the references quote for E, in ksi (a hint for the page; not enforced). */
  range: [number, number];
}

const STEEL_ALPHA = { us: 6.5, si: 11.7 };
const STEEL_GAMMA = { us: 490, si: 77 };

export const CABLE_MATERIALS: Record<ListedMaterial, MaterialPreset> = {
  steel: { E: { us: 29000, si: 200 }, alpha: STEEL_ALPHA, gamma: STEEL_GAMMA, fill: 1, lay: 1, range: [28500, 29500] },
  stainless: { E: { us: 28000, si: 193 }, alpha: { us: 9.2, si: 16.6 }, gamma: { us: 500, si: 78.5 }, fill: 1, lay: 1, range: [27500, 29000] },
  aluminum: { E: { us: 10000, si: 69 }, alpha: { us: 13, si: 23.4 }, gamma: { us: 169, si: 26.6 }, fill: 1, lay: 1, range: [9900, 10200] },
  strand: { E: { us: 28500, si: 196 }, alpha: STEEL_ALPHA, gamma: STEEL_GAMMA, fill: 0.78, lay: 1, range: [28000, 29000] },
  rope: { E: { us: 14500, si: 100 }, alpha: STEEL_ALPHA, gamma: STEEL_GAMMA, fill: 0.527, lay: 1.25, range: [13000, 15500] },
  spiral: { E: { us: 21800, si: 150 }, alpha: STEEL_ALPHA, gamma: STEEL_GAMMA, fill: 0.75, lay: 1.04, range: [20000, 23200] },
  locked: { E: { us: 23200, si: 160 }, alpha: STEEL_ALPHA, gamma: STEEL_GAMMA, fill: 0.84, lay: 1.05, range: [21800, 24700] },
};

export const MATERIAL_IDS: readonly MaterialId[] = ['steel', 'stainless', 'aluminum', 'strand', 'rope', 'spiral', 'locked', 'custom'];
