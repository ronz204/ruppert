import { env } from "@env";
import { Elysia } from "elysia";

import { ScalarPlugin } from "@plugins/scalar.plugin";
import { HealthPlugin } from "@plugins/health.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";

const app = new Elysia({ prefix: "/api" })
  .use(OriginsPlugin)
  .use(ScalarPlugin)
  .use(HealthPlugin)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
