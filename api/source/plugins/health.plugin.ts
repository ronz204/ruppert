import { env } from "@env";
import { Elysia } from "elysia";

export const HealthPlugin = new Elysia({ name: "health.plugin" })
  .get("/health", () => ({
    version: env.APP_VERSION,
    service: env.APP_NAME,
    status: "healthy"
  }));
