import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { env } from "../config.js";
import { userOwnsSnippetKey } from "./projects.js";

export async function authorizeProjectRead(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  siteId: string
): Promise<boolean> {
  const localDevBypass =
    env.nodeEnv === "development" &&
    !env.supabaseUrl &&
    !env.supabaseAnonKey &&
    siteId === "ff_dev_site";

  if (localDevBypass) {
    return true;
  }

  await fastify.authenticate(request, reply);

  if (reply.sent) {
    return false;
  }

  const userId = request.user?.id;

  if (!userId) {
    await reply.code(401).send({
      error: "Unauthorized",
      code: "AUTH_REQUIRED"
    });
    return false;
  }

  const ownsProject = await userOwnsSnippetKey(userId, siteId);

  if (!ownsProject) {
    await reply.code(403).send({
      error: "You do not have access to this project",
      code: "PROJECT_FORBIDDEN"
    });
    return false;
  }

  return true;
}
