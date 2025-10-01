import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().min(0).max(65535).default(8080),
  BASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL_SEC: z.coerce.number().positive().default(900),
  REFRESH_TTL_SEC: z.coerce.number().positive().default(2592000),
  PASSWORD_SALT_ROUNDS: z.coerce.number().positive().default(12),
  DB_PROVIDER: z.enum(['postgresql', 'sqlite']).default('postgresql'),
  DB_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1)
});

export const env = envSchema.parse(process.env);

process.env.DB_PROVIDER = env.DB_PROVIDER;
process.env.DB_URL = env.DB_URL;

export type Env = typeof env;
