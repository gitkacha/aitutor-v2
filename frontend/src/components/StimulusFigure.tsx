import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import type {
  Figure, GridFigure, ProtractorFigure, CompassFigure, ShapeFigure,
  RotationFigure, RotationShape, FoldCutFigure, TargetFigure, PieChartFigure,
} from '@/lib/stimulus';

// W-130: caption explaining a pie slice's 5%-block breakdown (shown on hover in interactive lessons).
// Only decomposes into blocks when the percent is a clean multiple of 5.
export function blocksLabel(name: string, percent: number): string {
  if (percent > 0 && percent % 5 === 0) {
    const n = percent / 5;
    return `${name} — ${percent}% = ${n} block${n === 1 ? '' : 's'} of 5%`;
  }
  return `${name} — ${percent}%`;
}

// W-130: the pie chart. In lessons (`interactive`), hovering a slice highlights it and captions its
// 5%-block breakdown, reverting on mouse-out. In tests/questions (default), it's the static chart.
function PieFigure({ f, interactive, compact }: { f: PieChartFigure; interactive?: boolean; compact?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const data = f.sectors.map((s) => ({ name: s.label, value: s.percent, show: s.showPercent !== false }));
  const hovered = interactive && active != null ? f.sectors[active] : null;
  // Compact: a wider box + smaller radius (more room around the pie) so outer slice labels aren't clipped.
  return (
    <div className={compact ? 'w-full max-w-[320px]' : 'w-full max-w-md'}>
      {f.title && <p className="text-sm font-medium text-gray-700 text-center mb-1">{f.title}</p>}
      <ResponsiveContainer width="100%" height={compact ? 170 : 240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={compact ? 62 : 80}
            isAnimationActive={!!interactive && !compact}
            activeIndex={interactive && active != null ? active : undefined}
            activeShape={interactive ? (props: any) => <Sector {...props} outerRadius={props.outerRadius + 8} /> : undefined}
            onMouseEnter={interactive ? (_: unknown, i: number) => setActive(i) : undefined}
            onMouseLeave={interactive ? () => setActive(null) : undefined}
            // Compact: no outer labels (they clip in a small pie) — a legend below carries name + %.
            label={compact ? false : (entry: any) => (entry.show ? `${entry.name}, ${entry.value}%` : entry.name)}
          >
            {f.sectors.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {compact && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-600">
          {f.sectors.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              {s.label} {s.percent}%
            </span>
          ))}
        </div>
      )}
      {interactive && (
        <p className="min-h-[20px] text-center text-sm font-medium text-brand-blue" aria-live="polite">
          {hovered ? blocksLabel(hovered.label, hovered.percent) : (
            <span className="font-normal text-gray-400">Hover a slice to see its 5% blocks</span>
          )}
        </p>
      )}
    </div>
  );
}

// Renders one structured stimulus figure (W-8). Charts use Recharts; geometric
// figures (protractor, compass, shape, rotation) are deterministic parametric SVG —
// the model supplies numbers, never drawings.

