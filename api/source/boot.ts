import { env } from "@env";
import { Elysia } from "elysia";

const app = new Elysia()
  .listen(env.APP_PORT);

const url = `http://${app.server?.hostname}:${app.server?.port}`;
console.log(`🦊 Elysia is running at ${url}`);
