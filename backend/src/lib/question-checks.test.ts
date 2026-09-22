import { describe, it, expect } from 'vitest';
import { hasRawDataLeak } from './question-checks';

// W-157: a batch-generated question must reference its stimulus figure ("the table", "the graph"),
// never reproduce the figure's raw data in the question text. The most egregious form is the model
// serialising the table structure — "Columns: [...] Rows: [...]" — or a bracketed value array.
describe('hasRawDataLeak', () => {
  it('flags a serialised table dumped into the question text', () => {
    const text =
      'The table shows students in four clubs.\nColumns: ["Club","Term 1","Term 2"]\n' +
      'Rows: [ ["Robotics",50,55], ["Chess",40,48] ]\nWhich club grew 20%?';
    expect(hasRawDataLeak(text)).toBe(true);
  });

  it('flags a bare bracketed array of quoted values', () => {
    expect(hasRawDataLeak('Given ["Robotics",50,55], which term is bigger?')).toBe(true);
  });

  it('does not flag a normal word problem that references the figure', () => {
    expect(hasRawDataLeak('The table shows club membership by term. Which club grew by 20%?')).toBe(false);
    expect(hasRawDataLeak('Using the graph, what was the average number of books borrowed per day?')).toBe(false);
  });
});
