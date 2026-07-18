import { Request, Response, NextFunction } from 'express';

type HttpError = Error & { status?: number; statusCode?: number };

export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);
  // Honour client-error statuses set upstream (e.g. body-parser's malformed-JSON 400).
  // True 500s return a generic message — internals stay in the server log only (L12).
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: status < 500 ? err.message || 'Bad request' : 'Internal server error',
    status,
  });
}
