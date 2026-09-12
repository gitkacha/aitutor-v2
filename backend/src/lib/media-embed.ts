// W-126: lesson "embed" media is restricted to a small provider allow-list (YouTube + Vimeo) and
// normalised to the provider's player-embed URL. Anything else returns null and is rejected by the
// route — so the app never renders an iframe pointing at an unknown/attacker-controlled host.

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^\d{5,15}$/;

function youtubeEmbed(id: string): string | null {
  return YT_ID.test(id) ? `https://www.youtube.com/embed/${id}` : null;
}
function vimeoEmbed(id: string): string | null {
  return VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : null;
}

export function normalizeEmbed(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  // YouTube
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') return youtubeEmbed(u.searchParams.get('v') ?? '');
    if (parts[0] === 'shorts' || parts[0] === 'embed') return youtubeEmbed(parts[1] ?? '');
    return null;
  }
  if (host === 'youtu.be') {
    return youtubeEmbed(parts[0] ?? '');
  }

  // Vimeo
  if (host === 'player.vimeo.com') {
    // .../video/<id>
    return vimeoEmbed(parts[parts.length - 1] ?? '');
  }
  if (host === 'vimeo.com') {
    return vimeoEmbed(parts[0] ?? '');
  }

  return null;
}
