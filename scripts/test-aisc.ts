import { findAISC, searchAISC, aiscToSectionProperties, getAllAISC } from '../src/lib/section/aisc-loader';
import { fromSI } from '../src/lib/beam/units';

const G = '\x1b[32m',
  R = '\x1b[31m',
  N = '\x1b[0m';
let pass = 0,
  fail = 0;

function test(label: string, cond: boolean, msg?: string) {
  if (cond) {
    pass++;
    console.log(`${G}✓${N} ${label}`);
  } else {
    fail++;
    console.log(`${R}✗${N} ${label} ${msg ?? ''}`);
  }
}

const w14x22 = findAISC('W14X22');
test('findAISC finds W14X22', w14x22 !== null);
test('W14X22 weight = 22', w14x22?.weight === 22);
test('W14X22 Ix = 199', w14x22?.Ix === 199);

const props = aiscToSectionProperties(w14x22!);
const IxImp = fromSI(props.Ix, 'I', 'imperial');
test(`W14X22 → SI → imperial Ix round-trip (${IxImp.toFixed(2)} ≈ 199)`, Math.abs(IxImp - 199) < 0.01);

const AImp = fromSI(props.A, 'A', 'imperial');
test(`W14X22 A round-trip (${AImp.toFixed(4)} ≈ 6.49)`, Math.abs(AImp - 6.49) < 0.001);

const search1 = searchAISC('W14', 'W');
test(`searchAISC 'W14' family=W returns ${search1.length} results`, search1.length > 0);
test(
  'searchAISC results all start with W14',
  search1.every((e) => e.designation.startsWith('W14'))
);

const search2 = searchAISC('HSS8', 'HSS-R');
test(`searchAISC 'HSS8' family=HSS-R returns ${search2.length} results`, search2.length > 0);

const search3 = searchAISC('PIPE6', 'Pipe');
test(`searchAISC 'PIPE6' family=Pipe finds Pipe6Std (${search3.length})`, search3.length > 0);

const all = getAllAISC();
test(`getAllAISC returns ${all.length} sections (expect >100)`, all.length > 100);

const families = new Set(all.map((e) => e.family));
test(`Families: ${[...families].join(', ')}`, families.size >= 6);

console.log(`\nResult: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
