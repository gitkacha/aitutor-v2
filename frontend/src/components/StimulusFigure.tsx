import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import type {
  Figure, GridFigure, ProtractorFigure, CompassFigure, ShapeFigure,
  RotationFigure, RotationShape,
} from '@/lib/stimulus';

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

export default function StimulusFigure({ figure }: { figure: Figure }) {
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
          <div className="w-full max-w-xl">
            {figure.title && <p className="text-sm font-medium text-gray-700 text-center mb-1">{figure.title}</p>}
            <ResponsiveContainer width="100%" height={230}>
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
        return (
          <div className="w-full max-w-md">
            {figure.title && <p className="text-sm font-medium text-gray-700 text-center mb-1">{figure.title}</p>}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={figure.sectors.map((s) => ({ name: s.label, value: s.percent, show: s.showPercent !== false }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  isAnimationActive={false}
                  label={(entry: any) => (entry.show ? `${entry.name}, ${entry.value}%` : entry.name)}
                >
                  {figure.sectors.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
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
    }
  })();

  return (
    <div data-testid={`stimulus-${figure.kind}`} className="flex justify-center py-2">
      {body}
    </div>
  );
}
