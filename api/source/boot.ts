import { env } from "@env";
import { Elysia } from "elysia";

import { HealthPlugin } from "@plugins/health.plugin";
import { OriginsPlugin } from "@plugins/origins.plugin";

const app = new Elysia()
  .use(OriginsPlugin)
  .use(HealthPlugin)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
