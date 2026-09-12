import { describe, it, expect } from 'vitest';
import { normalizeEmbed } from './media-embed';

// W-126: embedded lesson videos are restricted to a YouTube/Vimeo allow-list and normalised to their
// player-embed URL, so we never inject an iframe from an unknown host.
describe('normalizeEmbed', () => {
  it('maps YouTube watch / youtu.be / shorts / embed links to the embed URL', () => {
    expect(normalizeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(normalizeEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    // extra query params are tolerated, id extracted
    expect(normalizeEmbed('https://www.youtube.com/watch?v=abc123DEF45&t=30s')).toBe('https://www.youtube.com/embed/abc123DEF45');
  });

  it('maps Vimeo links to the player embed URL', () => {
    expect(normalizeEmbed('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(normalizeEmbed('https://player.vimeo.com/video/76979871')).toBe('https://player.vimeo.com/video/76979871');
  });

  it('returns null for unsupported or malformed links', () => {
    expect(normalizeEmbed('https://evil.example.com/embed/xyz')).toBeNull();
    expect(normalizeEmbed('javascript:alert(1)')).toBeNull();
    expect(normalizeEmbed('not a url')).toBeNull();
    expect(normalizeEmbed('')).toBeNull();
    expect(normalizeEmbed('https://www.youtube.com/watch?v=')).toBeNull();
  });
});
