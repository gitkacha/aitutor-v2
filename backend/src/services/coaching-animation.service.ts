import { providerFor, chatCompletion } from './ai.service';
import { sanitizeAnimationSvg } from '../lib/svg-safe';

// W-128: generate a short looping teaching animation as a self-contained, sanitised SVG (the
// "lighter alternative" — deterministic, exact numbers, no video pipeline). The model authors SMIL
// animation; `sanitizeAnimationSvg` is the hard security gate (one retry if it's rejected).

// An animated SVG is verbose (many elements/attributes) and gpt-5-mini also spends budget on
// reasoning, so give it comfortable headroom — 6000 truncated to empty content in practice (W-128).
const ANIMATION_MAX_TOKENS = 12000;

function animationPrompt(skillName: string, concept: string, feedback?: string): string {
  const retry = feedback ? `\nYour previous attempt was REJECTED: ${feedback}\nReturn a corrected SVG.\n` : '';
  return `You are creating a short looping animation that teaches an 11-year-old ONE idea for the NSW Selective High School Placement Test.

Skill: ${skillName}
The idea to animate (from the lesson's "Building Block" section — translate it into a clear visual): ${concept}
${retry}
Produce ONE self-contained animated SVG. STRICT rules:
- Root exactly: <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg"> … </svg>.
- Use ONLY these elements: rect, circle, ellipse, line, polyline, polygon, path, text, tspan, g, defs,
  linearGradient, radialGradient, stop, and the SMIL animation elements animate, animateTransform,
  animateMotion, mpath, set.
- Animate with SMIL and repeatCount="indefinite" so it loops smoothly. Internal gradient refs like
  fill="url(#g)" are fine.
- FORBIDDEN: <script>, <style>, <foreignObject>, <image>, <use>, <a>, CSS @import, any on… event
  handler, and any external URL (http/https/data:). Everything must be inline and self-contained.
- This is maths — show EXACT numbers and clean, correctly-proportioned shapes. Calm and uncluttered.
- Palette: blue #1c6dd0, green #2e9e5b, amber #f2a71b, and grays (#cbd5e1, #64748b).

Output ONLY the <svg>…</svg> — no prose, no markdown code fences.`;
}

export async function generateAnimationSvg(skillName: string, concept: string): Promise<string> {
  const first = await chatCompletion(providerFor('generation'), animationPrompt(skillName, concept), ANIMATION_MAX_TOKENS, 0.7);
  let svg = sanitizeAnimationSvg(first.content);
  if (!svg) {
    // One retry with explicit feedback — the model's output failed the safety allow-list.
    const feedback = 'it must be ONLY a safe animated <svg> using the allowed elements — no <script>, <style>, event handlers, or external references.';
    const second = await chatCompletion(providerFor('generation'), animationPrompt(skillName, concept, feedback), ANIMATION_MAX_TOKENS, 0.7);
    svg = sanitizeAnimationSvg(second.content);
  }
  if (!svg) throw new Error('Could not generate a safe animation. Please try again.');
  return svg;
}
