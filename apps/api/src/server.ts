import { env } from "./config.js";
import { buildApp } from "./app.js";

const app = await buildApp();

try {
  await app.listen({ port: env.apiPort, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
