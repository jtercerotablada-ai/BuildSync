// Standard rebar sizes — nominal diameter (mm) and area (mm²).
// ASTM A615 imperial bars (#3..#18) and CSA/ISO metric bars.

export interface RebarBar {
  id: string;
  label: string;
  diameter: number; // mm
  area: number; // mm²
}

export const REBAR_ASTM: RebarBar[] = [
  { id: '#3', label: '#3 (10M)', diameter: 9.5, area: 71 },
  { id: '#4', label: '#4 (13M)', diameter: 12.7, area: 129 },
  { id: '#5', label: '#5 (16M)', diameter: 15.9, area: 199 },
  { id: '#6', label: '#6 (19M)', diameter: 19.1, area: 284 },
  { id: '#7', label: '#7 (22M)', diameter: 22.2, area: 387 },
  { id: '#8', label: '#8 (25M)', diameter: 25.4, area: 510 },
  { id: '#9', label: '#9 (29M)', diameter: 28.7, area: 645 },
  { id: '#10', label: '#10 (32M)', diameter: 32.3, area: 819 },
  { id: '#11', label: '#11 (36M)', diameter: 35.8, area: 1006 },
  { id: '#14', label: '#14 (43M)', diameter: 43.0, area: 1452 },
  { id: '#18', label: '#18 (57M)', diameter: 57.3, area: 2581 },
];

export function findBar(id: string): RebarBar | undefined {
  return REBAR_ASTM.find((b) => b.id === id);
}
