import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";

import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { collectRoutes } from "./routes/collect.js";
import { projectRoutes } from "./routes/projects.js";
import { testSiteRoutes } from "./routes/test-site.js";
import { linksRoutes } from "./routes/links.js";
import { abTestRoutes } from "./routes/ab-tests.js";
import { heatmapRoutes } from "./routes/heatmap.js";
import { settingsRoutes } from "./routes/settings.js";
import { healthRoutes } from "./routes/health.js";
import { liveRoutes } from "./routes/live.js";
import { notificationRoutes } from "./routes/notifications.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  });

  await app.register(authPlugin);
  await app.register(staticPlugin, {
    root: path.resolve(publicDir),
    prefix: "/"
  });
  await app.register(authRoutes);

  await app.register(healthRoutes);
  await app.register(collectRoutes);
  await app.register(analyticsRoutes);
  await app.register(liveRoutes);
  await app.register(projectRoutes);
  await app.register(testSiteRoutes);
  await app.register(linksRoutes);
  await app.register(abTestRoutes);
  await app.register(heatmapRoutes);
  await app.register(settingsRoutes);
  await app.register(notificationRoutes);

  return app;
}
