import { env } from "@env";
import { Elysia } from "elysia";
import { OriginsPlugin } from "@plugins/origins.plugin";

const app = new Elysia()
  .use(OriginsPlugin)
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
