import type { FastifyInstance, FastifyRequest } from "fastify";

import type { CollectRequest } from "@framefirst/types/api";
import type { EventRow } from "@framefirst/types/events";

import { eventsQueue } from "../lib/events-queue.js";
import { findProjectBySnippetKey, type ProjectLookup } from "../lib/projects.js";
import { redis } from "../lib/redis.js";

const collectSchema = {
  body: {
    type: "object",
    required: [
      "site_id",
      "session_id",
      "anonymous_id",
      "event_type",
      "url"
    ],
    additionalProperties: false,
    properties: {
      site_id: { type: "string", minLength: 1, maxLength: 128 },
      session_id: { type: "string", minLength: 1, maxLength: 128 },
      anonymous_id: { type: "string", minLength: 1, maxLength: 128 },
      event_type: {
        type: "string",
        enum: ["pageview", "click", "custom", "formsubmit"]
      },
      url: { type: "string", minLength: 1, maxLength: 4096 },
      referrer: { type: "string", maxLength: 4096 },
      utm_source: { type: "string", maxLength: 512 },
      utm_medium: { type: "string", maxLength: 512 },
      utm_campaign: { type: "string", maxLength: 512 },
      utm_term: { type: "string", maxLength: 512 },
      utm_content: { type: "string", maxLength: 512 },
      x_pct: { type: "number", minimum: 0, maximum: 1 },
      y_pct: { type: "number", minimum: 0, maximum: 1 },
      element_selector: { type: "string", maxLength: 2048 },
      variant_id: { type: "string", maxLength: 128 },
      country: { type: "string", maxLength: 2 },
      device: { type: "string", maxLength: 1024 },
      timestamp: { type: "string", minLength: 1, maxLength: 64 }
    }
  }
} as const;

export async function collectRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/collect", async (_request, reply) => {
    return reply.code(405).send({
      error: "Use POST /collect for tracking events. Open /test-site to test the script locally.",
      code: "COLLECT_REQUIRES_POST"
    });
  });

  fastify.post("/collect", { schema: collectSchema }, async (request) => {
    const event = request.body as CollectRequest;
    console.log("[collect] Received event for:", event.site_id);
    const project = await getCachedProject(event.site_id);

    if (!project) {
      console.log("[collect] Project not found");
      return { ok: true };
    }

    if (!originAllowed(request, project.allowedDomains)) {
      console.log("[collect] Origin not allowed:", request.headers.origin, "vs", project.allowedDomains);
      return { ok: true };
    }

    const withinLimit = await checkRateLimit(event.site_id);

    if (!withinLimit) {
      console.log("[collect] Rate limit exceeded");
      return { ok: true };
    }

    const normalized = normalizeEvent(event);

    if (normalized.event_type === "pageview") {
      await updateLiveVisitors(normalized);
    }

    const job = await eventsQueue.add("collect", normalized);
    console.log("[collect] Added to queue, job id:", job.id);

    return { ok: true };
  });
}

async function getCachedProject(snippetKey: string): Promise<ProjectLookup | null> {
  const cacheKey = `project:${snippetKey}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as ProjectLookup;
  }

  const project = await findProjectBySnippetKey(snippetKey);

  if (project) {
    await redis.set(cacheKey, JSON.stringify(project), "EX", 300);
  }

  return project;
}

async function checkRateLimit(siteId: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60000);
  const key = `ratelimit:${siteId}:${bucket}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 70);
  }

  return count <= 1000;
}

async function updateLiveVisitors(event: EventRow): Promise<void> {
  const now = Date.now();
  const key = `site:${event.site_id}:live`;

  await redis.zadd(key, now, event.anonymous_id);
  await redis.zremrangebyscore(key, "-inf", now - 5 * 60 * 1000);
  await redis.expire(key, 10 * 60);
  await redis.publish(`site:${event.site_id}:live-update`, "ping");
}

function normalizeEvent(event: CollectRequest): EventRow {
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

  return {
    site_id: event.site_id,
    session_id: event.session_id,
    anonymous_id: event.anonymous_id,
    event_type: event.event_type,
    url: event.url,
    referrer: event.referrer ?? "",
    utm_source: event.utm_source ?? "",
    utm_medium: event.utm_medium ?? "",
    utm_campaign: event.utm_campaign ?? "",
    utm_term: event.utm_term ?? "",
    utm_content: event.utm_content ?? "",
    x_pct: event.x_pct ?? 0,
    y_pct: event.y_pct ?? 0,
    element_selector: event.element_selector ?? "",
    variant_id: event.variant_id ?? "",
    country: event.country?.toUpperCase() ?? "",
    device: event.device ?? "",
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString()
  };
}

function originAllowed(request: FastifyRequest, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }

  const origin = request.headers.origin ?? request.headers.referer;

  if (!origin) {
    return false;
  }

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return allowedDomains.some((domain) => {
      const normalized = domain.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}
