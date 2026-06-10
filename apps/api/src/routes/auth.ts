import type { FastifyPluginAsync } from "fastify";
import Redis from "ioredis";
import { users } from "@framefirst/db";

import { env } from "../config.js";

const redis = new Redis(env.redisUrl);

type MagicLinkBody = {
  email: string;
};

type VerifyBody = {
  email: string;
  code: string;
};

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: MagicLinkBody }>("/auth/magic", async (request, reply) => {
    const email = request.body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return reply.code(400).send({
        error: "Enter a valid email address",
        code: "INVALID_EMAIL"
      });
    }

    // Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in Redis with 10 minute TTL
    await redis.setex(`auth:otp:${email}`, 600, code);

    request.log.info({ email, code }, "Generated auth OTP (check console for local login)");
    
    return {
      ok: true,
      message: "Code sent",
      ...(env.nodeEnv === "development" ? { devCode: code } : {})
    };
  });

  fastify.post<{ Body: VerifyBody }>("/auth/verify", async (request, reply) => {
    const email = request.body.email?.trim().toLowerCase();
    const code = request.body.code?.trim();

    if (!email || !code) {
      return reply.code(400).send({
        error: "Email and code are required",
        code: "INVALID_REQUEST"
      });
    }

    const savedCode = await redis.get(`auth:otp:${email}`);

    if (!savedCode || savedCode !== code) {
      // Keep backdoor for local dev "123456" if no saved code or mismatch
      if (env.nodeEnv !== "development" || code !== "123456") {
        return reply.code(401).send({
          error: "Invalid or expired code",
          code: "INVALID_CODE"
        });
      }
    }

    // Delete OTP
    await redis.del(`auth:otp:${email}`);

    // Upsert user
    const [user] = await db
      .insert(users)
      .values({ email })
      .onConflictDoUpdate({ target: users.email, set: { email } })
      .returning();

    // Generate JWT access token
    const token = fastify.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" });

    // In a real setup, we'd issue a refresh token. For simplicity here we just issue a long-lived JWT.
    return {
      accessToken: token
    };
  });
};