const PIE_COLORS = ['#94a3b8', '#334155', '#cbd5e1', '#64748b', '#e2e8f0', '#475569'];

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function Grid({ f }: { f: GridFigure }) {
  const filled = new Set((f.filled || []).map(([r, c]) => `${r},${c}`));
  return (
    <div className="inline-flex flex-col items-center gap-1">
      {/* W-88: anchor North to the top of the grid so direction questions are unambiguous. */}
      <div className="flex items-center gap-0.5 text-xs font-semibold text-gray-500" aria-label="North is up">
        <span>N</span>
        <span aria-hidden="true">↑</span>
      </div>
      <table className="border-collapse">
      {f.colLabels && (
        <thead>
          <tr>
            {f.rowLabels && <th />}
            {f.colLabels.map((l, i) => (
              <th key={i} className="w-9 h-7 text-xs font-semibold text-gray-600 text-center">{l}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {Array.from({ length: f.rows }, (_, r) => (
          <tr key={r}>
            {f.rowLabels && (
              <th className="w-9 h-9 text-xs font-semibold text-gray-600 text-center pr-1">{f.rowLabels[r]}</th>
            )}
            {Array.from({ length: f.cols }, (_, c) => (
              <td
                key={c}
                className={`w-9 h-9 border border-gray-400 text-center text-sm text-gray-800 ${
                  filled.has(`${r},${c}`) ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                {f.cellValues?.[r]?.[c] ?? ''}
              </td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

function Protractor({ f }: { f: ProtractorFigure }) {
  const cx = 170;
  const cy = 160;
  const R = 130;
  const ticks = [];
  for (let d = 0; d <= 180; d += 5) {
    const major = d % 10 === 0;
    const [x1, y1] = polar(cx, cy, R, d);
    const [x2, y2] = polar(cx, cy, R - (major ? 12 : 7), d);
    ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth={major ? 1.2 : 0.6} />);
    if (d % 20 === 0) {
      const [tx, ty] = polar(cx, cy, R - 24, d);
      ticks.push(
        <text key={`t${d}`} x={tx} y={ty + 3} fontSize="9" fill="#334155" textAnchor="middle">{d}</text>
      );
    }
  }
  const rayEnd = (deg: number) => polar(cx, cy, R + 24, deg);
  return (
    <svg width="360" height="200" viewBox="0 0 340 185" role="img" aria-label="Protractor figure">
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} Z`}
        fill="#f8fafc"
        stroke="#475569"
        strokeWidth="1.5"
      />
      {ticks}
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#475569" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={3} fill="#1c6dd0" />
      {f.rays.map((deg) => {
        const [x, y] = rayEnd(deg);
        return <line key={deg} x1={cx} y1={cy} x2={x} y2={y} stroke="#1c6dd0" strokeWidth="2" />;
      })}
      {(f.joinPairs || []).map(([a, b], i) => {
        const [x1, y1] = rayEnd(a);
        const [x2, y2] = rayEnd(b);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1c6dd0" strokeWidth="2" />;
      })}
    </svg>
  );
}

const COMPASS_ANGLES: Record<string, number> = {
  E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315,
};

function Compass({ f }: { f: CompassFigure }) {
  const cx = 100;
  const cy = 100;
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="Compass figure">
      <circle cx={cx} cy={cy} r={80} fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
      {Object.entries(COMPASS_ANGLES).map(([dir, deg]) => {
        const major = ['N', 'E', 'S', 'W'].includes(dir);
        const [x1, y1] = polar(cx, cy, major ? 80 : 60, deg);
        const [lx, ly] = polar(cx, cy, 93, deg);
        return (
          <g key={dir}>
            <line x1={cx} y1={cy} x2={x1} y2={y1} stroke="#94a3b8" strokeWidth={major ? 1.5 : 0.8} />
            <text x={lx} y={ly + 4} fontSize="11" fontWeight={major ? 700 : 400} fill="#334155" textAnchor="middle">
              {dir}
            </text>
          </g>
        );
      })}
      {f.facing && (() => {
        const [x, y] = polar(cx, cy, 65, COMPASS_ANGLES[f.facing]);
        return (
          <g>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#1c6dd0" strokeWidth="3" markerEnd="url(#compass-arrow)" />
            <defs>
              <marker id="compass-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" fill="#1c6dd0" />
              </marker>
            </defs>
          </g>
        );
      })()}
    </svg>
  );
}

function Shape({ f }: { f: ShapeFigure }) {
  const xs = f.vertices.map((v) => v[0]);
  const ys = f.vertices.map((v) => v[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 40;
  const scale = Math.min(260 / Math.max(maxX - minX, 1), 200 / Math.max(maxY - minY, 1));
  const px = (x: number) => pad + (x - minX) * scale;
  const py = (y: number) => pad + (maxY - y) * scale; // flip: spec is y-up
  const pointsAttr = f.vertices.map(([x, y]) => `${px(x)},${py(y)}`).join(' ');
  const w = pad * 2 + (maxX - minX) * scale;
  const h = pad * 2 + (maxY - minY) * scale;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Shape figure">
      <polygon points={pointsAttr} fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
      {(f.sideLabels || []).map(({ side, label }, i) => {
        const a = f.vertices[side];
        const b = f.vertices[(side + 1) % f.vertices.length];
        const mx = px((a[0] + b[0]) / 2);
        const my = py((a[1] + b[1]) / 2);
        // Push the label outward from the polygon's centroid so it clears the edge.
        const cx0 = px(xs.reduce((s, v) => s + v, 0) / xs.length);
        const cy0 = py(ys.reduce((s, v) => s + v, 0) / ys.length);
        const dx = mx - cx0;
        const dy = my - cy0;
        const len = Math.max(Math.hypot(dx, dy), 1);
        return (
          <text
            key={i}
            x={mx + (dx / len) * 16}
            y={my + (dy / len) * 16 + 4}
            fontSize="11"
            fill="#334155"
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// Fixed, deliberately asymmetric outlines on a 100×100 canvas, drawn pointing "up".
const ROTATION_PATHS: Record<RotationShape, string> = {
  arrow: 'M50 10 L75 40 L60 40 L60 85 L40 85 L40 40 L25 40 Z',
  L: 'M35 15 L55 15 L55 65 L80 65 L80 85 L35 85 Z',
  F: 'M35 15 L80 15 L80 33 L55 33 L55 45 L75 45 L75 63 L55 63 L55 85 L35 85 Z',
  T: 'M25 15 L75 15 L75 35 L60 35 L60 85 L40 85 L40 35 L25 35 Z',
  flag: 'M40 15 L80 30 L40 45 L40 85 L30 85 L30 15 Z',
};

function RotatedShape({ shape, deg, label }: { shape: RotationShape; deg: number; label: string }) {
  return (
    <svg width="110" height="110" viewBox="0 0 100 100" role="img" aria-label={label}>
      <path d={ROTATION_PATHS[shape]} fill="#e2e8f0" stroke="#475569" strokeWidth="2" transform={`rotate(${deg} 50 50)`} />
    </svg>
  );
}

function Rotation({ f }: { f: RotationFigure }) {
  return (
    <div className="flex items-center gap-4">
      <RotatedShape shape={f.shape} deg={f.beforeDeg} label="Shape before rotation" />
      <span className="text-2xl text-gray-500" aria-hidden>→</span>
      <RotatedShape shape={f.shape} deg={f.afterDeg} label="Shape after rotation" />
    </div>
  );
}

// W-92: a square folded `foldCount` times with a single cut — rendered as the folded square with
// dashed fold lines and the cut mark, so the reader can reason about the unfolded holes.
function CutMark({ cx, cy, r, shape }: { cx: number; cy: number; r: number; shape: FoldCutFigure['cutShape'] }) {
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#111827" strokeWidth={2} />;
  if (shape === 'square') return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#fff" stroke="#111827" strokeWidth={2} />;
  const pts = shape === 'diamond'
    ? `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
    : `${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`; // triangle
  return <polygon points={pts} fill="#fff" stroke="#111827" strokeWidth={2} />;
}
function FoldCut({ f }: { f: FoldCutFigure }) {
  const S = 120, pad = 8;
  // Cut position within the folded square.
  const pos = f.cut === 'centre' ? [S / 2, S / 2] : f.cut === 'corner' ? [S - pad - 14, pad + 14] : [S / 2, pad + 14];
  // Fold lines: alternate vertical/horizontal as folds accumulate (visual cue only).
  const lines = [];
  if (f.foldCount >= 1) lines.push(<line key="v" x1={S / 2} y1={pad} x2={S / 2} y2={S - pad} stroke="#9ca3af" strokeDasharray="4 3" />);
  if (f.foldCount >= 2) lines.push(<line key="h" x1={pad} y1={S / 2} x2={S - pad} y2={S / 2} stroke="#9ca3af" strokeDasharray="4 3" />);
  if (f.foldCount >= 3) lines.push(<line key="v2" x1={S / 4} y1={pad} x2={S / 4} y2={S - pad} stroke="#d1d5db" strokeDasharray="3 3" />);
  if (f.foldCount >= 4) lines.push(<line key="h2" x1={pad} y1={S / 4} x2={S - pad} y2={S / 4} stroke="#d1d5db" strokeDasharray="3 3" />);
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      <rect x={pad} y={pad} width={S - pad * 2} height={S - pad * 2} fill="#f9fafb" stroke="#111827" strokeWidth={2} />
      {lines}
      <CutMark cx={pos[0]} cy={pos[1]} r={10} shape={f.cutShape} />
    </svg>
  );
}

// W-92: concentric-ring target with the rings' point values (outermost→bullseye) and the darts.
function Target({ f }: { f: TargetFigure }) {
  const cx = 90, cy = 90, maxR = 80;
  const n = f.rings.length;
  const ringR = (i: number) => maxR - (i * maxR) / n; // i=0 outer boundary … i=n innermost
  const dartXY = (ringIdx: number, k: number) => {
    const rOuter = ringR(ringIdx), rInner = ringR(ringIdx + 1);
    const r = (rOuter + rInner) / 2;
    const ang = (k * 2 * Math.PI) / 3 + ringIdx * 0.8; // spread darts around
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  return (
    <svg width={180} height={200} viewBox="0 0 180 200">
      {f.rings.map((val, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={ringR(i)} fill={i % 2 ? '#eef2f7' : '#fff'} stroke="#374151" strokeWidth={1.5} />
          <text x={cx} y={cy - (ringR(i) + ringR(i + 1)) / 2 + 4} textAnchor="middle" fontSize={11} fill="#6b7280">{val}</text>
        </g>
      ))}
      {f.darts.map((ringIdx, k) => {
        const [x, y] = dartXY(ringIdx, k);
        return <circle key={k} cx={x} cy={y} r={4} fill="#1c6dd0" />;
      })}
    </svg>
  );
}

export default function StimulusFigure({ figure, interactive, compact }: { figure: Figure; interactive?: boolean; compact?: boolean }) {
  const body = (() => {
    switch (figure.kind) {
      case 'table':
        return (
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                {figure.columns.map((c, i) => (
                  <th key={i} className="border border-gray-400 bg-gray-100 px-3 py-1.5 font-semibold text-gray-800">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {figure.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className="border border-gray-400 px-3 py-1.5 text-gray-800 text-center">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'grid':
        return <Grid f={figure} />;
      case 'line-chart':
      case 'bar-chart': {
        const data = figure.points.map((p) => ({ x: String(p.x), y: p.y }));
        return (
          <div className={compact ? 'w-full max-w-[340px]' : 'w-full max-w-xl'}>
            {figure.title && <p className="text-sm font-medium text-gray-700 text-center mb-1">{figure.title}</p>}
            <ResponsiveContainer width="100%" height={compact ? 170 : 230}>
              {figure.kind === 'line-chart' ? (
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 18, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} label={figure.xLabel ? { value: figure.xLabel, position: 'insideBottom', offset: -12, fontSize: 11 } : undefined} />
                  <YAxis tick={{ fontSize: 11 }} label={figure.yLabel ? { value: figure.yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined} />
                  <Line type="linear" dataKey="y" stroke="#1c6dd0" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              ) : (
                <BarChart data={data} margin={{ top: 5, right: 20, bottom: 18, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} label={figure.xLabel ? { value: figure.xLabel, position: 'insideBottom', offset: -12, fontSize: 11 } : undefined} />
                  <YAxis tick={{ fontSize: 11 }} label={figure.yLabel ? { value: figure.yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined} />
                  <Bar dataKey="y" fill="#1c6dd0" isAnimationActive={false} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        );
      }
      case 'pie-chart':
        return <PieFigure f={figure} interactive={interactive} compact={compact} />;
      case 'protractor':
        return <Protractor f={figure} />;
      case 'compass':
        return <Compass f={figure} />;
      case 'shape':
        return <Shape f={figure} />;
      case 'rotation':
        return <Rotation f={figure} />;
      case 'cards':
        return (
          <div className="flex flex-wrap gap-2">
            {figure.values.map((v, i) => (
              <span key={i} className="inline-flex items-center justify-center min-w-14 px-3 py-4 rounded-lg border-2 border-gray-400 bg-white text-gray-800 font-semibold text-sm">
                {v}
              </span>
            ))}
          </div>
        );
      case 'fold-cut':
        return <FoldCut f={figure} />;
      case 'target':
        return <Target f={figure} />;
    }
  })();

  return (
    <div data-testid={`stimulus-${figure.kind}`} className="flex justify-center py-2">
      {body}
    </div>
  );
}
