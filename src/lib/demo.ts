import fixture from "./demo-fixture.json";
import auditFixture from "./demo-audit.json";
import type { Cell, CellOp, Grid } from "./tracker";
import type { Merge } from "./sheets";

type Store = { real: Grid; prep: Grid };
export interface DemoTab { grid: Grid; merges: Merge[] }
export interface DemoAudit { q: Record<string, DemoTab>; m: DemoTab }
const g = globalThis as unknown as { __gvDemo?: Record<string, Store>; __gvAud?: DemoAudit };

export function demoStore(product = "gv"): Store {
  g.__gvDemo ??= {};
  if (!g.__gvDemo[product]) {
    const s = JSON.parse(JSON.stringify(fixture)) as Store;
    if (product !== "gv") { // second product: one EP only
      const hr = 4;
      for (let c = 8; c < (s.real[hr]?.length ?? 0); c++) s.real[hr][c] = null;
      s.real[hr][6] = { v: "Gita Ardiansyah" }; s.real[6][6] = { v: "01. Gita Ardiansyah" };
      for (let c = 3; c < (s.prep[9]?.length ?? 0); c++) s.prep[9][c] = null;
      s.prep[9][2] = { v: "Gita Ardiansyah" };
    }
    g.__gvDemo[product] = s;
  }
  return g.__gvDemo[product];
}

export function applyToGrid(grid: Grid, ops: CellOp[]) {
  for (const o of ops) {
    while (grid.length <= o.row) grid.push([]);
    const row = grid[o.row];
    while (row.length <= o.col) row.push(null);
    const prev: Cell = row[o.col];
    if (o.kind === "bool") row[o.col] = { v: o.value ? "TRUE" : "FALSE", b: o.value };
    else if (o.kind === "text") row[o.col] = { v: o.text };
    else row[o.col] = { v: o.text, l: o.url, b: prev?.b };
  }
}

export function demoApply(ops: CellOp[], product = "gv") {
  const s = demoStore(product);
  applyToGrid(s.real, ops.filter((o) => o.tab === "real"));
  applyToGrid(s.prep, ops.filter((o) => o.tab === "prep"));
}

export function demoAudit(): DemoAudit {
  return (g.__gvAud ??= JSON.parse(JSON.stringify(auditFixture)) as DemoAudit);
}
