import { describe, it, expect } from 'vitest';
import { parseJsonArray, parseOptions } from '../lib/parse';

describe('parseJsonArray (L5)', () => {
  it('parses a valid JSON array', () => {
    expect(parseJsonArray<string>('["a","b"]')).toEqual(['a', 'b']);
  });

  it('returns [] for malformed JSON', () => {
    expect(parseJsonArray('not-json{{')).toEqual([]);
  });

  it('returns [] for valid JSON that is not an array', () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });

  it('returns [] for null/undefined/empty input', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
  });
});

describe('parseOptions (L13)', () => {
  it('parses a valid options array', () => {
    expect(parseOptions('["12","15","18","21","24"]')).toEqual(['12', '15', '18', '21', '24']);
  });

  it('returns null for malformed JSON — never placeholder options', () => {
    expect(parseOptions('not-json')).toBeNull();
  });

  it('returns null for non-array JSON or non-string elements', () => {
    expect(parseOptions('{"a":1}')).toBeNull();
    expect(parseOptions('[1,2,3]')).toBeNull();
  });
});
