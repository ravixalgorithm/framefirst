import type { FastifyInstance, FastifyReply } from "fastify";

import { authorizeProjectRead } from "../lib/authz.js";
import { createRedisConnection, redis } from "../lib/redis.js";

const liveSchema = {
  params: {
    type: "object",
    required: ["site_id"],
    properties: {
      site_id: { type: "string", minLength: 1, maxLength: 128 }
    }
  }
} as const;

type LiveParams = {
  site_id: string;
};

export async function liveRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/live/:site_id", { schema: liveSchema }, async (request, reply) => {
    const params = request.params as LiveParams;
    const siteId = params.site_id;
    const authorized = await authorizeProjectRead(fastify, request, reply, siteId);

    if (!authorized) {
      return undefined;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const subscriber = createRedisConnection();
    const interval = setInterval(() => {
      void pushLiveCount(reply, siteId);
    }, 5000);

    const close = () => {
      clearInterval(interval);
      subscriber.disconnect();
    };

    request.raw.on("close", close);

    subscriber.on("message", (_channel, message) => {
      if (message === "ping") {
        void pushLiveCount(reply, siteId);
      }
    });

    await subscriber.subscribe(`site:${siteId}:live-update`);
    await pushLiveCount(reply, siteId);

    return undefined;
  });
}

async function pushLiveCount(reply: FastifyReply, siteId: string): Promise<void> {
  if (reply.raw.destroyed) {
    return;
  }

  const count = await countLiveVisitors(siteId);
  reply.raw.write(`data: ${JSON.stringify({ count })}\n\n`);
}

async function countLiveVisitors(siteId: string): Promise<number> {
  const now = Date.now();
  const key = `site:${siteId}:live`;

  await redis.zremrangebyscore(key, "-inf", now - 5 * 60 * 1000);
  return redis.zcard(key);
}
