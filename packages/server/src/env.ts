import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().min(0).max(65535).default(8080),
  BASE_URL: z.string().url().default('http://localhost:8080'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me'),
  ACCESS_TTL_SEC: z.coerce.number().positive().default(900),
  REFRESH_TTL_SEC: z.coerce.number().positive().default(2592000),
  PASSWORD_SALT_ROUNDS: z.coerce.number().positive().default(12),
  DB_PROVIDER: z.enum(['postgresql', 'sqlite']).default('sqlite'),
  DB_URL: z.string().min(1).default('file:./dev.db'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173')
});

export const env = envSchema.parse(process.env);

process.env.DB_PROVIDER = env.DB_PROVIDER;
process.env.DB_URL = env.DB_URL;

export type Env = typeof env;
