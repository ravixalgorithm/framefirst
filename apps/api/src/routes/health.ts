import type { FastifyInstance } from "fastify";

import { clickhouse } from "@framefirst/db/clickhouse";

import { eventsQueue } from "../lib/events-queue.js";
import { redis } from "../lib/redis.js";

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async () => {
    const [redisPing, clickhousePing, queueCounts] = await Promise.all([
      redis.ping(),
      clickhouse.ping(),
      eventsQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed")
    ]);

    return {
      ok: true,
      redis: redisPing === "PONG",
      clickhouse: clickhousePing.success,
      queue: queueCounts
    };
  });
}
