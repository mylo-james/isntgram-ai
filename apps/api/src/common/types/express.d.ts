import 'express';

export {};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
