import { z } from "zod";

const envSchema = z.object({
  // ==========================================
  // Application Config
  // ==========================================
  APP_NAME: z.string().default("Ruppert API"),
  APP_VERSION: z.string().default("1.0.0"),
  APP_PORT: z.string().transform((val) => parseInt(val, 10)).default(3000),

  // ==========================================
  // PostgreSQL Config
  // ==========================================
  POSTGRES_DB: z.string(),
  POSTGRES_URL: z.string(),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.string().transform((val) => parseInt(val, 10)).default(5432),

  // ==========================================
  // Security Config
  // ==========================================
  CORS_ORIGIN: z.string().transform((val) => val.split(",").map((origin) => origin.trim())),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
