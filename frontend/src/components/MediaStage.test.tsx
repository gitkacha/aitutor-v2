import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MediaStage from './MediaStage';

// W-127: the media stage renders an <iframe> for an embed, a <video> for an upload, and nothing when
// there's no media (so media-less lessons are unchanged).
describe('MediaStage', () => {
  it('renders an iframe for an embed', () => {
    const { container } = render(<MediaStage kind="embed" url="https://www.youtube.com/embed/abc123DEF45" />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123DEF45');
    expect(container.querySelector('video')).toBeNull();
  });

  it('renders a video for an upload', () => {
    const { container } = render(<MediaStage kind="upload" url="/api/media/mod1-123.mp4" />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/api/media/mod1-123.mp4');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders nothing without media', () => {
    expect(render(<MediaStage kind="none" url={null} />).container.firstChild).toBeNull();
    expect(render(<MediaStage />).container.firstChild).toBeNull();
  });
});
