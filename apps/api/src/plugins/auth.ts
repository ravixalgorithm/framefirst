import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

import { env } from "../config.js";

export const authPlugin = fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.jwtSecret
  });

  fastify.decorate("authenticate", async (request, reply) => {
    try {
      let token = request.headers.authorization?.replace(/^Bearer /i, "");
      
      if (!token && request.headers.cookie) {
        const match = request.headers.cookie.match(/ff_access_token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }

      if (token) {
        const decoded = fastify.jwt.verify(token);
        request.user = decoded as any;
        return;
      }

      throw new Error("No token");
    } catch {
      // In development, fallback to headers or default dev user if JWT fails or is missing
      if (env.nodeEnv === "development") {
        const devUser = (request.headers["x-framefirst-dev-user"] as string | undefined) ?? "00000000-0000-4000-8000-000000000001";
        request.user = {
          id: devUser,
          email: (request.headers["x-framefirst-dev-email"] as string) ?? "dev@framefirst.local"
        };
        return;
      }
      await reply.code(401).send({
        error: "Missing or invalid bearer token",
        code: "AUTH_UNAUTHORIZED"
      });
    }
  });
});

