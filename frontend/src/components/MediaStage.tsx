import DOMPurify from 'dompurify';

// W-127/W-128: the lesson media stage — a 16:9 frame showing the admin-attached media. `embed`
// renders a provider iframe (URL already normalised server-side); `upload` renders a <video>;
// `animation` renders an AI-generated SVG. The SVG is DOMPurify-sanitised here — the authoritative
// client-side gate (the server allow-list is the first gate) — so no script/handler survives.
// Renders nothing when there's no media, so media-less lessons are unchanged.

// SMIL animation tags/attributes DOMPurify's SVG profile doesn't include by default.
const SMIL_TAGS = ['animate', 'animateTransform', 'animateMotion', 'mpath', 'set'];
const SMIL_ATTRS = [
  'attributeName', 'attributeType', 'from', 'to', 'by', 'values', 'dur', 'begin', 'end',
  'repeatCount', 'repeatDur', 'fill', 'calcMode', 'keyTimes', 'keySplines', 'additive',
  'accumulate', 'restart', 'type', 'path', 'rotate', 'origin', 'href',
];

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: SMIL_TAGS,
    ADD_ATTR: SMIL_ATTRS,
  });
}

export default function MediaStage({
  kind,
  url,
  svg,
}: {
  kind?: 'none' | 'upload' | 'embed' | 'animation';
  url?: string | null;
  svg?: string | null;
}) {
  if (!kind || kind === 'none') return null;
  if (kind === 'animation') {
    if (!svg) return null;
    return (
      <div
        className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white aspect-video [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
      />
    );
  }
  if (!url) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-black aspect-video">
      {kind === 'embed' ? (
        <iframe
          src={url}
          title="Lesson video"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={url} controls className="h-full w-full" />
      )}
    </div>
  );
}
