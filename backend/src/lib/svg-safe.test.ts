import { describe, it, expect } from 'vitest';
import { sanitizeAnimationSvg } from './svg-safe';

// W-128: AI-authored animation SVG is rendered to students, so it must pass a strict allow-list.
// sanitizeAnimationSvg returns the cleaned SVG or null (rejected). This is the security core.
const CLEAN = `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="40" height="40" fill="#1c6dd0">
    <animate attributeName="x" from="10" to="260" dur="2s" repeatCount="indefinite"/>
  </rect>
  <text x="160" y="100" text-anchor="middle" font-size="14">24 × 5 = 120</text>
</svg>`;

describe('sanitizeAnimationSvg', () => {
  it('accepts a clean animated SVG and keeps the <animate> element', () => {
    const out = sanitizeAnimationSvg(CLEAN);
    expect(out).not.toBeNull();
    expect(out).toContain('<svg');
    expect(out).toContain('viewBox');
    expect(out).toContain('<animate');
  });

  it('extracts the <svg> even when the model wraps it in prose/code fences', () => {
    const wrapped = 'Here is your animation:\n```svg\n' + CLEAN + '\n```\nEnjoy!';
    expect(sanitizeAnimationSvg(wrapped)).not.toBeNull();
  });

  it('rejects a <script> tag', () => {
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>')).toBeNull();
  });

  it('rejects inline event handlers', () => {
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><rect onload="alert(1)" width="5" height="5"/></svg>')).toBeNull();
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10" onclick="x()"><rect width="5" height="5"/></svg>')).toBeNull();
  });

  it('rejects foreignObject / iframe / image and external references', () => {
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><foreignObject><body>hi</body></foreignObject></svg>')).toBeNull();
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><image href="https://evil.example.com/x.png"/></svg>')).toBeNull();
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><rect width="5" height="5"/></a></svg>')).toBeNull();
  });

  it('rejects a disallowed tag and a non-SVG / viewBox-less root', () => {
    expect(sanitizeAnimationSvg('<svg viewBox="0 0 10 10"><video src="x"/></svg>')).toBeNull();
    expect(sanitizeAnimationSvg('<div>not an svg</div>')).toBeNull();
    expect(sanitizeAnimationSvg('<svg><rect width="5" height="5"/></svg>')).toBeNull(); // no viewBox
    expect(sanitizeAnimationSvg('')).toBeNull();
  });
});
