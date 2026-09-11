// W-127: the lesson media stage — a 16:9 frame showing the admin-attached video. An `embed` renders
// a provider iframe (the URL is already normalised to a YouTube/Vimeo embed on the server, W-126); an
// `upload` renders a <video>. Renders nothing when there's no media, so media-less lessons are
// unchanged. Shared by the student player and the admin editor preview.
export default function MediaStage({ kind, url }: { kind?: 'none' | 'upload' | 'embed'; url?: string | null }) {
  if (!url || !kind || kind === 'none') return null;
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
