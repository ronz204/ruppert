import { env } from "@env";
import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";

export const ScalarPlugin = new Elysia()
  .use(openapi({
    path: "/docs",
    documentation: {
      info: {
        title: env.APP_NAME,
        version: env.APP_VERSION,
      },
    },
  }));
