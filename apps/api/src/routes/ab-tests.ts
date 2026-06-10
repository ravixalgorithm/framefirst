import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { db, abTests, type AbTestVariant, type GoalEvent, queryEvents } from "@framefirst/db";
import { projectForSnippetKey } from "../lib/projects.js";

type CreateAbTestBody = {
  projectId: string;
  name: string;
  variants: AbTestVariant[];
  goalEvent: GoalEvent;
};

export async function abTestRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { project_id: string } }>("/ab-tests", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const { project_id: snippetKey } = request.query;
    if (!snippetKey) {
      return reply.code(400).send({ error: "project_id query parameter is required", code: "INVALID_REQUEST" });
    }

    const project = await projectForSnippetKey(user.id, snippetKey);
    if (!project) {
      return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
    }

    const rows = await db
      .select()
      .from(abTests)
      .where(eq(abTests.projectId, project.id))
      .orderBy(desc(abTests.createdAt));

    const enriched = await Promise.all(
      rows.map(async (r) => {
        let condition = "0";
        let paramValue = r.goalEvent.value;
        if (r.goalEvent.type === "pageview") condition = "event_type = 'pageview' AND url LIKE {goalValue:String}";
        else if (r.goalEvent.type === "click") condition = "event_type = 'click' AND element_selector = {goalValue:String}";
        else if (r.goalEvent.type === "custom") condition = "event_type = 'custom' AND element_selector = {goalValue:String}";

        if (r.goalEvent.type === "pageview" && !paramValue.startsWith("%")) {
          paramValue = `%${paramValue}%`;
        }

        const statsQuery = `
          SELECT 
            variant_id,
            count(distinct anonymous_id) as visitors,
            count(distinct if(${condition}, anonymous_id, null)) as conversions
          FROM events
          WHERE site_id = {siteId:String} AND variant_id != ''
          GROUP BY variant_id
        `;
        
        const statsData = await queryEvents<{ variant_id: string; visitors: number; conversions: number }>(statsQuery, {
          siteId: snippetKey,
          goalValue: paramValue
        });

        const statsMap = new Map(statsData.map(s => [s.variant_id, s]));
        
        const variants = r.variants.map((v: { id: string; name: string; weight: number }) => {
          const stats = statsMap.get(v.id);
          const visitors = stats ? Number(stats.visitors) : 0;
          const conversions = stats ? Number(stats.conversions) : 0;
          const cvr = visitors > 0 ? (conversions / visitors) * 100 : 0;
          return {
            ...v,
            visitors,
            conversions,
            cvr,
            probabilityBest: 0 // Will calculate properly later or just default
          };
        });

        const totalVisitors = variants.reduce((sum: number, v: any) => sum + v.visitors, 0);

        // Simple probability best logic: if no visitors, use even distribution
        if (totalVisitors === 0) {
          variants.forEach((v: any) => v.probabilityBest = Math.round(100 / variants.length));
        } else {
          // Find max CVR
          const maxCvr = Math.max(...variants.map((v: any) => v.cvr));
          variants.forEach((v: any) => {
            if (v.visitors === 0) v.probabilityBest = 0;
            else if (v.cvr === maxCvr && maxCvr > 0) v.probabilityBest = 90; // Fake Bayesian for MVP
            else v.probabilityBest = 10;
          });
        }

        const leader = [...variants].sort((a, b) => b.probabilityBest - a.probabilityBest)[0];

        return {
          id: r.id,
          name: r.name,
          status: r.status,
          variants,
          goalEvent: r.goalEvent,
          winnerVariantId: r.winnerVariantId,
          winnerId: r.winnerVariantId,
          visitors: totalVisitors,
          daysRunning: Math.floor((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        };
      })
    );

    return enriched;
  });

  fastify.post<{ Body: CreateAbTestBody }>("/ab-tests", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const body = request.body;
    const project = await projectForSnippetKey(user.id, body.projectId);
    
    if (!project) {
      return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
    }

    const [test] = await db.insert(abTests).values({
      projectId: project.id,
      name: body.name,
      status: "running",
      variants: body.variants,
      goalEvent: body.goalEvent
    }).returning();

    return test;
  });

  fastify.patch<{ Params: { id: string }, Body: { status?: string, winnerVariantId?: string } }>("/ab-tests/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const [updated] = await db.update(abTests)
      .set({
        status: request.body.status,
        winnerVariantId: request.body.winnerVariantId,
        updatedAt: new Date()
      })
      .where(eq(abTests.id, request.params.id))
      .returning();

    return updated;
  });

  fastify.get<{ Params: { id: string }, Querystring: { anonymous_id: string } }>("/ab-tests/:id/assign", async (request, reply) => {
    const { id } = request.params;
    const { anonymous_id } = request.query;

    if (!anonymous_id) {
      return reply.code(400).send({ error: "anonymous_id query parameter is required", code: "INVALID_REQUEST" });
    }

    const rows = await db.select().from(abTests).where(eq(abTests.id, id));
    if (rows.length === 0 || rows[0].status !== "running") {
      return reply.code(404).send({ error: "Active test not found", code: "TEST_NOT_FOUND" });
    }

    const test = rows[0];

    // Simple deterministic assignment (DJB2 hash)
    let hash = 5381;
    const str = `${anonymous_id}:${test.id}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    const mod = Math.abs(hash) % 100;

    let cumulative = 0;
    for (const variant of test.variants as AbTestVariant[]) {
      cumulative += variant.weight;
      if (mod < cumulative) {
        return { variant_id: variant.id };
      }
    }

    return { variant_id: (test.variants[0] as AbTestVariant).id };
  });
}
