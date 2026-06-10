import { eq, and } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { db, projects, queryEvents } from "@framefirst/db";
import type { CreateProjectRequest } from "@framefirst/types/api";

import { env } from "../config.js";
import {
  createSnippetKey,
  domainsFromSiteUrl,
  ensureUser,
  toProject
} from "../lib/projects.js";

const createProjectSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      siteUrl: { type: "string", maxLength: 2048 },
      allowedDomains: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 255 }
      }
    }
  }
} as const;

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/projects", { preHandler: fastify.authenticate }, async (request) => {
    const user = request.user;

    if (!user) {
      return [];
    }

    await ensureUser(user);

    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(projects.createdAt);

    if (rows.length === 0) {
      return { projects: [] };
    }

    const snippetKeys = rows.map(r => r.snippetKey);

    const activeSitesQuery = `
      SELECT site_id, count() as events_count
      FROM events
      WHERE site_id IN ({siteIds:Array(String)})
      GROUP BY site_id
    `;
    
    let activeSites: string[] = [];
    try {
      const activeData = await queryEvents<{site_id: string, events_count: string}>(activeSitesQuery, { siteIds: snippetKeys });
      activeSites = activeData.filter(d => parseInt(d.events_count, 10) > 0).map(d => d.site_id);
    } catch (e) {
      // Ignore clickhouse errors
    }

    return {
      projects: rows.map(r => ({
        ...toProject(r),
        isActive: activeSites.includes(r.snippetKey) || r.snippetKey === "ff_dev_site" // Keep fallback for dev site
      }))
    };
  });

  fastify.post(
    "/projects",
    { preHandler: fastify.authenticate, schema: createProjectSchema },
    async (request, reply) => {
      const user = request.user;

      if (!user) {
        return reply.code(401).send({
          error: "Unauthorized",
          code: "AUTH_REQUIRED"
        });
      }

      const body = request.body as CreateProjectRequest;
      await ensureUser(user);

      const allowedDomains =
        body.allowedDomains && body.allowedDomains.length > 0
          ? body.allowedDomains.map((domain) => domain.toLowerCase())
          : domainsFromSiteUrl(body.siteUrl);

      const [project] = await db
        .insert(projects)
        .values({
          userId: user.id,
          name: body.name,
          siteUrl: body.siteUrl,
          snippetKey: createSnippetKey(),
          allowedDomains
        })
        .returning();

      if (!project) {
        return reply.code(500).send({
          error: "Project could not be created",
          code: "PROJECT_CREATE_FAILED"
        });
      }

      return reply.code(201).send({
        project: toProject(project),
        scriptTag: `<script src="${env.trackJsCdnUrl}" data-site="${project.snippetKey}" async></script>`
      });
    }
  );

  fastify.get<{ Params: { snippet_key: string } }>(
    "/projects/snippet/:snippet_key",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.snippetKey, request.params.snippet_key), eq(projects.userId, user.id)))
        .limit(1);

      if (!project) {
        return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
      }

      return { project: toProject(project) };
    }
  );

  fastify.delete<{ Params: { id: string } }>("/projects/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const { id } = request.params;
    
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .limit(1);

    if (project.length === 0) {
      return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
    }

    await db.delete(projects).where(eq(projects.id, id));
    
    return { ok: true };
  });

  fastify.get<{ Params: { id: string } }>("/projects/:id/status", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const { id } = request.params;
    
    // Check if id is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let projectRows = [];
    if (isUuid) {
      projectRows = await db
        .select({ snippetKey: projects.snippetKey })
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
        .limit(1);
    }

    if (projectRows.length === 0) {
      // If no project matches ID, fallback to check if id IS the snippetKey (frontend uses snippetKey in URL)
      const projectBySnippet = await db
        .select({ snippetKey: projects.snippetKey })
        .from(projects)
        .where(and(eq(projects.snippetKey, id), eq(projects.userId, user.id)))
        .limit(1);
        
      if (projectBySnippet.length === 0) {
        return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
      }
      projectRows.push(projectBySnippet[0]);
    }

    const snippetKey = projectRows[0].snippetKey;
    if (snippetKey === "ff_dev_site") {
      return { isActive: true };
    }

    const activeSitesQuery = `
      SELECT count() as events_count
      FROM events
      WHERE site_id = {siteId:String}
    `;
    
    try {
      const activeData = await queryEvents<{events_count: string}>(activeSitesQuery, { siteId: snippetKey });
      const count = activeData[0] ? parseInt(activeData[0].events_count, 10) : 0;
      return { isActive: count > 0 };
    } catch (e) {
      return { isActive: false };
    }
  });
}
