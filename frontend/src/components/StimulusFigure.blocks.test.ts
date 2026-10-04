import { describe, it, expect } from 'vitest';
import { blocksLabel, sectorLegendText } from './StimulusFigure';

// W-148: the compact pie legend must honour showPercent — an unlabelled slice (showPercent:false)
// shows only its name, so pie questions keep room for the student to infer its value.
describe('sectorLegendText', () => {
  it('shows the percent when showPercent is true or omitted', () => {
    expect(sectorLegendText('Rent', 25, true)).toBe('Rent 25%');
    expect(sectorLegendText('Rent', 25, undefined)).toBe('Rent 25%');
  });

  it('hides the percent when showPercent is false (label only)', () => {
    expect(sectorLegendText('Savings', 30, false)).toBe('Savings');
  });
});

// W-130: hovering a pie slice explains its 5%-block breakdown. blocksLabel builds that caption; it
// only adds the "blocks of 5%" part when the percent is a clean multiple of 5.
describe('blocksLabel', () => {
  it('breaks a multiple-of-5 percent into 5% blocks', () => {
    expect(blocksLabel('Children', 15)).toBe('Children — 15% = 3 blocks of 5%');
    expect(blocksLabel('Students', 25)).toBe('Students — 25% = 5 blocks of 5%');
  });

  it('uses the singular for a single block', () => {
    expect(blocksLabel('Tax', 5)).toBe('Tax — 5% = 1 block of 5%');
  });

  it('just shows the percent when it is not a multiple of 5', () => {
    expect(blocksLabel('Adults', 12)).toBe('Adults — 12%');
  });
});
