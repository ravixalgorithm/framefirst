import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { db, notificationRules, projects } from "@framefirst/db";
import { projectForSnippetKey } from "../lib/projects.js";

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { site_id: string } }>("/settings/:site_id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    const snippetKey = request.params.site_id;
    const project = await projectForSnippetKey(user.id, snippetKey);
    
    if (!project) {
      return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
    }

    const rules = await db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.projectId, project.id));

    return {
      conversionGoal: project.conversionGoal ?? { type: "pageview", value: "/success" },
      notifications: rules.map(r => ({
        id: r.id,
        label: r.type,
        threshold: r.threshold,
        enabled: r.enabled
      }))
    };
  });

  fastify.post<{ Params: { site_id: string }; Body: { conversionGoal: any; notifications: any[] } }>(
    "/settings/:site_id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      }

      const snippetKey = request.params.site_id;
      const project = await projectForSnippetKey(user.id, snippetKey);
      
      if (!project) {
        return reply.code(404).send({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
      }

      const { conversionGoal, notifications } = request.body;

      // Update project conversion goal
      if (conversionGoal) {
        await db.update(projects).set({ conversionGoal }).where(eq(projects.id, project.id));
      }

      // Update notifications
      if (notifications && Array.isArray(notifications)) {
        for (const notif of notifications) {
          await db.update(notificationRules).set({ enabled: notif.enabled }).where(eq(notificationRules.id, notif.id));
        }
      }

      return { ok: true };
    }
  );
}
