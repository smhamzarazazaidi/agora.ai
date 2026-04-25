import { Request, Response, NextFunction } from 'express';
import express from 'express';

export interface AuthRequest extends express.Request {
  user?: { userId: string };
}

export const protect = (req: AuthRequest, res: express.Response, next: NextFunction) => {
  // Authentication disabled for hackathon
  req.user = { userId: 'hackathon-user' };
  next();
};
