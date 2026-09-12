// W-128: AI-authored lesson animations are SVG that we render inline to students, so they are a
// potential XSS vector. `sanitizeAnimationSvg` is a strict server-side gate: it extracts the SVG and
// returns it ONLY if it uses a safe drawing + SMIL-animation subset with no scripts, event handlers,
// or external/dangerous references. DOMPurify on the client is the second, authoritative gate.

// Elements the animation may use (lowercased — SVG tag names are matched case-insensitively here).
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'style',
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop',
  'animate', 'animatetransform', 'animatemotion', 'mpath', 'set',
]);

// Any of these → reject outright.
const DANGER = [
  /<script/i,
  /\son[a-z]+\s*=/i, // inline event handlers (onload=, onclick=, …)
  /javascript:/i,
  /(?:xlink:)?href\s*=\s*["']\s*(?!#)/i, // href that isn't a local #fragment (external image/use/link)
  /@import/i,
  /\burl\(\s*(?!#)/i, // external CSS url() (url(#grad) internal refs are allowed)
  /expression\s*\(/i,
];

export function sanitizeAnimationSvg(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // Pull the SVG out of any surrounding prose / code fences.
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  const svg = match[0].trim();

  // Root must be <svg …> carrying a viewBox (keeps it self-contained and correctly scaled).
  const openTag = svg.match(/<svg[^>]*>/i)?.[0] ?? '';
  if (!/\bviewBox\s*=/i.test(openTag)) return null;

  if (DANGER.some((re) => re.test(svg))) return null;

  // Every tag must be on the allow-list (rejects script/foreignObject/iframe/image/video/use/a/…).
  const tags = svg.match(/<\/?\s*([a-zA-Z][\w:-]*)/g) ?? [];
  for (const t of tags) {
    const name = t.replace(/[<\/\s]/g, '').toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return null;
  }

  return svg;
}
