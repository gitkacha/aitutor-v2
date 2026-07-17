// Structured visual stimulus spec (W-8). Stored as JSON in MathStimulusGroup.stimulus;
// plain prose strings remain valid and render as text. Keep in sync with
// backend/src/lib/stimulus.ts.

export interface TableFigure {
  kind: 'table';
  columns: string[];
  rows: (string | number)[][];
}

export interface GridFigure {
  kind: 'grid';
  rows: number;
  cols: number;
  filled?: [number, number][]; // [row, col], 0-indexed
  cellValues?: (string | number | null)[][];
  rowLabels?: string[];
  colLabels?: string[];
}

export interface ChartPoint {
  x: string | number;
  y: number;
}

export interface LineChartFigure {
  kind: 'line-chart';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  points: ChartPoint[];
}

export interface BarChartFigure {
  kind: 'bar-chart';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  points: ChartPoint[];
}

export interface PieSector {
  label: string;
  percent: number;
  showPercent?: boolean;
}

export interface PieChartFigure {
  kind: 'pie-chart';
  title?: string;
  sectors: PieSector[];
}

export interface ProtractorFigure {
  kind: 'protractor';
  rays: number[]; // degrees, 0–180 (0 = right end of the baseline)
  joinPairs?: [number, number][]; // chords between two ray angles (closes a triangle)
}

export interface CompassFigure {
  kind: 'compass';
  facing?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
}

export interface ShapeFigure {
  kind: 'shape';
  unit?: string; // e.g. 'cm'
  vertices: [number, number][]; // polygon, in unit coordinates, y up
  sideLabels?: { side: number; label: string }[]; // side i = vertices[i] -> vertices[i+1]
}

export type RotationShape = 'arrow' | 'L' | 'F' | 'T' | 'flag';

export interface RotationFigure {
  kind: 'rotation';
  shape: RotationShape;
  beforeDeg: number;
  afterDeg: number;
}

export interface CardsFigure {
  kind: 'cards';
  values: string[];
}

export type Figure =
  | TableFigure
  | GridFigure
  | LineChartFigure
  | BarChartFigure
  | PieChartFigure
  | ProtractorFigure
  | CompassFigure
  | ShapeFigure
  | RotationFigure
  | CardsFigure;

export interface StimulusSpec {
  version: 1;
  text?: string;
  figures: Figure[];
}

export const FIGURE_KINDS = [
  'table', 'grid', 'line-chart', 'bar-chart', 'pie-chart',
  'protractor', 'compass', 'shape', 'rotation', 'cards',
] as const;

const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ROTATION_SHAPES: RotationShape[] = ['arrow', 'L', 'F', 'T', 'flag'];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validFigure(f: any): boolean {
  if (!f || typeof f !== 'object' || typeof f.kind !== 'string') return false;
  switch (f.kind) {
    case 'table':
      return (
        Array.isArray(f.columns) && f.columns.length > 0 &&
        f.columns.every((c: unknown) => typeof c === 'string') &&
        Array.isArray(f.rows) && f.rows.length > 0 &&
        f.rows.every((r: unknown) => Array.isArray(r) && (r as unknown[]).length === f.columns.length)
      );
    case 'grid': {
      if (!Number.isInteger(f.rows) || !Number.isInteger(f.cols)) return false;
      if (f.rows < 1 || f.cols < 1 || f.rows > 30 || f.cols > 30) return false;
      if (f.filled !== undefined) {
        if (!Array.isArray(f.filled)) return false;
        if (!f.filled.every((c: any) =>
          Array.isArray(c) && c.length === 2 &&
          Number.isInteger(c[0]) && c[0] >= 0 && c[0] < f.rows &&
          Number.isInteger(c[1]) && c[1] >= 0 && c[1] < f.cols
        )) return false;
      }
      if (f.cellValues !== undefined) {
        if (!Array.isArray(f.cellValues) || f.cellValues.length !== f.rows) return false;
        if (!f.cellValues.every((r: any) => Array.isArray(r) && r.length === f.cols)) return false;
      }
      return true;
    }
    case 'line-chart':
    case 'bar-chart':
      return (
        Array.isArray(f.points) && f.points.length >= 2 &&
        f.points.every((p: any) => p && (typeof p.x === 'string' || isFiniteNumber(p.x)) && isFiniteNumber(p.y))
      );
    case 'pie-chart': {
      if (!Array.isArray(f.sectors) || f.sectors.length < 2) return false;
      if (!f.sectors.every((s: any) => s && typeof s.label === 'string' && isFiniteNumber(s.percent) && s.percent > 0)) {
        return false;
      }
      const total = f.sectors.reduce((sum: number, s: any) => sum + s.percent, 0);
      return Math.abs(total - 100) <= 1;
    }
    case 'protractor':
      return (
        Array.isArray(f.rays) && f.rays.length >= 1 && f.rays.length <= 8 &&
        f.rays.every((r: unknown) => isFiniteNumber(r) && (r as number) >= 0 && (r as number) <= 180) &&
        (f.joinPairs === undefined || (
          Array.isArray(f.joinPairs) &&
          f.joinPairs.every((p: any) =>
            Array.isArray(p) && p.length === 2 && p.every((d: unknown) => f.rays.includes(d))
          )
        ))
      );
    case 'compass':
      return f.facing === undefined || COMPASS_DIRECTIONS.includes(f.facing);
    case 'shape':
      return (
        Array.isArray(f.vertices) && f.vertices.length >= 3 &&
        f.vertices.every((v: any) => Array.isArray(v) && v.length === 2 && v.every(isFiniteNumber)) &&
        (f.sideLabels === undefined || (
          Array.isArray(f.sideLabels) &&
          f.sideLabels.every((s: any) =>
            s && Number.isInteger(s.side) && s.side >= 0 && s.side < f.vertices.length && typeof s.label === 'string'
          )
        ))
      );
    case 'rotation':
      return (
        ROTATION_SHAPES.includes(f.shape) &&
        isFiniteNumber(f.beforeDeg) && isFiniteNumber(f.afterDeg)
      );
    case 'cards':
      return Array.isArray(f.values) && f.values.length >= 2 &&
        f.values.every((v: unknown) => typeof v === 'string');
    default:
      return false;
  }
}

// Validates a stimulus object (already parsed). Returns true only for a well-formed spec.
export function validateStimulus(s: unknown): s is StimulusSpec {
  const spec = s as any;
  return (
    !!spec && typeof spec === 'object' &&
    spec.version === 1 &&
    (spec.text === undefined || typeof spec.text === 'string') &&
    Array.isArray(spec.figures) && spec.figures.length >= 1 && spec.figures.length <= 4 &&
    spec.figures.every(validFigure)
  );
}

// Parses a MathStimulusGroup.stimulus string: a valid JSON spec, or null (legacy prose).
export function parseStimulus(raw: string): StimulusSpec | null {
  if (!raw.trimStart().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    return validateStimulus(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
