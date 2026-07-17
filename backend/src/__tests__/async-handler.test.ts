import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../lib/async-handler';
import type { Request, Response, NextFunction } from 'express';

describe('asyncHandler', () => {
  const req = {} as Request;
  const res = {} as Response;

  it('forwards a rejected promise to next()', async () => {
    const err = new Error('boom');
    const next = vi.fn() as NextFunction;
    asyncHandler(async () => {
      throw err;
    })(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(err);
  });

  it('does not call next() when the handler resolves', async () => {
    const next = vi.fn() as NextFunction;
    asyncHandler(async () => undefined)(req, res, next);
    await new Promise((r) => setImmediate(r));
    expect(next).not.toHaveBeenCalled();
  });
});
