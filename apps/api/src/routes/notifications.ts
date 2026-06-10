import type { FastifyInstance } from "fastify";

import { isOneSignalConfigured, sendPushNotification } from "../lib/onesignal.js";

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: {
      title?: string;
      message?: string;
      subscriptionId?: string;
      url?: string;
    };
  }>("/notifications/test", { preHandler: fastify.authenticate }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    }

    if (!isOneSignalConfigured()) {
      return reply.code(503).send({
        error: "OneSignal is not configured on the server",
        code: "ONESIGNAL_NOT_CONFIGURED",
        hint: "Add ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to .env.local",
      });
    }

    const title = request.body.title?.trim() || "Frame First test";
    const message = request.body.message?.trim() || "Push notifications are working!";
    const subscriptionId = request.body.subscriptionId?.trim();
    const url = request.body.url?.trim();

    try {
      const result = await sendPushNotification({
        title,
        message,
        subscriptionId: subscriptionId || undefined,
        url: url || undefined,
      });

      return {
        ok: true,
        notificationId: result.id ?? null,
        targeted: subscriptionId ? "device" : "all_subscribers",
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to send notification";
      return reply.code(502).send({
        error: detail,
        code: "ONESIGNAL_SEND_FAILED",
      });
    }
  });
}
