// W-88: deterministic correctness check for grid → compass-direction questions.
//
// The grid stimulus renders rowLabels TOP-TO-BOTTOM (first label at the top), and the app's fixed
// convention is North = top of the figure. So the true direction between two cells is computed
// purely geometrically — no LLM in the loop — and any generated question whose key disagrees (or
// whose move isn't a single well-defined direction) is discarded. This closes the class of bug
// where the text invented a row-numbering ("bottom to top") that contradicts the rendered grid.

const COMPASS = new Set([
  'north', 'south', 'east', 'west',
  'north-east', 'north-west', 'south-east', 'south-west',
  'northeast', 'northwest', 'southeast', 'southwest',
]);

function normDir(s: string): string {
  return s.toLowerCase().replace(/[\s-]+/g, '').trim();
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface GridFigure {
  kind: string;
  rowLabels?: unknown;
  colLabels?: unknown;
}

// 'ok' — key matches the geometry; 'wrong' — key disagrees or the move is ambiguous (discard);
// 'na' — not a grid→compass question we can adjudicate (fall back to the normal pipeline).
export function checkGridCompassDirection(q: {
  questionText: string;
  options: string[];
  correctIndex: number;
  stimulus?: { figures?: GridFigure[] } | null;
}): 'ok' | 'wrong' | 'na' {
  const answer = q.options?.[q.correctIndex];
  // Must be a compass-direction question.
  const compassOpts = (q.options || []).filter((o) => COMPASS.has(normDir(o)));
  if (compassOpts.length < 3 || !answer || !COMPASS.has(normDir(answer))) return 'na';

  // Must have a grid figure with labelled rows and columns.
  const grid = q.stimulus?.figures?.find((f) => f?.kind === 'grid');
  const colLabels = Array.isArray(grid?.colLabels) ? (grid!.colLabels as unknown[]).map(String) : null;
  const rowLabels = Array.isArray(grid?.rowLabels) ? (grid!.rowLabels as unknown[]).map(String) : null;
  if (!colLabels || !rowLabels || colLabels.length === 0 || rowLabels.length === 0) return 'na';

  // Parse an ordered start → end pair of cells (colLabel + rowLabel), e.g. "from D3 to B5".
  const colPat = colLabels.map(escapeRe).join('|');
  const rowPat = rowLabels.map(escapeRe).join('|');
  const cell = `(${colPat})\\s?(${rowPat})`;
  const text = q.questionText;
  const m =
    new RegExp(`from\\s+${cell}\\s+to\\s+${cell}`, 'i').exec(text) ||
    new RegExp(`${cell}\\s+to\\s+${cell}`, 'i').exec(text);
  if (!m) return 'na'; // can't confidently order the cells → leave to the normal pipeline

  const ci = (c: string) => colLabels.findIndex((x) => x.toUpperCase() === c.toUpperCase());
  const ri = (r: string) => rowLabels.findIndex((x) => x === r);
  const startCol = ci(m[1]), startRow = ri(m[2]), endCol = ci(m[3]), endRow = ri(m[4]);
  if ([startCol, startRow, endCol, endRow].some((i) => i < 0)) return 'na';

  const dCol = endCol - startCol; // >0 East, <0 West
  const dRow = endRow - startRow; // >0 South (down the figure), <0 North (up)
  if (dCol === 0 && dRow === 0) return 'na';

  const ns = dRow > 0 ? 'south' : dRow < 0 ? 'north' : '';
  const ew = dCol > 0 ? 'east' : dCol < 0 ? 'west' : '';
  // A "single compass direction" must be exactly cardinal or exactly diagonal.
  if (ns && ew && Math.abs(dCol) !== Math.abs(dRow)) return 'wrong';
  const expected = [ns, ew].filter(Boolean).join('');

  return normDir(answer) === expected ? 'ok' : 'wrong';
}
