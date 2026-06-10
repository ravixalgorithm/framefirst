import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { db, links, queryEvents } from "@framefirst/db";
import { projectForSnippetKey } from "../lib/projects.js";

type CreateLinkBody = {
  projectId: string;
  destinationUrl: string;
  slug: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

type LinkAnalyticsRow = {
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  pageviews: string;
  visitors: string;
  conversions: string;
  top_country: string;
};

export async function linksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { project_id: string } }>("/links", { preHandler: fastify.authenticate }, async (request, reply) => {
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
      .from(links)
      .where(eq(links.projectId, project.id))
      .orderBy(desc(links.createdAt));

    const analyticsQuery = `
      SELECT 
        utm_campaign, 
        utm_source, 
        utm_medium, 
        countIf(event_type = 'pageview') as pageviews, 
        uniq(anonymous_id) as visitors,
        countIf(event_type != 'pageview' AND event_type != 'click') as conversions,
        anyHeavy(country) as top_country
      FROM events
      WHERE site_id = {siteId:String}
        AND utm_campaign != ''
      GROUP BY utm_campaign, utm_source, utm_medium
    `;

    const analyticsData = await queryEvents<LinkAnalyticsRow>(analyticsQuery, { siteId: snippetKey });

    const mappedLinks = rows.map(r => {
      // Find matching analytics by comparing UTMs (accounting for nulls)
      const stats = analyticsData.find(a => 
        a.utm_campaign === (r.utmCampaign || "") &&
        a.utm_source === (r.utmSource || "") &&
        a.utm_medium === (r.utmMedium || "")
      );

      const visitors = stats ? parseInt(stats.visitors, 10) : 0;
      const conversions = stats ? parseInt(stats.conversions, 10) : 0;

      return {
        id: r.id,
        slug: r.slug,
        destinationUrl: r.destinationUrl,
        destination: r.destinationUrl,
        source: r.utmSource || "",
        medium: r.utmMedium || "",
        campaign: r.utmCampaign || "",
        term: r.utmTerm || "",
        content: r.utmContent || "",
        clicks: stats ? parseInt(stats.pageviews, 10) : 0,
        cvr: visitors > 0 ? (conversions / visitors) * 100 : 0,
        topCountry: stats?.top_country || "--",
        visitors,
        conversions
      };
    });

    return mappedLinks;
  });

  fastify.post<{ Body: CreateLinkBody }>("/links", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const body = request.body as CreateLinkBody;
    const project = await projectForSnippetKey(user.id, body.projectId);
    
    if (!project) {
      return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
    }

    try {
      const [link] = await db.insert(links).values({
        projectId: project.id,
        slug: body.slug,
        destinationUrl: body.destinationUrl,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        utmTerm: body.utmTerm,
        utmContent: body.utmContent,
      }).returning();

      return {
        id: link.id,
        slug: link.slug,
        destinationUrl: link.destinationUrl,
        destination: link.destinationUrl,
        source: link.utmSource || "",
        medium: link.utmMedium || "",
        campaign: link.utmCampaign || "",
        term: link.utmTerm || "",
        content: link.utmContent || "",
        clicks: 0,
        cvr: 0,
        topCountry: "--",
        visitors: 0,
        conversions: 0
      };
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === '23505') {
        return reply.code(400).send({ error: "Slug already exists", code: "SLUG_EXISTS" });
      }
      throw e;
    }
  });

  fastify.delete<{ Params: { id: string } }>("/links/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    await db.delete(links).where(eq(links.id, request.params.id));
    
    return { ok: true };
  });

  // Public endpoint for redirect resolution
  fastify.get<{ Params: { slug: string } }>("/links/go/:slug", async (request, reply) => {
    const { slug } = request.params;
    
    const [link] = await db.select().from(links).where(eq(links.slug, slug)).limit(1);

    if (!link) {
      return reply.code(404).send({ error: "Link not found", code: "NOT_FOUND" });
    }

    try {
      const url = new URL(link.destinationUrl);
      if (link.utmSource) url.searchParams.set("utm_source", link.utmSource);
      if (link.utmMedium) url.searchParams.set("utm_medium", link.utmMedium);
      if (link.utmCampaign) url.searchParams.set("utm_campaign", link.utmCampaign);
      if (link.utmTerm) url.searchParams.set("utm_term", link.utmTerm);
      if (link.utmContent) url.searchParams.set("utm_content", link.utmContent);
      
      return { url: url.toString() };
    } catch {
      // Fallback if destinationUrl is not a valid URL (should not happen)
      return { url: link.destinationUrl };
    }
  });
}
