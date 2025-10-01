import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), notImplementedHandler);
authRouter.post('/login', validate(loginSchema), notImplementedHandler);
authRouter.post('/refresh', notImplementedHandler);
authRouter.post('/logout', (_req, res) => {
  res.status(204).end();
});
authRouter.get('/me', notImplementedHandler);

function notImplementedHandler(_req: Request, res: Response): void {
  res.status(501).json({ error: 'NOT_IMPLEMENTED' });
}

function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'INVALID_PAYLOAD',
        details: parsed.error.flatten()
      });
      return;
    }

    req.body = parsed.data;
    next();
  };
}
